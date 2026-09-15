# I1 批准与实施边界

日期：2026-09-13。状态：user-approved direction，non-normative；不是 S3 完成或人工验收声明。

用户明确选择“采用 I1”，批准 `2026-09-13-shadow-s3-admission-and-i1-decision-packet.zh-CN.md` 中的有限语义与分节点实施路线。旧决策包保持当时尚未批准的历史事实。

- 精确 `hidden` → 内部 `root-participation`，完整 Root 退出布局；不产生 lifecycle/a11y intent。
- 精确 `relative` → `root-geometry`，在 boundary 上定位一次并提供后代坐标参照，surface 不增加第二个定位包含块。
- 保留 legacy a11y state hidden、semantic tree hiding、L1/keepMounted、Light/collapsed 输出、boolean profiles 与 Maker slot 所有权。
- 分类不等于 recipe 准入；旧 companion 必须安全拒绝并提示重新生成。其它未治理 token、作者前缀、独立 visibility API、Dialog/portal 整体支持和 draft promotion 均不在授权内。

规范落点为 `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001` P–R、`C-HOST-SURFACE-PROJECTION-0001` I、`D-WEB-COMPONENT-SHADOW-STYLE-0001` P。实现依次完成 Core/CLI/WC 与聚焦证据、完整 Tabs 浏览器路径、S3 设置 demo/公共消费与回归；每个完成节点本地提交，到达目标或新的必要人工决策点交回用户。未授权 push、merge、publish、release。

## 首个实现节点

Core 增加 exact classification 与 provenance；CLI 增加 host display none 和内部 I1 recipe receipt；WC 对 hidden/relative 在任一 target 修改前验证新 recipe，surface 不接收这两个 token。Artifact v1 字段未改，旧 H1 motion guard 保留。原来的 Dialog hidden-negative test 现在显式使用缺少 I1 receipt 的旧 companion，不再错误断言 hidden unresolved，也不声明完整 Dialog 支持。

公共 dist + 网站真实 CLI companion 的 14 组完整 Tabs 全部通过 A→B→A，4 组 a11y/L1 诊断仍通过。独立 `scripts/analysis/shadow-i1-browser.mjs` 在 Chrome 152 验证 11 个阶段：初始、offset、Rule hide/restore、patch hide、detach、detached clear、replay、同步 move、dark hide/light restore。比较真实 box、父 flex peer 占位、absolute slot 和附属节点坐标；原生点击验证 Root z-50 高于外侧 z-40 遮挡层，隐藏后不接收点击；实际 Tab 与 accessibility tree 验证排除/恢复。该诊断使用 public runtime 与 source-generated CLI recipe，真实 companion 路径由前述完整 Tabs 审计覆盖。

未修改 conservative semantic merge 分组，bare hidden 与 block 仍可共同保留在 token snapshot；本次不引入 role-aware merge。诊断只使用现有 renderer 支持的 token，不借诊断扩大 m-2/bg-white/z-10 等未实现 renderer 的范围。

附属 span 的绝对定位由诊断显式施加原生 style，以检验所在包含块；不是 Template token 样式交付证据。WC 默认未配置 resolver 时忽略 Template style 是现有行为（`packages/adapters/web-component/test/template-props-style.test.ts`），未在 I1 中改变；Root role recipe 与 Maker slot 路径仍使用上述正式实现。

补充纠正上一份审计记录关于 update 的表述：WC 在 owner 初始化后实际安装 `update()`；未完成初始化的元素可能没有它，不能概括为所有 WC 均无该方法。`setElementProps` 提交完整 raw props snapshot，诊断驱动需维护自己的完整 props，并在需要 render/Rule 更新时调用已安装的 update。本节点只修正诊断用法，未更改 Props 或 WC 更新语义。

当前尚未完成完整 S3 设置区、Tabs 键盘导航矩阵或人工验收；它们是后续节点。最终聚焦/图/类型验证随提交结果报告，不把本记录当成独立语义来源。
