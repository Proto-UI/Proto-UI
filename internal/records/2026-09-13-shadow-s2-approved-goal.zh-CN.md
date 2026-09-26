# S2：动态几何、交互与真实组合的批准目标

日期：2026-09-13。状态：user-approved objective / plan，non-normative。

## S1 收尾与 slot 决定

用户已确认 S1 人工验收完成。成果已按节点提交，最近为 `7807a340`（正式验收页）、`dbcfe17c`（交付证据）、`008584ac`（人工反馈修复与路径回归），没有待补的 S1 实现提交；不重复提交或混入原有 staged/untracked 工作。

承接 `2026-09-13-shadow-s1-delivery-and-manual-acceptance.zh-CN.md` 与 `2026-09-13-shadow-s1-manual-feedback-repair.zh-CN.md`。

用户决定保留现有 slot 边界：slot 是 Maker 提供的内容，原型可提供继承样式默认值，但 Core/Adapter 不擅自接管消费者结构与显式样式。不新增“隔离 slot”、`::slotted` 强制 reset 或自动搬移/克隆消费者节点。需要由原型拥有的文字，可通过现有 props 与内部 Template 渲染表达；不据此扩大当前原型的内容协议。此方向沿用 `C-TEMPLATE-0005`、`D-WEB-COMPONENT-SHADOW-PROFILE-0001-H`。

## S2 必达目标

在正式 `AdaptToWebComponent` split profile 与 CLI artifact 路径下，让 Shadcn Button 和完整 Switch Root + Thumb 的动态几何、交互及真实组合达到有界可验收程度，保留 Badge/Checkbox 的 S1 回归。不是全原型库支持声明，也不提升 draft lifecycle。

1. Button：当前原型公开的 variant/size、图标与文字、hover/pressed/focus-visible/disabled，视觉表面与实际 hit/focus 行为符合原型约定。
2. Switch Root + Thumb：checked、主题、百分比位移、缩放与过渡；验证静态终点及中间帧，连续切换/途中反向切换无重复位移或内外错位。
3. 在小型设置区内组合 Button、Switch、Checkbox、Badge；Light/split 并排及混合使用，动态 props、主题、slot、move/reconnect 后保持状态和通知正确。
4. 公共 package + CLI artifact 的独立消费验证。所需 reset 集成显式展示，不用页面专属数值补丁替代 Adapter 能力。
5. 形成实际 paint/geometry/input 断言、精确 spec/test 映射、明确的已验证原型/token 范围，以及固定人工入口和清单。

## 计划与节点

1. 提交本目标及 S1 收尾事实。
2. 审计真实 Button/Switch closure、canonical roles、生成 recipe 和 public activation；通过可执行证据区分实现缺口与需要语义决策的边界。
3. 在已治理方向内补充实现与回归；必要的 owner/domain 决策返回用户，不移除原型 token 来伪装准入。
4. 建立 S2 实际组合页、动态浏览器路径、独立 package/CLI consumer；保留 S1 回归。
5. 验证并记录交付、分节点本地提交；如遇必须人工决策，则交付精确决策包和证据，不宣称 S2 已完成。

用户授权独立规划内部步骤、实现既有约定、补充证据和本地提交。工作模式仍为 human-assisted/current-user：授权独立执行并不等于改为自主选题的 maintenance 模式。

## 不包含与必须返回用户的决定

- 不包含 Tabs `hidden`、Dialog/portal、原生 text/image control、任意 raw CSS sizing bridge、新 slot/token API、全浏览器或 screen reader 保证。
- 不更改 boolean profiles，不吞掉不支持的 recipe，不通过重写官方原型绕开 host 缺陷。
- `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001-B/C/K` 仍约束 canonical role 与 unresolved 拒绝。批准 S2 目标不等于批准把 transform 或命中控制任意归类。
- 实现方向若需要改变既有语义归属、公开 API、支持保证或缩减必达内容，先请求用户决定。
- 不授权 push、merge、publish、release 或其它外部写入。

## 权威与审计入口

- `spec/decisions/D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001.yaml`：canonical role、同源尺寸贡献、fail-closed。
- `spec/contracts/C-HOST-SURFACE-PROJECTION-0001.yaml`：boundary/surface 与 hit/focus 等领域不混同。
- `spec/decisions/D-WEB-COMPONENT-SHADOW-PROFILE-0001.yaml`、`spec/decisions/D-WEB-COMPONENT-SHADOW-STYLE-0001.yaml`：当前公开 profile、资源与交付。
- `spec/prototypes/P-SHADCN-BUTTON.yaml`、`spec/prototypes/P-SHADCN-SWITCH.yaml`、`spec/prototypes/P-SHADCN-SWITCH-THUMB.yaml`：目标原型的既有行为与兼容边界。
- `packages/core/src/spec/feedback/application-role.ts`、`packages/adapters/web-component/src/shadow-split-effects.ts`：实际分类与准入。
- `packages/prototypes/shadcn/src/button/button.proto.ts`、`packages/prototypes/shadcn/src/switch/root.proto.ts`、`packages/prototypes/shadcn/src/switch/thumb.proto.ts`：完整目标原型，不以简化替身代替。

本记录是批准目标，不是 S2 完成证据；后续审计与交付事实追加到新 record。
