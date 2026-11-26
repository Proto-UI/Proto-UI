# S3：完整 Tabs 的隐藏、视图保留与焦点导航

日期：2026-09-13。状态：user-approved objective / plan，non-normative；不是 S3 支持或完成声明。

## S2 人工验收收口

用户在 `27cbc701` 交付后确认“人工验收一切正常”，S2 现按人工验收通过收口。成果包括 `bb2be7c2`、`cbe9e4d9` 与 `27cbc701`；具体机器证据和范围见 `2026-09-13-shadow-s2-delivery-and-manual-acceptance.zh-CN.md`。旧记录中的“尚未获得确认”保留为当时事实，不回写历史。

这次确认不提升 split profile 的 draft lifecycle，不扩展浏览器、token、slot、native 或 portal 支持范围。

## 批准的 S3 目标

在正式 `AdaptToWebComponent` object split profile 与真实 CLI artifact 下，以完整 Shadcn Tabs Root / List / Trigger / Content 承载已有 S2 设置内容，验证面板不再始终可见时的布局、输入、a11y 与生命周期一致性。

1. **完整组合**：使用正式原型与继承 closure，不删除不支持的 token 或用简化替身宣称准入。人工检测区提供 Light、split 与混合组合。
2. **两种视图策略**：默认 inactive Content 进行 L1 detach，切回时恢复当前 view；`keepMounted=true` 保留 view 但隐藏。分别记录 Content instance、view epoch、后代组件和消费者受控值，不将 `C-LIFECYCLE-0008-I` 扩大为所有后代自动保留状态。
3. **真实键盘操作**：方向键、Home/End、automatic/manual activation、disabled skip、current Content 的 descendant-first / fallback-self focus entry，遵循现有 Tabs/Focus 协议。
4. **实际隐藏效果**：在受支持的生成式样式路径下，inactive panel 不占布局，不参与正常点击与 Tab 导航；检查实际 accessibility tree/关系，不只比对属性字符串。视觉隐藏、a11y semantic hiding 和 view materialization 不是同一个状态轴。
5. **重复切换与重连**：A→B→A、多轮切换、动态 props/主题/slot、同步 move、terminal remove/reconnect 后正确恢复。视图首次揭示前完成当前 effects，通知不重复、资源不泄漏，保留 S1/S2 回归。
6. **交付证据**：公共 dist package + CLI 独立消费、精确 test/spec 映射，以及 demo-matrix 固定人工入口与清单。人工通过仍由用户确认。

## 路线与节点

1. 本记录提交 S2 人工确认与 S3 批准目标。
2. 审计完整 Tabs 的 canonical role、生成 recipe、真实 public activation、hidden/a11y/L1 关系，形成可复现证据。已知 `hidden` unresolved 不等于已经证明它是唯一卡点。
3. 形成第一个隐藏／视图保留决策包；在新的 owner/admission 决定明确之前，不擅自新增 canonical role、改变 a11y 的兼容行为或绕过 fail-closed。
4. 在批准的语义内分节点实现、添加跨层和浏览器回归，并本地提交。
5. 建立 Tabs 设置验收区、公共消费验证与交付记录；到达阶段目标或必须人工决定的节点时交回用户。

用户已批准推荐路线；继续采用 human-assisted/current-user，而不是维护任务自主选题模式。沿用此前每个节点本地提交的工作方式；不会因此推断 push、merge、publish、release 或任意范围扩展授权。

## 保留边界

- 不新增作者 role 前缀、slot API 或独立 Adapter 包；boolean profiles 不变，draft 不升级。
- 不纳入 Dialog/portal、native text/image、任意 overflow/CSS sizing、动态 border-width 过渡或全浏览器保证。
- Maker slot 的节点与显式样式仍由 Maker 负责；整个面板隐藏导致 slot 内容不可见，不等于原型接管 slot 的文字样式或节点所有权。
- 目标批准不是 `hidden` 分类/Host Capability 的预先准入，也不是将来所有隐藏形式一并支持。只为完整目标原型补齐有证据的路径。
- 不改动工作区已有的无关 staged/untracked 文件。

## 权威与审计入口

- `spec/contracts/C-LIFECYCLE-0008.yaml`（active）：ViewIntent、L1、owner lifetime、子视图状态限制与 reveal barrier。
- `spec/decisions/D-BASE-TABS-L1-MATERIALIZATION-0001.yaml`（active）：默认 lazy/detach 与显式 `keepMounted`。
- `spec/prototypes/P-BASE-TABS-CONTENT.yaml`、`spec/prototypes/P-BASE-TABS-LIST.yaml`（draft）：隐藏、焦点入口、roving 与 a11y；Shadcn Tabs family 继承对应语义。
- `spec/contracts/C-A11Y-0001.yaml`（draft）：尤其 L，semantic tree hiding 不得误改宿主布局可见性；legacy state hidden 与 tree hidden 需区别审计。
- `spec/decisions/D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001.yaml`、`spec/decisions/D-WEB-COMPONENT-SHADOW-PROFILE-0001.yaml`（draft）：canonical provenance、unresolved 拒绝、owner/view resources 与当前公开 profile。
- `packages/prototypes/base/src/tabs/content.proto.ts`、`packages/prototypes/shadcn/src/tabs/`、`packages/modules/a11y/src/web.ts`、`packages/adapters/base/src/host/view-visibility.ts`、`packages/adapters/web-component/src/runtime/modules.ts`：三条实际投射路径与完整目标 closure。
