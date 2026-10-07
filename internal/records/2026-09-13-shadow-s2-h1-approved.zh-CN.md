# S2 H1：完整 Root 几何与独立命中责任已批准

日期：2026-09-13。状态：user-approved direction，non-normative。

用户明确回复“采用 H1”，批准 `2026-09-13-shadow-s2-admission-and-root-motion-decision.zh-CN.md` 的推荐方向。旧记录的“尚未批准”保留为当时事实，由本记录承接，不倒改历史。

H1 使 Root 位移/缩放在 WC split boundary 上执行一次，surface 与 Maker slot 整体随动；will-change 跟随实际变换 target。pointer-events-none 单独属于命中领域，不混入 placement，不产生 disabled/键盘/焦点语义。slot ownership、作者语法、boolean profiles 和 draft lifecycle 不变。

实现内部使用 `root-geometry` 与 `hit-testing` classification，沿用 Root entry transport；这不是新增作者 channel 或 role qualifier。首批精确覆盖 Button/Switch 实际使用的五个几何/提示 token 和 pointer-events-none，其余高歧义值不凭 family 前缀自动准入。规范落点是 `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001` L–O、`C-HOST-SURFACE-PROJECTION-0001` H。

推进节点：

1. 规范与 Core provenance；在物理 recipe 尚未就绪时仍明确拒绝，避免只改 classifier 就丢失效果。
2. CLI 同源 geometry/命中/动画 recipe 与零声明 marker 编译证据；真实浏览器验证中间帧、反向、参照与命中。
3. 完整 Button/Switch 与 S2 设置组合、S1 回归、公共 package/CLI 独立消费、人工入口及交付证据。

每个节点本地提交，不 push/merge/publish/release。分类测试通过不等于动画或完整 S2 已完成；browser cases 在获得实际证据前保持 planned。
