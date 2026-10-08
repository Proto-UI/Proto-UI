# 上游认证故障定位与六次补充执行授权包

日期：2026-10-05。性质：本地脱敏诊断与待授权计划，不是新的受测结果、认证恢复声明或可执行冻结包。当前用户授权本地只读定位与准备；未授权修改认证、调用上游诊断接口或 dispatch 补充实验。

## 本次边界

- 原批次保持 4/9 dispatch、3 次可评分、1 次失败、5 槽未运行；原第 4 次 `token_revoked`、原 ledger 的 `usage-ambiguity-stop`、原结果和全部 raw/receipt 不改。
- 故障分类为上游认证故障。这是在新记录解释故障，不回写原停止字段，也不改任务、材料、八条 claims、15 项指标、receiver、oracle 或 Proto 规范。
- 不重置用户 Codex 登录、不自动切换路线、不修改 API key、不复制或输出 token、不重复发送实验请求试错。
- 当前只读本地数据库、日志及已有证据；新增受测 dispatch、认证写入、认证网络诊断、浏览器或管理端操作均为 0。查阅过公开 CC Switch 源码页面，它不是认证诊断调用；未绑定安装版本，不用该页面认证具体运行行为。

## 认证链与归属

| 层 | 本地证据 | 能确认的管理边界 | 不能确认的事项 |
| --- | --- | --- | --- |
| 实验客户端 | 原冻结 `nine-live.mjs` 从 `~/.codex/auth.json` 的 `OPENAI_API_KEY` 取得 HTTP Authorization；本次不读取该文件或输出值 | 本地用户／CC Switch provider 配置 | 没有证据说明用户 Codex 登录或此本地 key 已被撤销 |
| 本地 CC Switch 代理 | `127.0.0.1:15721/v1/responses`；当前路线 fingerprint 与原冻结一致；forwarder 在失败请求时间把请求指向相同 upstream URL | 本地代理配置管理者 | HTTP 200 不证明上游模型成功，也不证明 OAuth 有效 |
| yvxi 上游／其后端认证 | 原第 4 次正文明确 `upstream_error`、`token_revoked`、invalidated OAuth token；当日该 provider 的历史 forwarder 警告也报告 invalidated OAuth token | 控制 yvxi 网关或其后端 OAuth 账户存储的人负责排查、刷新或重新授权 | 具体人、具体账户、实际失败的后端 hop、刷新机制均未知；也可能是网关转发另一后端的错误 |

本地 provider 配置投影的 auth 字段只有 `OPENAI_API_KEY`；这不等于认证了其实际值的类型，也不排除服务器内部采用 OAuth。读取 provider 配置时，完整 settings JSON 只在只读投影进程内部解析；没有提取、显示或归档 credential 值，没有读取 `~/.codex/auth.json`，也没有使用凭据发起请求。当前 provider 为 `yvxi`，上游为 `https://doesvm.icefish-exponential.ts.net:8453/v1`，autoFailover 为 0；只读路线 fingerprint 仍为 `20ce7fea8ee549cd72fc524b1c09a80b78d3a2bea9c8b0d956c14f89952d554e`。

**定位结论：故障域指向配置的 yvxi 上游认证，而不是默认归因于本地 Codex 登录。精确 OAuth 账户和实际凭据管理者不能仅凭本地证据确认。** 要由管理该上游服务认证的人提供服务端证据，不要求在聊天中提供 token。

## 时间关联与不混淆的证据

原第 4 槽开始 `2026-10-05T13:27:13.910Z`，结束 `2026-10-05T13:27:35.054Z`，即上海时间 21:27:13.910–21:27:35.054。完整原始响应 151 bytes，HTTP 200，无 terminal、assembled delivery 或 usage。

CC Switch 本地日志 `cc-switch.log` 中：

- 行 23282（21:27:13）出现 forwarder、该模型与 upstream `/v1/responses` 路径的配置转发证据。
- 行 23119（21:14:19）出现 `yvxi`、401、invalidated OAuth token 的历史请求失败证据；这是另一请求，不是原第 4 次 HTTP 状态，也不是本次新增诊断。
- 当日还有更早的同类错误。它们只能支持存在上游认证故障史，不能证明当前恢复、持续故障、某账户的身份或整个账户池状态。

本地 `proxy_request_logs` 在 21:27:35 有候选匹配行（request id `b47e4157-6381-4236-be52-495877c49752`，相同 provider/model，latency 21135ms），status 200、input/output 0、无 error_message。这是时间／模型／延迟关联，不是凭原始响应 ID 精确绑定。**这些零值不能回填实验 usage**：原响应没有 usage，实验 ledger 保持 unknown。前 3 次成功 usage 可与已保存 response ID 及 token 量关联。同一时间窗口有其他协调器会话流量，不能统算成实验调用或把它们的成功当成故障恢复证明。

## 最小认证恢复操作：由正确管理方实施

1. 先确认 yvxi 上游由谁维护，以及谁能访问该网关／后端 OAuth 账户的管理界面或认证日志。本地 evidence 不认证一个具体人。
2. 让该管理方围绕上述 UTC/上海时间、错误码和模型，定位实际失败账户／后端；只返回脱敏的账户代号、错误来源、恢复操作类型和时间，不返回 access/refresh token。不得默认注销整个用户账户池或更换实验路线。
3. 若服务端确认该 OAuth 凭据已失效，最小候选操作是刷新该服务端账户认证；只有其具体软件／错误要求重新授权时，才重新授权该具体账户。现在未确认管理 API 或软件版本，不能给出可信执行命令或宣称 refresh 一定可行。
4. 这不是重置本机 Codex 登录或盲目更换 `OPENAI_API_KEY` 的授权。如果管理员另有证据要求本地 key 轮换、网关重启、批量账户操作或线路变化，先说明理由和独立授权范围，不自动做。

目前未访问服务器、未发送给供应商、未使用管理凭据；实际操作需要由其管理方实施，或用户明确授权一项可执行的最小管理操作。不要在聊天或实验证据中提交任何凭据值。

## 拟议诊断调用：单独授权、最多一次

管理员确认恢复后，建议只做 **1 次非实验、无任务上下文的端到端认证 smoke**。它不是重发原第 4 槽，不计入六次 participant 样本，也不能作为文档条件效果证据。

- 同一 `yvxi` 路线与 `/v1/responses`，同一 alias `gpt-6.1-sol`；不切换 provider，不启用 failover。
- 唯一输入为 `Reply exactly OK.`，无 task、starter、Proto/ordinary 文档、历史输出或评分；`stream=true`、`store=false`、`tools=[]`、`tool_choice=none`。
- 为避免另设一次参数组合，沿用原 `max_output_tokens=8192`，temperature/top_p/reasoning/service_tier/seed 仍省略。期望输出很短，但有效 cap 和实际上游计费仍未认证，不承诺固定金额。
- 客户端上限 1 次 dispatch、0 重试、180 秒，raw response 上限 4MB；只保存去掉 Authorization 的请求、raw、可得组装、usage、耗时和异常。
- 只有可接纳终态、无认证错误、有效 usage、alias 与原可得返回设置没有实际变化才记为 smoke 通过；HTTP 200 或仅 `GET /models` 不作为恢复通过标准。通过也只是一个时间点的端到端证据，不认证后台所有账户池或内部重试来源。
- 一次失败／超时／不可接纳即停止，不换路、不循环探测、不发实验请求探测。该诊断有潜在 token/费用；代理配置 maxRetries=3，不把一个客户端 dispatch 冒称只有一次 upstream invocation。

这项调用目前**未授权、未执行**。费用限制已移除的既有决定不自动代替对此额外诊断的具体授权。若用户不批准该 smoke，记录缺少端到端恢复验证；不能说认证已经验证恢复，也不能自行把补充第一槽当诊断。

## 六次补充执行计划（尚非执行就绪冻结）

补充批次使用新的 attempt ID 和目录。它引用原 frozen-v1.2 和原结果，不原地 resume、清零或覆盖旧 ledger。原第 4 次失败保留；补充第 1 次只是关联同一原计划槽的一次新尝试。

| 新尝试                 | 原槽次序 | 原槽 ID          | 条件     | 原记录状态    |
| ---------------------- | -------: | ---------------- | -------- | ------------- |
| supplement-1-attempt-1 |        4 | block-2-proto    | proto    | failed，保留  |
| supplement-1-attempt-2 |        5 | block-2-ordinary | ordinary | not-run，保留 |
| supplement-1-attempt-3 |        6 | block-2-none     | none     | not-run，保留 |
| supplement-1-attempt-4 |        7 | block-3-none     | none     | not-run，保留 |
| supplement-1-attempt-5 |        8 | block-3-proto    | proto    | not-run，保留 |
| supplement-1-attempt-6 |        9 | block-3-ordinary | ordinary | not-run，保留 |

固定顺序 **proto → ordinary → none → none → proto → ordinary**，不根据前三次同分重新随机、不删除原失败。三条件 request SHA 保持：

- ordinary：`0238e671cde22129f691064410ca13fce2e8811adf6d0fdbfa29b10dca1b4b83`。
- none：`a5c5f143885820f5ee64599d6ff9fa581cdd1767a2efe57258af053d9fad1ed1`。
- proto：`ae8361d4305583ae77d633b975c57298f165458ef82e8a7632433067ca285753`。

六次各自独立请求，只带同一冻结 task/starter 和对应条件材料；none/ordinary 不接触 Proto 文档、前次输出或协调器/审查上下文。仍使用同一 receiver、oracle、6 项新功能和 9 项回归。

- 最多 6 个新 participant dispatch／reservation，0 客户端重试、0 补位、0 discovery。
- 原非费用政策继承：每次 180 秒、browser 60 秒、整个串行窗口 30 分钟、raw 4MB、deliverable 1MB；缺失／无效 usage、返回超 cap、归档不完整、worker/evidence/cleanup 失败及来源／路线／身份／设置 drift 按原政策处理。
- 费用限制继续移除、不充值；参考费用只用于描述，不停止。内部缓存、重试、实际费率及不可变版本仍 unknown，不因这些供应商内部 unknown 额外扩展准备。
- 原前三次可得 alias/返回设置作为外部设置比较基线，不作为 participant 上下文；实际跨阶段设置变化不能仅因新批次重新建立基线而被悄悄忽略。
- 诊断的 usage/费用与六次实验分开记录；若六次全 dispatch，原批次加补充共 **10 次真实 participant 尝试**（包含原失败），不是把原失败擦掉后的九次尝试。按两批逐次表与完整尝试 ledger 展示；任何合并描述均注明中断和补充，不恢复成原九次连续随机运行的因果设计。

现有 `nine-runner.mjs` 和 live grant 验证硬绑定九槽，不能拿原九次 grant 来伪装六次补充或改写原 manifest。**认证恢复后**，仅增加最小六次执行封装及执行前修订：绑定父材料／字节、上述六槽、执行源码、路线／配置、设置比较基线、预算／停止政策和新的具体授权，使用新的空归档目录，并做标记清楚的离线合成端到端演练。演练不增加受测调用、不改任务/oracle；完成后才称执行就绪。本记录和 `supplement-proposal.json` 都是 `approved=false`、`executable=false` 的 proposal，不是 dispatch 权限。

## 需要的授权（分层，不把费用接受当所有权限）

1. **认证恢复**：确认管理方和可执行的最小 OAuth 修复操作；若由管理方自行恢复，只需其脱敏恢复回执，不要求本机登录变更。
2. **诊断**：明确批准上述同路线最多一次非实验 smoke、零客户端重试、接受其可能 token/费用和 unknown upstream retry；失败后停止。
3. **补充执行**：认证恢复和执行就绪冻结校验后，批准上述六次新尝试，接受原非费用停止政策、零重试／补位、原失败永久保留。此授权不包含额外诊断、充值、换路线、更多样本或 broad conformance。

当前最小需要用户确认的是：**yvxi 上游由用户自己维护，还是由另一位管理员／服务商维护？** 不要提供密钥。没有这项管理归属信息，无法指定可信的服务端修复动作；不为绕过它而发送更多请求。

## 本地证据与交付

证据根目录：`/Users/yangguangliang/.codex/experiment-artifacts/2026-10-05-noncompiler-value/auth-diagnostic-v1`。

- `diagnosis.json`：故障层、管理边界、unknown 和零新增认证／受测操作。
- `provider-config-shape.json`、`current-route.json`：配置字段形状、无 credential 值的当前路线投影。
- `failure-window-log-events.json`、`forwarder-selected-patterns.json`：固定字段/固定标签脱敏日志投影，无原始行、auth header 或任意 response body。
- `proxy-window-rows.json`：限定时间窗的日志投影，包含并明确区分其他协调器流量；不是模型调用证据的唯一来源。
- `supplement-proposal.json`：六槽映射、父 hash、预算／停止原则和待授权边界。
- 独立窄复核和比例文档校验将作为该目录独立文件交付，不回写原结果。

原结果根目录 `/Users/yangguangliang/.codex/experiment-artifacts/2026-10-05-noncompiler-value/nine-run-live-v1` 保持不变；原任务、材料、oracle、source pins、frozen-v1.2、ledger 与归档未修改。未 commit/push，未外部发布，未联系管理方。
