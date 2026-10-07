# Shadow split S5：原生文本输入准入

本记录是阶段目标、实现决策和待验证计划，不是稳定保证。用户批准以 S5 为目标持续实施，在人工验收前授权同等规模决策和本地节点提交；不包含 push、发布或稳定性提升。

## 目标与边界

现有 Base Input、Base Textarea、Shadcn Textarea，通过正式 WC Adapter 和 CLI companion，在 Light / split / mixed 独立场景及 Tabs 中可供验收。覆盖单一原生编辑器、value、受控提案拒绝、IME、selection、focus、a11y、disabled/readOnly、主题与尺寸、重复 view 卸载/重建和 terminal reconnect。保留 S1–S4 回归。

不新增 Shadcn Input、Form、validation、富文本、auto-resize 或 selection API；不实现 Image View，不修改 style token 作者语法，不将 draft 提升 active。Dialog 快速重开 mask 失效独立归属 #645，不作为 S5 修复内容或前置依赖。

## L1：单一原生 surface

依据 draft `C-TEXT-CONTROL-0001-H`，原生 input[type=text] / textarea 同时是编辑引擎与唯一视觉表面，直接位于 open ShadowRoot，公开 `part="control surface"`。host 保持逻辑 boundary，复用现有 native value、event、focus、a11y wiring，不添加第二个绘制 div 或通过复制内容模拟输入。

备选的通用 div 包装会分离编辑 chrome 和视觉表面，违背现有契约，因此不采用。原生 target 的对象身份可以 owner 内保留，但 DOM 挂载和 listener/reference lease 必须随 view 撤销并重建；普通 props/style commit 不重新插入 editor，不破坏 selection/IME。stylesheet/environment 仍归 owner。原生 surface helper 是内部实现，不新增公共选项。

## L2：原生尺寸 recipe

先保留原生编辑器的 intrinsic sizing、rows 和 UA 编辑行为，避免把普通 div surface 的 grid stretch / 负 margin 补偿机械套用于原生控件。尺寸 recipe 从相同生成式 token 和条件产生，不能基于逐帧测量、MutationObserver 或页面修补。具体 CSS 拆分由真实 Chrome 比对验证；若发现通用 token 不能提供等价性，应收窄并明确拒绝，不猜测扩大支持。

旧 v1 companion 必须通过私有 native recipe receipt 检测并明确拒绝；ABI 不变，只需重新生成。保留普通 Root 的既有 recipe 及 Image View 拒绝。任意 document reset、raw CSS、::part 和 surfaceStyle 的尺寸覆盖继续是 escape，不承诺任意 CSS 尺寸等价。

## 节点与证据

1. 记录目标与决策（本节点）。
2. 修订 draft profile 的 text-control 准入，增加 native surface / lifecycle / old-artifact 拒绝证据；实现并本地提交。
3. 正式生成产物 + 真实浏览器覆盖 native value / composition / selection / AX / geometry；制作 Light / split / mixed + Tabs S5 demo；本地提交。
4. 回归、文档与验收记录；交付 `#shadow-split-s5`。自动 composition 只验证协议和浏览器编辑状态，不能冒充真实系统 IME 人工验收。

实际测试结果、偏离与剩余限制在后续记录中追加；当前仅为批准的目标和待执行计划。
