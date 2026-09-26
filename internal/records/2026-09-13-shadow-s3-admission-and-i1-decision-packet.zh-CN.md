# S3 准入审计与 I1 决策包

日期：2026-09-13。状态：observed evidence / proposed decision，non-normative。I1 尚未获得批准；本记录不修改 token 准入，也不声明完整 split Tabs 已支持。

## 目标与本节点范围

用户批准的 S3 目标已在 `56da747d` 的 `internal/records/2026-09-13-shadow-s3-approved-goal.zh-CN.md` 记录：完整 Shadcn Tabs 承载 S2 设置内容，验证隐藏、L1/keepMounted、输入、焦点、资源和公共消费。本节点完成第一轮完整准入审计，并提交必须先明确的 owner/admission 问题；未修改生产代码或新建 S3 demo。

## 实测事实

入口为 `scripts/analysis/shadow-s3-admission-browser.mjs`，fixture 为 `scripts/analysis/fixtures/shadow-s3/admission.ts`。环境：Node 22.23.2、pnpm 10.32.1、Chrome 152.0.7977.83，独立 headless page，不操作用户的人工验收页。

使用公开 dist 的 WC Adapter、Core、完整 Shadcn Tabs Root/List/Trigger/Content 与继承的 Base Tabs，以及网站 CLI 实际生成的 companion、主题和 document token CSS。Bundle 检查禁止 package source alias；不删除完整原型的 token，不覆盖 canonical classifier，不用替身组件冒充 Tabs。

以下每行均测试 `keepMounted=false/true`，共 14 组：

| 模式                          | 结果                                              |
| ----------------------------- | ------------------------------------------------- |
| Light                         | A→B→A 正常                                        |
| direct Shadow（boolean true） | A→B→A 正常；仅输入/生命周期对照，不是视觉等价声明 |
| 仅 Root split                 | A→B→A 正常                                        |
| 仅 List split                 | A→B→A 正常                                        |
| 仅 Trigger split              | setup 的 `relative` unresolved，被拒绝            |
| 仅 Content split              | Rule 的 `hidden` unresolved，被拒绝               |
| 完整 split                    | 同时命中上述两类拒绝                              |

成功对照组每次切换产生一条 valueChange，A→B→A 共两条；两个 Content 的 setup 均为 1。默认模式下 A 的 mount/unmount 为 2/1，非当前 B 已 detached 且 display none；保留模式下两个 Content 均为 mount 1/unmount 0，非当前 B 隐藏而不 detached。14 组移除后订阅全部归零、所有 ShadowRoot 的子节点清空、六个实例各 dispose 一次，更新和清理没有新增异常。

这里“测试通过”包括正确验证拒绝，不是完整 split 准入通过。初始 inactive Content 在默认模式可能尚未物化 view，因而还没有尝试触发自身的 hidden 拒绝：Content-only/default 的 content-b owner surface 仍在，full/default 的 Root/List/content-b surface 仍在。这是 owner lifetime 与 view lifetime 分离的观察，不是该 Content 已完整准入；terminal remove 后资源均清除。

## 三个隐藏相关状态轴

另有 4 组独立诊断：Light/split × `a11y.tree({hidden})`/legacy `a11y.state('hidden', hidden)`，只使用真实 companion 已包含的 `block` token 与 Maker 原生 button，不替代完整 Tabs。

状态顺序为 `(hidden,present)`：`(false,true) → (true,true) → (true,false) → (false,false) → (false,true)`。实际读取布局与 Chrome accessibility tree，而不是仅检查 attribute。

| 机制 | 布局 | 无障碍树 | view 生命周期 |
| --- | --- | --- | --- |
| semantic tree hidden | 本诊断保持原高度 21px；Light block / split grid | button 从 AX tree 消失 | 保持 mounted |
| legacy state hidden | 虽写入原生 hidden，生成式 display 仍让高度保持 21px | button 从 AX tree 消失 | 保持 mounted |
| L1 present=false | boundary display none，高度 0 | button 不在 AX tree | unmount，setup 不重跑 |
| 再 present=true，hidden=false | 原高度与显示方式恢复 | button 恢复 | 第二次 mount，setup 仍为 1 |

detached 期间修改 hidden 后，旧物理 attribute 可以暂留；重建 view 后更新为当前 false，且未暴露旧隐藏状态。这一诊断不要求 detached view 持续投影所有属性。

结论：semantic tree hidden 不能代替布局隐藏，原生 hidden attribute 也不能独自证明布局退出。后者是 CSS cascade 的实际结果，不是本次发现 a11y projector 没有写入属性。不能把 `a11y.tree` 与历史 `a11y.state` 混为同一契约，更不能顺手改动全部 Adapter 的兼容行为。

诊断开发时纠正过 fixture 自身的两个错误：WC 无 `update()` 方法，`setElementProps` 已负责调度；网站 companion 不含诊断用 `p-2`，因此改用已编译的 `block`。完整 Tabs 的 token 未改动。这两次失败不是生产回归。

## 权威、信息路径与实际缺口

- `spec/contracts/C-LIFECYCLE-0008.yaml`（active，尤其 A/E/I/J）：ViewIntent 与感知/挂载轴分离；L1 保留当前 Proto，不保证所有宿主后代状态；揭示前必须同步当前 effects。
- `spec/decisions/D-BASE-TABS-L1-MATERIALIZATION-0001.yaml`（active）：默认 lazy/detach，显式 `keepMounted` 保留 view。
- `spec/prototypes/P-BASE-TABS-CONTENT.yaml`、`spec/prototypes/P-BASE-TABS-LIST.yaml`（draft）：current/hidden、语义隐藏、焦点入口与键盘导航。
- `spec/contracts/C-A11Y-0001.yaml`（draft，L）：semantic tree hiding 不得误改布局。
- `spec/decisions/D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001.yaml`（draft，C/G/H/K/L/M）：Core 分类、完整 provenance、原子拒绝，以及 H1 的有限 Root geometry 准入；目前不含 relative/hidden。
- `spec/decisions/D-WEB-COMPONENT-SHADOW-PROFILE-0001.yaml`（draft，F/J）与 `spec/contracts/C-HOST-SURFACE-PROJECTION-0001.yaml`（draft，C/D）：owner/view 分工、fail-closed；surface 不是通用 focus/a11y target。

Tabs context/current → Base Content 的 hidden state → 三条既有路径：Rule `tw('hidden')`、legacy a11y state、`lifecycle.setPresent(keepMounted || current)`。它们由同一个原型状态协调，并不因此归并成一个 domain。具体源码为 `packages/prototypes/base/src/tabs/content.proto.ts` 与 `packages/modules/a11y/src/web.ts`；Content 中关于未来 visibility capability 的 TODO 是历史方向，不是本次跨 Adapter 迁移授权。

`packages/core/src/spec/feedback/application-role.ts` 当前显式保留 hidden/relative 为 unresolved。`packages/prototypes/shadcn/src/tabs/trigger.proto.ts` 的完整 setup 使用 relative；它不只是 Content 的隐藏问题。

`packages/cli/src/services/proto-style-css.ts` 虽能编译 hidden 为 display none，但 `splitHostDeclarations` 对 display 只映射已支持的 block/flex/grid 等值，none 当前不输出 host contribution。因此只改 canonical classifier 不足以完成隐藏；必须补齐同源物理 recipe，并验证旧 artifact 不会被误当成已支持。relative 的 position 声明可以生成并转交 host，但仍缺少治理过的归属与 containing-block 证据，不能依据“现有 renderer 恰好能编译”倒推准入。

## 推荐 I1：有限补齐整根职责，保留三个状态轴

请求批准以下语义方向与对应 spec、Core、CLI、WC、测试和文档实现；不是批准未经验证的支持声明。

1. **精确准入 `hidden` 为 Root 布局参与职责**。建议内部 role 名为 `root-participation`，区别于已有绘制、placement、geometry 与生命周期 present。它表示完整 Root 暂不生成参与布局/绘制的 box；WC split 通过 boundary 的 display none 同时覆盖 surface 和 slot，取消后恢复当前已合并的生成式 display。不只隐藏 surface 而遗留宿主占位、padding、margin 或父布局 gap。
2. **hidden 不生成 lifecycle 或 a11y intent**。它不调用 setPresent、dispose，不改写 a11y state，也不接管 Maker 节点。正常 hit/Tab/AX 排除是 Web 的 display none 结果，仍需真实浏览器验证；不能把 CSS 隐藏扩展成通用事件禁用或状态销毁。
3. **精确准入 `relative` 为 Root geometry/坐标职责**，扩展 H1 内部 role。整根定位只在 boundary 上执行一次，surface 不额外建立第二个定位包含块；必须保留普通流占位、offset/z-index 组合以及后代 absolute 定位的参照。它兼有整根定位和对子代的坐标影响，不能以“position 是布局属性”为由直接猜作 surface。不顺带重分类已有 absolute/fixed/static/sticky 或准入其它未治理家族。
4. **保留现有 Tabs 与 a11y 兼容路径**。继续由原型协调 hidden/current 与 keepMounted，保留 legacy state hidden 的行为；不在 S3 内全面迁移 a11y 或新建公开 visibility API。保持 `a11y.tree` 不改变布局的保证。
5. **沿用 fail-closed 与同源投影**。setup、Rule activation/deactivation、patch/clear、replay 使用相同 provenance 与完整 effect；recipe 不足或旧产物缺少新支持证据时拒绝，不靠 document reset、私有 CSS 或删 token 掩盖。只清理 Adapter-owned contribution。

这是内部语义扩充，不新增作者前缀或学习要求；现有 Light/collapsed 输出、boolean profile、Maker slot 所有权与 draft lifecycle 保持不变。`invisible`、`visible`、`collapse`、任意 overflow/transform/CSS 仍不借此获得准入。

## 备选与取舍

- **I2：先建立独立 visibility channel/Host Capability，并迁移 legacy a11y hidden**。优点是一次整理历史耦合；代价是更大的跨 Adapter、作者 API 与兼容范围。当前完整 Tabs 可以在保留三轴的前提下补齐生成式 style，不建议把该架构迁移作为 S3 前置。
- **I3：暂缓新准入，仅交付 Root/List split 的混合 Tabs**。可保持当前语义不变，但缩减已批准的完整 S3 目标，也无法验证 split Content 的视图保留与隐藏。
- surface-only hidden 或删除 relative/hidden 不作为等价方案：前者可能留宿主布局贡献，后者改变完整原型；都不能宣称完成 S3。

I1 的残余风险是：旧 a11y state hidden 仍具有历史双重投影；有限 recipe 的正确性必须逐个组合证明。Core 精确 token 准入会影响所有使用相同 token 的原型，不能自动把 Dialog/portal 等完整组合也标记为支持。

## 批准后的节点与证据要求

1. 修改上述 role/surface 决策与契约、`D-WEB-COMPONENT-SHADOW-STYLE-0001` 的 recipe 边界；保持 draft，不新建空 HC。Core exact classification/provenance 与 collapsed compatibility 测试同步提交。
2. 实现生成式 host recipe、artifact 能力验证和 WC 原子投射；测试 hidden/display 恢复、Rule/patch/replay、旧 artifact 拒绝、relative 的 absolute 后代坐标、offset/z-index、slot 与附属节点、动态清理，再本地提交。必要时缩小 recipe，不扩大分类猜测。
3. 完整 Tabs 准入后完成 Light/split/mixed 的默认 L1 与 keepMounted、原生键盘/Tab/命中/AX、焦点入口与重复切换/重连。当前已验证的 Maker slot 组合不代表宿主位于任意深层 ShadowRoot 内时的全部 L1 支持；该路径需单独核验。
4. 结合 S2 设置内容建立 demo-matrix 人工入口，更新公共消费、T 映射和交付记录，保留 S1/S2 回归；各节点本地提交，不 push/merge/publish/release。

测试图将以 `T-FEEDBACK-STYLE-ROLE-RESOLUTION-0001` 的 exact role/transport、Shadow style/profile 测试、Tabs Content/Lifecycle 测试和新的真实浏览器路径为主。本节点只把 14 组拒绝审计映射到已有 unresolved case；不会以此补写 passing full Tabs conformance。

## 本节点验证

- `node scripts/analysis/shadow-s3-admission-browser.mjs`：14 组准入/拒绝审计与 4 组隐藏轴诊断全部通过，Chrome 152；不是全浏览器或读屏器软件验收。
- WC tabs、lifecycle-view-intent、shadow-split-profile、shadow-owner-shell、shadow-split-runtime，Core application-role 与 a11y Web 的 7 个文件：72 项 focused tests 通过。
- `corepack pnpm@10.32.1 check:types:workspace` 通过，包含新增 TypeScript fixture。
- 本轮目标记录的 agent operations 58 项、agent snapshot/check 与格式检查已通过；新增映射与决策记录的最终检查另随提交结果报告。

尚未执行 S3 完整键盘/命中/关系图测试、完整设置 demo 或 S1/S2 全量重跑；本节点无生产变化。下一步需要的人工决定仅为：是否采用上述 I1 的有限语义准入，沿现有 S3 目标分节点实施。
