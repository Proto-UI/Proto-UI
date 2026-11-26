# S2 H1：动态投影实现与阶段证据

日期：2026-09-13。状态：implemented bounded H1 node，non-normative；不是完整 S2 交付。

承接用户“采用 H1”与 `2026-09-13-shadow-s2-h1-approved.zh-CN.md`。第一节点 `bb2be7c2` 已提交规范与 Core domain provenance；177 项聚焦/spec 测试、workspace types、目录校验与 43 个公共包构建通过。

## 本节点实现

- CLI 从原 declaration closure 生成 boundary transform、独立 pointer-events 与 timing，保留 canonical role；nested Root 重置本地 transform operands，surface 不重复变换。
- `transition-all` 同源协调 boundary 尺寸贡献和 surface 绘制，duration/ease/delay 的排序在两边一致。Artifact 仍是原 v1 四字段，H1 recipe 使用内部 CSS 标识；旧 companion 会提示重新生成，不静默漏样式。
- `peer`、`group/button` 等零声明 marker 获得非绘制性 compiled receipt，不据此声称跨 Shadow group/peer selector 支持。
- 等价 split slot-only view 更新保留 native slot，view detach/remount 与 terminal teardown 仍释放；boolean profiles 不改变。

## 测试实际揭示的两个缺口

首次逐帧比较发现：Switch checked 更新后 Light Thumb 尚在起点（相对 Root x=3），split 已跳到终点（x=21）。保留相同的消费者 Node 还不够：替换等价 native slot 会中断扁平树上的 CSS transition。Split inner surface 现在只对已验证的等价 slot-only commit 保持节点，真实 18px 位移及反向恢复；不移动/克隆消费者节点。

额外诊断将 border 从 1px 动画到 2px 时，实际 border used value 按像素取整，负 margin 却连续插值，出现约 0.2px 的内外错位。这不属于当前完整 Button/Switch 的固定 border recipe。现明确拒绝 `transition-all` 下可能变化的 border-width（含 conditional 或已挂载后的 effect 变化），保留上一份完整投影；固定 border 下的 width/height/padding 动画继续验证。未通过的边框诊断不改成放宽误差来宣称支持，后续有真实需求时再实现相应 recipe。

## 可执行证据与范围

- `packages/core/test/feedback/h1-root-domains.test.ts`：22 项 exact classification/provenance 测试。
- WC + CLI + Core feedback + Rule transport + Runtime replay：633 项测试通过；覆盖旧 recipe 拒绝、动态边框拒绝、完整原型挂载/重连、slot continuity、boolean 回归与 CLI 交付。
- `scripts/analysis/shadow-s2-admission-browser.mjs`：公共 dist root/subpath + 实际 CLI companion；三种完整原型正常 connection、文本身份保留、terminal 资源归零。不再把历史拒绝当成永久“不支持”测试。
- `scripts/analysis/shadow-s2-motion-browser.mjs`：公共 dist Adapter/prototypes，无 source runtime alias；CSS 由真实 CLI collector/renderer 提供。Chrome 152 的 204 个样本帧比较 Button 四种尺寸、按压位移、Switch Root/Thumb 百分比位移、父缩放与嵌套、途中反向，以及固定边框的动态尺寸/间距诊断。还覆盖大幅位移后的 hit、原生 descendant pointer-events override、独立 native focus、will-change containing block 和负 z 子节点的实际像素绘制。
- 亚像素命中用 collapsed 原生结果作基准，不能用几何 rect 外的一点强行要求浏览器返回空。Pixel paint 与 elementFromPoint 也不是一回事：负 z 的消费者可以画在透明 surface 后方，而 surface 接收命中；不因此扩大对任意 raw CSS 后代的命中等价保证。
- Workspace type check 首次与 CLI 自建测试并发，遇到 dist 删除/重建窗口；测试结束后单独重跑通过。后续类型检查不与会重建 dist 的 CLI 测试并行。

上述证据不替代 S2 设置组合、实际浏览器输入路径、人工入口、完整交付复核；这些继续作为下一节点。未运行发布流程，不 push/merge/publish/release。
