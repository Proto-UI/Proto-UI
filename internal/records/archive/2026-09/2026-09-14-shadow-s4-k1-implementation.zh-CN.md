# S4 K1：完整 Dialog 准入与居中动画

日期：2026-09-14。状态：bounded implementation evidence，non-normative；S4 尚未可验收。

基于 `8626c007` 的批准方向，Core 精确准入两个负半尺寸位移为 root-geometry；CLI 将 Dialog enter/exit 的整体变换与 surface opacity 分解为同源 keyframe，保留同一时长、条件与合并来源；WC 在完整 Root effect 修改前验证 K1 recipe，旧 companion 或未支持的 slide 组合明确拒绝。Public artifact v1 ABI、作者 API、Light/direct profiles 与 draft lifecycle 不变。

## 证据

- 新增 Core 与 WC 测试先观察到 5 个预期失败（缺分类、缺 recipe）；实现后通过。扩大到旧 classifier 测试时，发现仍要求负半位移 unresolved 的旧断言，现用尚未准入的负 1/3 位移保留 family 边界。
- `scripts/analysis/shadow-s4-admission-browser.mjs` 使用公开 dist 与网站真实 CLI companion，不解析 package source aliases，也不删改官方原型 token。首次运行复现完整 split Content 拒绝。
- Chrome 152.0.7977.83 / Node 22.23.2：完整 Shadcn Dialog 的 Light、split、mixed（Content 仍 split）通过；42 个自然 entering/leaving/reversing 帧验证中心、surface 对齐、整体缩放/透明度同步与中心 native hit。1000×800 转为 480×700、描述换行、打开期间 document dark 更新及外部受控关闭归位通过。普通初版的原生 Trigger/Escape 路径也在扩展测试前通过。
- `shadow-s2-motion-browser.mjs` 的 H1 204 帧、nested scale/Thumb travel、命中与绘制回归通过。K1 此处未声称任意 transform origin、slide、任意 keyframe 或所有浏览器支持。
- `T-FEEDBACK-STYLE-ROLE-RESOLUTION-0001` 增加精确分类、原子 recipe 与浏览器实现映射；S4 的 AX、focus loop、完整设置区与 owner cleanup 不由本节点证据覆盖。

## 后续已复现问题

运行 `PUI_S4_SYNC_DISMISS=1 node scripts/analysis/shadow-s4-admission-browser.mjs` 可复现同步受控关闭回写后 Content 仍在 body、transitionState 为 entered 而 open 已 false 的问题，Light 也存在。默认几何测试由外部 setElementProps 关闭，不借助内部 exposed transition controls；同步 dismissal 路径保留为显式待修复诊断，不算通过。

下一节点先对该 reentrancy 路径缩小复现并修复，再覆盖初次准入失败后的清理与完整组合。本记录不把一个 Root 的投射回滚扩大为跨实例事务，也不接管父级 open 所有权。

规范节点检查中已观察到无关 Context fixture 的 CASE-REENTRANCY 对齐失败（相关文件未被本节点修改）；保持隔离，不以此宣称全仓库测试通过。具体最终验证结果随本节点 handoff 保存。
