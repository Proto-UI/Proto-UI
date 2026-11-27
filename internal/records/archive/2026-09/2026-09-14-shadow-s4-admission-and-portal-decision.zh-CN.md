# S4 首轮审计与 K1 待决策包

日期：2026-09-14。状态：observed evidence / proposed K1，non-normative，待用户决定；不代表准入或 S4 完成。

前提：`internal/records/2026-09-14-shadow-s4-approved-goal.zh-CN.md` 已在 `fde26fef` 提交。本记录保持目标中的语义决策门槛，不将目标批准当作具体 token 分类批准。

## 观察与可复核边界

- 源码：Base 和 Shadcn Dialog Content 均使用 `-translate-x-1/2`、`-translate-y-1/2`。Core 当前将两者判为 unresolved；CLI 已能生成普通 CSS，不意味着 split 已获准支持。目录 AST token 扫描不等于完整继承 closure 的运行时证明。
- 运行环境：Node 22.23.2 / pnpm 10.32.1 / Chrome 152.0.7977.83，独立 headless 页面、1000×800 viewport；未操作用户的 demo 页面。
- 临时浏览器诊断通过 esbuild stdin 引用公开 WC、Shadcn Dialog dist 与真实 `proto-ui-shadow-style.generated.js`，断言 bundle 不含 `packages/**/src`。加载网站实际主题与生成 document CSS，组合 Root、Trigger、Mask、Content、Title、Description、Close、CloseIcon、Header、Footer；没有删除 token 或替换官方原型。
- Light 与混合配置（仅 Content 为 Light，其余 split）可通过原生 Trigger 点击打开，Escape 关闭；无 pageerror。这个混合配置仅用于定位，不是完整 split 的替代交付。
- 全 split 初始关闭时未报错，但首次打开产生 `[WC split:shadcn-dialog-content] setup token "-translate-x-1/2": application role is unresolved`。Content 未产生 root-style 投射、仍隐藏；Root open 为 true，body overflow 为 hidden；随后 Escape 未改变这两个状态。第一个错误不能证明另一个位移或其余 closure 已通过。
- Light 与上述有效混合配置中，Content 的真实 `parentElement` 从 Root 变为 BODY；适配器提供的 `parentNode` 仍指向逻辑 Root。局部容器的 `--pui-background: rgb(210, 20, 30)` 在打开后变成 document 的 `lab(100% 0 0)`，关闭归位后恢复局部值。故逻辑归属保存并不保存 CSS 物理继承环境，而且这不是 split 独有行为。
- 定向 Vitest：`packages/adapters/web-component/test/dialog-overlay.test.ts`、`packages/adapters/web-component/test/shadow-split-prototype-admission.test.ts`、`packages/prototypes/shadcn/test/dialog.test.ts`，共 3 files / 11 tests 通过。它们不是完整 Shadcn Dialog split 的浏览器准入证明。

浏览器诊断为本轮临时内联脚本，尚无持久化的 S4 runner。上述结果是审计观察，不是长期自动回归或发布证据；正式实施应先保存可失败的公开消费测试。尚未验证 AX、完整 focus loop、动画中间帧/反向、关闭与移除清理的完整路径。

## 权威、信息路径与问题

1. 作者 token → Core canonical role → CLI recipe → WC 的 Root effect 验证与 host/surface 投射。`D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001`（draft）C/K 保留 unresolved/fail-closed，L/M 只准入 H1 精确几何集合，不能由 CLI 支持反推新分类。
2. Dialog open → Transition presence → Overlay portal/layer/modal/focus → 真实 DOM / AX。`C-AS-OVERLAY-0001`（draft）E/F/K 与 `C-LIFECYCLE-0008`（active）区分 presence、view 和 owner lifetime。单个 Root 的样式验证不构成整个组合的事务；当前准入错误后的残余滚动锁须另行覆盖，不宣称现有合同已经承诺任意组合错误的原子回滚。
3. Portal 保存 Context/Anatomy 的逻辑路径，但 CSS 变量依物理树继承；可选 colorSchemeSource 只提供配色模式及通知，不运输整套主题变量。`HC-PORTAL-0001` 仍是简略 draft，缺少通用主题运输语义。

## 推荐 K1：精确准入，保留物理环境边界

建议一次批准以下有界方向，具体实现按测试结果迭代；不是批准整个 transform/animation/portal 家族。

### 几何与动画

- 将且仅将 `-translate-x-1/2`、`-translate-y-1/2` 纳入 Root geometry / placement：以整个组件外部盒为百分比参照，在 boundary 生效一次，不仅移动内部表面。
- 官方 Dialog 的 fade/zoom 与居中形成一个有界、同源 recipe：保持居中位置、整体缩放与命中一致，不在 host/surface 重复位移或缩放；时长与方向从同一份 token/state 输入产生。倾向 boundary 承担整体几何变换，surface 承担视觉绘制；物理拆分不自动改变 `animate-*` 的 canonical surface 分类。
- 增加新 recipe 的可验证能力标记和缺失/旧 companion 的拒绝覆盖；不能只放开 Core 分类。普通 Light 与既有 boolean profiles 语义保持不变。
- 准入的反证条件：不同宽高/换行后中心漂移、过渡中途双重位移或命中错位、反向后保留错误终帧、嵌套 Root 继承父变换操作数。发生任一项不得宣称准入完成。

备选：只改分类并复用现有 surface 动画，证据不足；或改原型删掉居中 token，违反完整原型目标。不推荐二者。

### Portal 环境

- S4 维持与 Light 一致的真实物理继承：默认 body portal 使用目标位置的主题，官方验收使用 document 级共享主题并测试打开期间动态切换。
- 将局部祖先主题不自动随 portal 迁移作为明确边界和负向测试，不静默复制 computed styles，也不新增 author role/slot API。
- 若需要“局部主题随弹窗搬迁”，应另定显式环境通道、更新订阅与清理语义；S4 不顺带决定这个公共能力。

备选为自动快照/持续复制来源祖先变量，或新增 portal target/environment API；都会引入新的所有权、更新和清理问题，不推荐纳入本阶段。

### 错误与清理

把首次打开准入失败后的残余资源作为独立风险纳入回归：记录失败投射、验证消费者显式关闭/移除后的资源释放与可恢复性。不能用异常捕获隐藏无效组件，也不先承诺所有后代激活失败时自动回滚父级受控状态。若修复必须新增跨实例事务或自动改变 open 所有权，再返回人工决定。

## 批准后的实施与证据图

1. 为完整公开 Dialog 组合保存失败测试与 portal 物理继承基线；不借助内部 exposed controls 完成动画。
2. 按批准边界更新 `spec/decisions/D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001.yaml` 及必要的 `spec/contracts/C-HOST-SURFACE-PROJECTION-0001.yaml` / 关联测试映射，保持 draft。Core 分类、CLI recipe、WC 验证必须同步；不新增空 catalog 实体。
3. 实现几何/动画并测中间帧、动态尺寸、命中、反向与旧 companion 拒绝；审计清理。Portal 环境暂作为已知宿主行为和 S4 限定，不把记录变成通用 HC 保证。
4. 再接完整 S3 Tabs 设置区，检查真实 AX/focus/controlled dismissal/presence/重连，交付 Light/split/mixed demo 与人工路径并回归 S1–S3。

最小人工决定：是否批准上述 K1 的精确 Root 几何/动画准入方向，并接受 S4 默认 body portal 采用 document 主题、不自动携带局部祖先主题的边界？批准不包含任意百分比位移、任意动画、任意 portal target、跨 document、嵌套弹窗、通用错误事务、新公共环境 API、lifecycle 提升或任何外部写入。
