const { convChunk, isChunk, RPC_STATUS, rpcStatusOf } = require("./MakerSuiteCodec");
const invalid = message => Object.assign(new Error(message), { status: 502 });

// Consume complete repeated messages from MakerSuite's growing JSON root array
// independently of HTTP/UTF-8 chunk boundaries, freeing finished frames immediately.
class PlaygroundStreamDecoder {
    constructor(consume, { maxMessageChars = 16 * 1024 * 1024, toolNames = null } = {}) {
        this.consume = consume;
        this.maxMessageChars = maxMessageChars;
        this.toolNames = toolNames;
        this.stack = [];
        this.quoted = false;
        this.escaped = false;
        this.started = false;
        this.ended = false;
        this.seen = false;
        this.candidates = new Map();
    }

    push(text) {
        for (const char of text) {
            if (this.ended) {
                if (!/\s/.test(char)) throw invalid("Unexpected data after MakerSuite response");
                continue;
            }
            if (!this.started) {
                if (/\s/.test(char)) continue;
                if (char !== "[") throw invalid("MakerSuite response root must be an array");
                this.started = true;
            }
            if (!this.quoted && (char === "[" || char === "{")) {
                if (this.stack.length >= 128) throw invalid("MakerSuite response nesting exceeds limit");
                this.stack.push({ emitted: false, text: char });
                continue;
            }
            const frame = this.stack.at(-1);
            if (!frame) throw invalid("Invalid MakerSuite response nesting");
            frame.text += char;
            if (frame.text.length > this.maxMessageChars) {
                throw invalid("MakerSuite response message exceeds size limit");
            }
            if (this.quoted) {
                if (this.escaped) this.escaped = false;
                else if (char === "\\") this.escaped = true;
                else if (char === '"') this.quoted = false;
                continue;
            }
            if (char === '"') {
                this.quoted = true;
                continue;
            }
            if (char !== "]" && char !== "}") continue;
            const depth = this.stack.length;
            this.stack.pop();
            let emitted = frame.emitted;
            if (depth <= 3) {
                let value;
                try {
                    value = JSON.parse(frame.text);
                } catch {
                    throw invalid("Invalid MakerSuite response JSON");
                }
                const status = rpcStatusOf(value);
                if (status) {
                    throw Object.assign(new Error(status[1]), {
                        rpcStatus: status,
                        status: RPC_STATUS[status[0]] || 502,
                    });
                }
                if (!emitted && isChunk(value)) {
                    const chunk = convChunk(value, this.toolNames);
                    this.seen = true;
                    for (const candidate of chunk.candidates || []) {
                        const prev = this.candidates.get(candidate.index);
                        this.candidates.set(candidate.index, {
                            finishReason: candidate.finishReason || prev?.finishReason,
                            finishReasonCode: candidate.finishReasonCode ?? prev?.finishReasonCode,
                        });
                    }
                    this.consume(chunk);
                    emitted = true;
                }
            }
            const parent = this.stack.at(-1);
            if (parent) {
                parent.text += emitted ? "null" : frame.text;
                parent.emitted ||= emitted;
                if (emitted && parent.text.endsWith("null,null")) parent.text = parent.text.slice(0, -5);
            } else {
                this.ended = true;
            }
        }
    }

    finish() {
        if (!this.ended || this.stack.length || this.quoted) {
            throw invalid("MakerSuite response was truncated");
        }
        const entries = [...this.candidates.values()];
        if (!this.seen || !entries.length || entries.some(c => !c.finishReason)) {
            throw invalid("MakerSuite response ended without a confirmed finish reason");
        }
    }
}

module.exports = PlaygroundStreamDecoder;
