# MakerSuite schema 编码与源码集成

本次改动直接复用项目现有的格式转换器和 MakerSuite 编码器，没有新增独立服务、代理程序、端口或运行时依赖。

## 请求路径

OpenAI Chat Completions、Responses 和 Claude Messages 的工具声明经由 `src/core/FormatConverter.js` 中的 `_convertSchemaToGemini()` 转换。原生 Gemini 工具声明由 `sanitizeGeminiTools()` 复用同一个转换函数，覆盖 `functionDeclarations`、`function_declarations`、`parameters` 和 `parametersJsonSchema`。

转换结果继续进入 `src/core/MakerSuiteCodec.js` 的 `buildBody()`、`encTools()` 和 `encSchema()`。账户选择、鉴权及浏览器桥接仍由原项目负责。

## 字段依据与边界

字段位置来自已保存的 Google AI Studio 前端 bundle，版本标识为 `JLBvzaeCXqM.2018`。其中 `_.al` 为 Schema 消息，`_.Vk` 展示其字段读取位置；`MXa` 将 Schema 写入生成配置的字段 9，`QXa` 将 seed 写入生成配置的字段 19。

[对应的 Google 前端 bundle](https://www.gstatic.com/_/mss/boq-makersuite/_/js/k=boq-makersuite.MakerSuite.en_US.JLBvzaeCXqM.2018.O/am=AaRKgIHgEA/d=1/excm=_b/ed=1/dg=0/wt=2/ujg=1/rs=AMOXD28TXvfRTu02iapAh4ulgskYyMojcA/dti=1/m=_b) 的 SHA-256 为：

```text
6f89b08a8168b2f7f9794380abdc81e5941a7cb26e3adf9401d60d50d36cc98c
```

下表为 protobuf 字段号，位置数组下标为字段号减 1。这些是前端代码中观察到的映射，不是公开稳定的 Google API 合约，也不证明每个模型都接受或执行全部约束。

| 字段号 | Schema 字段 | 编码形式 |
| --- | --- | --- |
| 1 | `type` | 原生类型枚举 |
| 2 | `format` | 字符串 |
| 3 | `description` | 字符串 |
| 4 | `nullable` | 布尔值 |
| 5 | `enum` | 字符串数组 |
| 6 | `items` | Schema |
| 7 | `properties` | 名称与 Schema 的键值对数组 |
| 8 | `required` | 字符串数组 |
| 9 | `minProperties` | 十进制整数字符串 |
| 10 | `maxProperties` | 十进制整数字符串 |
| 11 | `minimum` | 有限数值 |
| 12 | `maximum` | 有限数值 |
| 13 | `minLength` | 十进制整数字符串 |
| 14 | `maxLength` | 十进制整数字符串 |
| 15 | `pattern` | 字符串 |
| 16 | `example` | 原生 Value |
| 17 | `oneOf` | Schema 数组 |
| 18 | `anyOf` | Schema 数组 |
| 19 | `allOf` | Schema 数组 |
| 20 | `not` | Schema |
| 21 | `maxItems` | 十进制整数字符串 |
| 22 | `minItems` | 十进制整数字符串 |
| 23 | `propertyOrdering` | 字符串数组 |

数量和长度约束只接受非负 JavaScript 安全整数，再转换为 protobuf JSON 的 int64 字符串。`generationConfig.responseSchema` 使用同一编码器，`generationConfig.seed` 限定为有符号 int32。

## 转换行为

- 保留 `anyOf`、`oneOf`、`allOf` 和已映射的数值、长度约束，不再将联合类型降为首个分支。
- 将 JSON Schema 的多类型数组转换为 `anyOf`；与已有 `anyOf` 同时出现时，通过 `allOf` 保留两组条件。
- 将可空类型数组和联合中的 null 分支转换为 `nullable`。仅允许 null 的 schema 明确报错，不替换为字符串或对象。
- 保留名为 `type`、`properties` 等关键词的用户属性。
- 延续原有结构化输出枚举转字符串的行为，并消除其对输入键顺序的依赖。这不等于保留数值枚举的原始语义。
- 将 `enumDescriptions` 合入描述；移除没有对应字段的展示性元数据，如 `$schema`、`title`、`default`。
- 解码工具调用参数时，原生 Struct 的 `[]` 和 `[[]]` 都得到空对象；畸形键值对仍报错。

## 统一上游白名单

四种 API 协议只负责把消息、工具及结果转换为统一 Gemini 结构；最终由 MakerSuite 编码器只读取已映射的字段。未知的请求参数、生成选项、工具元数据和 schema 关键字默认忽略，不再因为 Agent 平台的扩展字段报 400，也不增加按客户端名称判断的分支。

- `additionalProperties`、`$ref`、`const`、`multipleOf` 等未映射关键字不发给上游；仅有引用而无实际结构的 schema 不会自动展开。
- 未映射的内置工具会被跳过，普通函数工具继续保留；不保证内置搜索等扩展能力可执行。
- 未映射的工具选择设置回退到上游默认 AUTO；未知 thinking level 不发送。
- 白名单只过滤协议字段，不过滤 `properties` 中的用户属性名、函数调用参数及工具结果中的业务键值；不会修改原始请求对象。
- 已支持核心字段的类型、范围和必要内容仍进行校验。空消息、缺失函数名、畸形工具参数仍报错，而非伪造成功。

兼容不等于严格等价：被忽略的约束、强制工具选择与扩展功能不会在上游生效，严格校验和工具执行授权仍应由客户端负责。既有桥接仍缓冲上游响应，并非真正逐 token 生成。

## 空响应与等待预算

上游偶尔返回带 `finishReason` 但没有正文、思考或工具调用的候选。此前这种响应会被当作成功，客户端只收到一个空的 `[DONE]`，表现为“模型未返回正文或工具调用”。现在空完成会作为上游失败返回 503，触发换号重试；重试耗尽后客户端收到明确错误，而不是伪造的成功。

MakerSuite 传输会缓冲整段生成，首条内部消息只在生成结束后到达。此前负载均衡路径沿用 45 秒“首次响应”窗口，导致约百万 token 的请求在 18 至 108 秒的正常生成时间内被判定 504 并反复换号。缓冲传输现在改用生成预算（默认 300 秒），非缓冲路径仍保留 45 秒窗口。

生产镜像 `aistudio-to-api:fork-integrated-tools` 实测：`gemini-4-hydrogen` 生成用时 51.7 秒、输出 31320 字符，返回 HTTP 200 且未检测到错误。同一镜像下，pi 四种格式、Claude Code 和 Codex CLI 六项工具闭环全部通过；另用 Claude Code 默认工具声明集、仅预授权 Read 完成一次文件读取闭环。桥接仍缓冲上游响应，这不等于已实现逐 token 流式生成。

## 回归检查

在项目根目录运行：

```sh
node --test tests/makersuite-schema.test.js
npm test
git diff --check
node --check src/core/FormatConverter.js
node --check src/core/MakerSuiteCodec.js
```

新增测试文件检查字段位置、Struct 往返、空参数工具调用、非法核心字段、类型联合、键顺序、属性名、四种接口的统一白名单、业务数据保留、结构化输出和 seed 边界。

自动回归测试使用本地数据与模拟响应，不发起 Google 模型请求。自动测试通过不能证明上游接受全部字段；真实客户端与线上验证另列于下节，不能用自动测试数量替代。

## 实测范围

隔离运行环境中，使用 `gemini-3.5-flash-lite` 完成 pi 的 Chat Completions、Responses、Claude Messages、Gemini 四种格式，以及 Claude Code 和 Codex CLI 的文件读取闭环：真实工具执行读取 `sample.txt`，随后将工具结果回传模型并得到正确 fixture 值。六项客户端用例全部成功。Codex 对非官方模型仍显示模型元数据回退提示，但该提示没有阻止工具调用与最终回答。

最终源码自动测试通过 166 项，0 失败；镜像构建成功，并已替换 412 上原容器。生产复测使用 `gemini-4-hydrogen`，六项客户端测试全部成功，另通过 Claude Code 默认工具声明集的 Read 闭环与一次超过 45 秒的长生成。核心四份源码的容器内哈希与工作树一致。

这些结果不代表全部模型、任意 Agent 功能、长对话、多模态与所有内置工具均已验证，也不代表已重放用户原始的 38 工具大请求。默认工具声明集测试仍仅执行了 Read，未授权其他工具执行。详见 [生产兼容性验证报告](makersuite-production-verification.md)。
