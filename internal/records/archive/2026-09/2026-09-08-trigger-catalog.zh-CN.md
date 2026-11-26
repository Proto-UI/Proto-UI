# Trigger 编目与连续链边界

日期：2026-09-08。基线：`5b37f37a`。非规范工程记录；规范方向由 draft C/D/M/HC/T 实体持有。

前序 Collection、Expose State Web、Rule Expose State Web 已整理为 `105bff50`、`6176b820`、`5b37f37a`。用户授权沿现有 roadmap 连续推进，仅在设计决策偏移时暂停。

## 决策与修复

复现 Outer 直接包含 Left/Right Trigger 时，原宿主实现按注册顺序选择最后一个 surface。用户明确选择诊断并拒绝分叉，group 必须是一条连续链。已补充 `C-AS-TRIGGER-0001-L` 与 `D-TRIGGER-GROUP-SURFACE-0001-I`，没有新增作者 API。

共享 instance-tree 在声明及父关系变更之前检查直接 Trigger 分叉；延迟 parent 声明不能合并两个 child group。拒绝保留既有关系、surface 和事件路由。解绑 view 后的旧 token 保留逻辑身份，但不占据 live group slot，也不在祖先 reconciliation 时被重新注册；正常 replacement 可继续，旧 surface 重新接入造成分叉则被拒绝。

## 编目边界

新增 `M-AS-TRIGGER-0001`、`HC-TRIGGER-GROUP-0001`、`T-AS-TRIGGER-0002` 与四 Adapter 有界关系，均保持 draft。HC 表达 logical group projection 职责，不逐个复制五个 cap token。Module 依赖 Event；Focus、A11y、Boundary、Overlay policy 仍归各自 domain。旧 EventTarget marker fallback 是兼容实现，不构成新的 opaque-host conformance 声明。

## 证据

新增宿主回归覆盖两种 sibling 顺序、延迟 parent、reparent 拒绝、有效 route 保留及解绑后的 replacement。四真实 Adapter 共用三层 Trigger fixture，覆盖每个成员一次 activation、非 surface 宿主盒拒绝、非冒泡 host-local event、卸载清理与 fresh owner。已有 Runtime 合并/停止证据与 React/Vue 官方 Button、Web Component Dialog 消费者继续作为相关回归范围。

本次 DOM 模拟测试不宣称真实浏览器键盘、布局或辅助技术全部通过。后续 Focus 编目需独立 trace 其导航、group role、生命周期及宿主能力边界；A11y API 改造继续单独处理。
