# Sprint 6：Modal、Progress 与 Liquid readback 交付记录

日期：2026-11-23

## 本轮实现与范围

本轮继续 PR #1712 的 Bootstrap / Liquid 工作。保留另一会话的 Text 提交 `1fda38f3660470128bb12c991a0d2877f7fa5d08`，没有把尚缺配对收益样本的 e9 解码缓存实验并入。Readback 提交为 `701206bbd82972078b144d1565d13007f5b62a6f`；Motion 初始提交为 `ccde9d192b2dcb7f51b9ec417435fc14b3fd7a65`，随后单独修正工作流格式稳定性与既有 Dropdown evidence 索引断言。整合源码 HEAD 见配套 manifest，main 原有历史通过普通 merge 保留。后续公开包门禁提交 `731d00cd615dc7077f2174c84315e8730d9470d0` 只增加显式选择的 CI matrix 与验证 helper。

- **Liquid readback：**在既有 4 MiB 准入上限内复用只增长的 RGBA backing store，每轮仅向 GL 与 contrast scan 提供当前精确长度的 view；clear、context loss、dispose 释放存储。计数衡量 backing allocation，没有声称每帧零对象分配或物理性能目标达标。
- **Dialog / AlertDialog：**增加独立于 own-box translate 的 typed containing-block top、每通道 easing 与真实 source-Web adoption。Content 从 -25% 到 10%，top 300ms ease-out、opacity 300ms linear；Mask opacity 0 到 0.8，150ms linear。Base 继续拥有唯一 duration、deadline、State 与结束次序。
- **Portal：**Presence 释放到原两帧 detach 之间保留隐藏和同步事件门控，支持 barrier 内快速重开。清理按实际 CSS 声明及 priority 归属恢复，保留外部接管；同步重入先退休旧 owner，独立清理失败可以重试。
- **Progress：**精确绑定同实例已注册 numeric State，增加 typed px、root-text 与 containing-block width，600ms CSS ease。State 立即更新，仅 presentation 动画；宿主拒绝、外部 `!important`、缩小范围、reduced motion 与释放保持限定准入。宽度 lease 在 setter 前登记，清理不凭近似数值认领外部声明。

这些能力按既有 draft definition 增补实现与测试关系，没有宣布新稳定保证。Modal 目前的 native 正向证据范围是 WC document；Progress 是 document 与 direct Shadow。Experimental split 明确拒绝，不计作正向视觉实现。

## 实际执行结果

以下是各轮真实执行，不能统一改标为整合后的 HEAD。原始 JSON、日志、退出码、已有 source hashes 和 screenshots 保存在同目录证据档案中。

| 验证 | 结果 | 适用范围 |
| --- | --- | --- |
| Readback 负控与回归 | 旧实现 111/114，新实现 114/114 | 三个新增回归在旧实现真实失败。 |
| Portal / width ownership 负控 | 旧生产代码配新测试：43 项中 31 通过、12 失败 | 保留原始失败，不删除断言。 |
| 修复后的相关 ownership 回归 | 129/129，零 skipped / todo | 这一组与下述 11 文件的 motion 129 清单不同。 |
| Modal native r2 | 6/6 | Dialog、AlertDialog 各自 enter/close、leaving reversal、closed-barrier reopen；真实浏览器和源码样式。后续 Portal 清理修复仍须最终 CI。 |
| Progress native r2 | 六个正向场景通过，unsupported negative fixture 当轮失败 | document/direct Shadow 各三场景。最终 v5 负控未在本地取得完成结果。 |
| 最终本地 motion 运行 | 11 文件、129 项：116 通过、13 skipped | 两个 browser suite 在原 30 秒 beforeAll 内超时，native 行为断言未执行，strict artifact gate 正确失败。 |
| CLI build / website generator / workspace TypeScript | 退出码均为 0 | 真实构建与官方生成，没有手写 companion stub。 |
| Source / motion / inventory 门禁 | 178/178，零 skipped / todo | 其中新增负控证明旧 TAP 聚合器会误接受一条实际 case 加“六项通过”的 footer；修复后必须有六条 case。 |
| CI policy / scheduling | 70/70；schedule audit 退出码 0 | 工作流结构与调度约束。 |
| YAML / Bash | 两个 jobs、26 个 Bash run 块解析通过 | 不等于 CI 已执行。 |
| Spec graph | 37/40，三项原 5000ms 超时 | Dropdown 原断言修复已通过；其余三项需在干净 CI 按原预算验证。 |
| Spec authoring | 退出码 0 | 保留实际检查输出。 |
| 公开包门禁接入后的回归 | 188/188，CI policy 70/70，三个 job definitions / 29 个 Bash 块解析通过 | 包含十个新的执行证据负控；不是实际 package build / consumer 的通过声明。 |
| 工作流格式修复 | 两次 Prettier 输出一致，解析后的整个 workflow 等价，178 条门禁再次通过 | 避免 folded JSON scalar 每次格式化多出空行。 |

本地最终 motion 超时发生在已观察到严重 I/O 压力的共享执行环境。它不能证明产品回归，也不能算通过。Content 300ms、Mask 150ms、Progress 600ms、12ms/8ms 比较阈值与 30 秒 native setup 预算均未放宽。

旧 Modal r1、Progress r1/r2、原 spec graph 断言失败及 TypeScript 缺少生成前置物的失败均保留。之前没有得到完整运行的轮次不补造结果。

## 最终 CI 的接入

`.github/workflows/bootstrap-state-controls-evidence.yml` 继续保留原 controls、Navbar、Button 验证，并加入：

1. **Motion lane：**精确 11 文件、129 assertions，包含 12 个 native 正向场景及一个 split 预期拒绝。实际 case 身份、去重、skip/todo、退出状态、前后 clean HEAD、源文件/bundle/CSS 摘要、PNG 尺寸与哈希、独立 capture intervals、嵌套 capture/disposal 错误全部进入 strict gate。
2. **Source validation job：**真实 locked install、CLI build、网站生成、type contracts、workspace tsc、40 个 graph assertions 和六个 public draft consumer assertions。每个 command 与 tee 退出码、各步骤 outcome 和执行日志必须完整，终态失败仍上传证据。

3. **Public package matrix：**以 boolean `validate_public_packages=true` 显式选择 build / React / CLI 三组，保留原 20 / 20 / 15 分钟预算与 `fail-fast: false`。完整 public build、manifests、budget policy、strict whole-entry budgets 以及两个当前 tarball consumer 都执行 canonical 命令；前后 clean source、command/tee/pipeline 状态、原始日志摘要与终态 step outcomes 必须一致。两个入口默认 false，原生产周期继续使用其现有公开包 gate，不重复选择这三组。React 是隔离 Vite/synthetic 消费验证；CLI 的既有系统 Chrome native fixture 不能跳过。

整合后官方 Brutalist 与 draft-family 生成器及各自 check 均退出 0，工作树未产生漂移。该执行绑定 `a6e16060a442a82ccac5b63e4a307b053c76f51c`；后续差分只有三条 CI/helper 路径，生成器及产品输入保持相同。

首次最终 HEAD 的 CI、完整 Liquid 11 分区、同源 baseline/candidate 配对和 Text/Select 原生结果，由实际 Actions run 与 PR 追加回读记录绑定。本文提交时不把 queued、skipped、旧 SHA 的绿色或截图当成最终验收。

## 来源与剩余边界

源码通过支持的 publisher 以实际 Codex 作者和 signoff 创建；原作者的 Text 与 main 提交未改写。Motion 初次 publisher 在提交已经创建后发现格式化空行造成 tree mismatch，真实失败及对象均保留；随后显式核对唯一差异并以独立格式修复提交收敛，没有把原未知回执冒称成功。

独立 agent 源审阅及其发现的 ownership / TAP 问题属于技术证据，不是 GitHub approval。PR 仍须由平台实际检查最终 DCO、CI、review、threads 与 mergeability。当前用户要求推进至 ready，不构成代替他人批准、豁免规则或自动合入 main 的授权。

重复跨 document 取消恢复的既有 Presence TODO 保留。Compiler 的显式 unsupported、更多 Web 宿主与变体、非 Web、物理 120Hz / input-to-photon、Apple 对照、物理 IME / AT、shenko / OpenGreendam 等真实应用义务保持原条件；本轮不关闭整条父 Issue。

## 原始证据

- [Manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint6-modal-progress-readback/manifest.json)
- [完整原始验证档案](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint6-modal-progress-readback/validation.tar.gz)

Manifest 列明每份归档文件的 SHA-256、实际报告计数及源码绑定。截图只辅助观察对应视口，动画时间来自原始 trace 与断言。
