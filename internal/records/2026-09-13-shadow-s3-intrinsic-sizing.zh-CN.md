# S3 intrinsic sizing 修正

日期：2026-09-13。状态：engineering evidence，non-normative。

I1 已由用户批准并在 `31453912` 提交。本节点沿已批准 S3 路线修复完整 Tabs 的尺寸差异，不新增规范职责或作者 API，不推进 draft 状态。

## 复现与归属

完整 Shadcn Tabs 的四个 Trigger 使用原始 `inline-flex flex-1 whitespace-nowrap`。设置／禁用／详情／空在 Light 中宽度为 46/46/46/32px，在旧 split 结构中均为 42.5px，List 宽度同为 176px。差异是生成式内部结构的 intrinsic contribution，适用 draft `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001` I/J/K，不是 token 分类或原型拆分问题。

直接改变外部 flex-basis 会改变宽空间分配，未采用。强制 boundary `min-width:max-content` 虽能修正横向示例，但在 40px 纵向父容器中错误地撑宽 Root；新增反例排除了该方案。最终只对上述静态组合采用内部单子项 flex shell，保留 surface 的装饰与负边距补偿，boundary 的外部 flex-basis 和 automatic minimum 不变。其余组合仍用原有内部 grid 结构。原型的内部 flex 方向仍由 surface 控制。

生成器通过私有 `--pui-split-intrinsic-nowrap-recipe: v1` 提供能力凭据，WC 在完整 effect 的 preflight 检查它。旧 companion、条件化的三个基础 token，以及此组合中的显式 w/min-w/max-w/size 约束在修改任一目标前拒绝。该边界是有限物理 recipe，不是通用 intrinsic CSS 等价保证。必须同源重新生成 document CSS 和 companion。

## 证据与后续

- `packages/adapters/web-component/test/shadow-intrinsic-recipe.test.ts`：8 项，覆盖生成式结构、旧产物及受限组合拒绝、完整快照替换、hidden 和清理。
- `scripts/analysis/shadow-intrinsic-browser.mjs`：12 组 Chrome 对照，横向／纵向父布局 × 40/180/600px × 短／长文本，包含 peer 分配、surface 填充、原生 slot 和不变的外部 flex-basis。
- 原有 sizing、I1、H1 motion 和完整 Tabs 准入回归在提交前重跑；最终结果以命令输出为准。

S3 完整交互仍未完成：新增受控 demo 同步回写 `valueChange=b` 后，Light Trigger 的选中投影仍为 false，消费者 model 已是 b。尚未判定最终 owner；下一节点先最小复现和追踪，不能用页面焦点或选中补丁隐藏问题。S3 场景文件仍为进行中的工作，本节点提交不宣称已可人工验收。
