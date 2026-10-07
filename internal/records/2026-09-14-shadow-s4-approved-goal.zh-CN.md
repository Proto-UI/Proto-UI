# S4：完整 Dialog 承载 Tabs 设置区

日期：2026-09-14。状态：user-approved objective / plan，non-normative；不是 S4 支持或完成声明。

## S3 人工验收收口

用户确认 `de7e56e0` 的重复焦点轮廓修复已解决，随后批准本阶段目标。S3 按人工验收通过收口；交付与修复证据分别见 `internal/records/2026-09-13-shadow-s3-delivery-and-manual-acceptance.zh-CN.md` 和 `internal/records/2026-09-13-shadow-s3-focus-outline-repair.zh-CN.md`。旧记录中的待人工确认保留为当时事实，不回写历史。

人工确认不提升 split draft lifecycle，不自动扩大浏览器、native control、slot 或 token 支持范围。

## 批准目标

在正式 `AdaptToWebComponent` object split profile 与真实 CLI companion 下，以完整官方 Shadcn Dialog 承载已验收的 Tabs 设置组合，提供 Light、split、混合三种配置。只覆盖同一 document、现有 portal 路径、单层普通 modal Dialog。

人工主路径：打开设置弹窗 → 切换 Tabs、修改设置 → 关闭并恢复 Trigger 焦点 → 再次打开 → 验证消费者受控设置值。

1. **完整组合与绘制**：组合 Root、Trigger、Mask、Content、Title、Description、Close 等真实原型及其继承 closure；不删除不支持的 token、不用简化原型替代准入。遮罩、居中、层级、主题和进出动画正确，不产生内外重复位移或绘制。
2. **焦点与输入**：遵循既有 entry、trap/loop、restore 与 request focus reason；内部交互不误判 outside；Escape、Close、遮罩按普通 Dialog 协议请求关闭。受控 dismissal 不得越过 owner 回写擅自提交 open。
3. **实际无障碍关系**：检查实际 AX 中的 role、name、description、关闭后的排除及逻辑 part 关系，不以属性字符串代替输出证据。
4. **生命周期与资源**：打开、关闭、快速反向、动态更新、移除和重连后，不残留 portal 投射、遮罩、滚动锁、监听或重复通知。区分 logical open、Transition present、view epoch 与 instance；leaving 阶段遵守现有资源 lifetime。
5. **组合稳定性**：Dialog 内完整 Tabs、Button、Switch、Checkbox、Badge 继续工作；设置值由消费者受控模型恢复，不承诺所有后代或原生状态自动保留。Maker slot 所有权不变。
6. **交付**：公开 dist + CLI 独立消费、真实浏览器路径、精确 spec/test 映射、demo-matrix 固定入口和人工清单；保留 S1–S3 回归。

## 路线与节点

1. 提交本批准目标与 S3 人工确认。
2. 审计完整 Dialog 的 canonical role、CLI recipe、公开注册/激活；审计 portal 前后的真实物理位置、样式环境、逻辑关系和资源投射。
3. 对既有语义内的实现缺口补充可失败证据并修复；对未治理的分类、动画与 portal 环境规则形成明确决定后再实施，不用页面补丁或环境快照暗中填补语义。
4. 分节点实现必要能力与回归，建立正式验收区并本地提交。
5. 达到 S4 可验收程度，或遇到必须人工决定的问题时交回用户；不以静态布局通过替代中间帧、实际命中、焦点与资源证据。

工作模式为 human-assisted/current-user。用户批准推荐路线，沿用分节点本地提交；不推断 push、merge、publish、release 或其它外部写入权限。

## 保留边界

- 不新增作者 role/slot API 或独立 Adapter；既有 boolean profiles 与 draft lifecycle 不变。
- 不纳入嵌套弹窗、Alert Dialog 专项准入、任意 portal target、跨 document、closed Shadow 树、Popover/Tooltip 定位、native text/image control、任意 CSS/overflow 或全浏览器保证。
- `-translate-x-1/2` / `-translate-y-1/2` 等具体准入仍需按 `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001` 明确语义和 recipe；目标批准不自动扩大整个 token family。
- Portal 的真实 CSS 继承与逻辑 Context/Anatomy 是不同事实。局部容器主题如何处理须审计明确，不自动复制全部 computed style，不将可选 colorSchemeSource 当作 CSS 变量快照。
- 不改变当前 Shadcn 与 upstream 的已记录组合/public type 差异来伪装 Adapter 能力；S4 不承担完整 upstream parity 收敛。
- 保留工作区已有的无关 staged/unstaged/untracked 变更。

## 权威与审计入口

- `spec/decisions/D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001.yaml`、`spec/decisions/D-WEB-COMPONENT-SHADOW-PROFILE-0001.yaml`、`spec/contracts/C-HOST-SURFACE-PROJECTION-0001.yaml`（draft）：角色、精确准入、同源投射和 fail-closed。
- `spec/prototypes/P-BASE-DIALOG-CONTENT.yaml`、`spec/prototypes/P-SHADCN-DIALOG-CONTENT.yaml`（draft）：focus、dismiss、AX、presence 和完整视觉 recipe。
- `spec/contracts/C-AS-OVERLAY-0001.yaml`（draft）E/F/K：leaving/portal/layer 资源与保留实例逻辑拓扑；`spec/host-caps/HC-PORTAL-0001.yaml` 仍是简略 draft，不能由此推断完整支持矩阵。
- `spec/contracts/C-LIFECYCLE-0008.yaml`（active）：L1、view 与 owner lifetime。
- `packages/adapters/web-component/src/runtime/modules.ts`、`packages/adapters/web-component/src/shadow-split-effects.ts`、`packages/cli/src/services/proto-style-css.ts`、`packages/prototypes/shadcn/src/dialog/`：实际实现与编译入口。
