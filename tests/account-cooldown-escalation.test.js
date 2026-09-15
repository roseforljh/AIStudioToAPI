const assert = require("node:assert/strict");
const test = require("node:test");

const AccountLoadBalancer = require("../src/core/AccountLoadBalancer");

function createBalancer(options = {}) {
    let connected = options.connected || [0];
    const balancer = new AccountLoadBalancer({
        acquireTimeoutMs: options.acquireTimeoutMs ?? 60,
        cooldownByStatus: options.cooldownByStatus || { 403: 30000 },
        cooldownEscalation: options.cooldownEscalation,
        maxCooldownMs: options.maxCooldownMs,
        getEligibleAuthIndices: () => connected,
        maxConcurrentPerAccount: 1,
        now: options.now,
    });
    return {
        balancer,
        setConnected(indices) {
            connected = indices;
        },
    };
}

test("403 冷却按倍率升档，并在 maxCooldownMs 处封顶", async () => {
    let now = 1_000_000;
    const { balancer } = createBalancer({ now: () => now, cooldownByStatus: { 403: 30000 } });

    const expectCooldownFor = async (expectedMs) => {
        const lease = await balancer.acquire();
        lease.release({ status: 403 });
        const state = balancer.getSnapshot().accounts.find(a => a.authIndex === lease.authIndex);
        assert.equal(state.cooldownUntil - now, expectedMs);
    };

    await expectCooldownFor(30000); // 第 1 次
    await expectCooldownFor(60000); // 第 2 次
    await expectCooldownFor(120000); // 第 3 次
    await expectCooldownFor(240000); // 第 4 次
    await expectCooldownFor(300000); // 第 5 次：480s -> 封顶 300s
    await expectCooldownFor(300000); // 继续保持上限
});

test("成功释放后升档计数清零，回到基础冷却", async () => {
    let now = 1_000_000;
    const { balancer } = createBalancer({ now: () => now, cooldownByStatus: { 403: 30000 } });

    for (let i = 0; i < 3; i += 1) {
        const lease = await balancer.acquire();
        lease.release({ status: 403 });
    }
    let state = balancer.getSnapshot().accounts[0];
    assert.equal(state.cooldownUntil - now, 120000);
    assert.equal(state.consecutiveCooldowns, 3);

    // 等冷却过去后成功一次
    now += 200000;
    const lease = await balancer.acquire();
    lease.release({ status: 200 });
    state = balancer.getSnapshot().accounts[0];
    assert.equal(state.consecutiveCooldowns, 0);

    // 再 403 时应重新从基础冷却开始
    const next = await balancer.acquire();
    next.release({ status: 403 });
    state = balancer.getSnapshot().accounts[0];
    assert.equal(state.cooldownUntil - now, 30000);
});

test("全部账号都在冷却时回退到最快解冻的账号，而不是直接失败", async () => {
    let now = 1_000_000;
    const { balancer } = createBalancer({
        connected: [0, 1],
        now: () => now,
        cooldownByStatus: { 403: 30000 },
    });

    balancer.markCooldown(0, 403, 30000);
    balancer.markCooldown(1, 403, 120000); // #1 解冻更晚

    // 两个账号都不可用，但请求仍应拿到账号（避免前端 503）
    const lease = await balancer.acquire({ timeoutMs: 40 });
    assert.equal(lease.authIndex, 0);
    lease.release({ status: 200 });
});

test("粘性请求（requirePreferred）在目标账号冷却时仍然等待，不回退换号", async () => {
    let now = 1_000_000;
    const { balancer } = createBalancer({
        connected: [0, 1],
        now: () => now,
        cooldownByStatus: { 403: 30000 },
    });

    balancer.markCooldown(0, 403, 30000);

    await assert.rejects(
        () => balancer.acquire({ preferredAuthIndex: 0, requirePreferred: true, timeoutMs: 40 }),
        /timed out waiting|no account slot/i
    );
});
