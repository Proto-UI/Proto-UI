# Proto UI 0.3.0-rc.1

> Draft release notes。本候选尚未发布。这些准备资产不代表 RC 已可安装、最终 rehearsal 已通过或发行验收已经完成。

Proto UI `0.3.0-rc.1` 是首个编号候选的准备草案。有效的 0.3 范围继续保留，但本次审计尚未确认已经满足 RC 阶段条件。全部 47 个公开 `@proto.ui/*` package 精确共享这一拟定版本。预定 npm channel 为 `next`，Git tag 为 `v0.3.0-rc.1`。

## 候选范围

- Base、Shadcn、Brutalist 与 Lucide，以及受支持的网站、CLI 和保留的 Web-host 前置能力，继续构成 0.3 承诺范围。候选包含当前 package 源码及准备基线上已经评审合入的修正；最终整合源码仍需自己的验证证据。
- RC 阶段允许最终验证、交互与可访问性修复、兼容性修复、打包与文档修正。既定能力仍需新增语义或接口时，阶段进入条件尚未满足；新增核心特性、计划中的架构重写或顶层 breaking API 变化必须在发布前按现有阶段决定解决。
- Bootstrap、Liquid Glass，以及有效 0.3 计划明确顺延的 Compiler/consumer 条件，仍属于 0.4。保留其源码与历史证据，不扩大 RC 的 admission 声明。
- `@proto.ui/compiler`、GPUI peer/native target 与仓库内部工具不进入公开 npm package 集合。共享基础能力进入包中不代表 native 或 compiler 验收已经成立。

## Package 与版本边界

[BOM](package-bom.json) 列出全部 47 个公开 package 的精确版本、发行角色与发布顺序。0.3 线新增的四个 module identity 是 `@proto.ui/module-axis-input`、`@proto.ui/module-control-label`、`@proto.ui/module-native-link` 与 `@proto.ui/module-table-structure`。

消费者必须让公开 Proto UI package 保持相同的完整版本。Package 内的候选安装示例仅供发布后使用；已发布的试用页与普通 Quick Start 保留现有已验证路径。`@next` 只是便利 channel，不是精确测试身份。

Draft `0.3.0-alpha.2` 与 stable `0.3.0` 的准备资产保留为独立记录。`V-PROTO-UI-0012` 仍是 stable `0.3.0` draft，`V-PROTO-UI-0013` 保留 draft `0.4.0` 范围。本 RC 由 draft `V-PROTO-UI-0014` 独立治理，不移动 `latest`，也不激活任何 stable train。

## 生命周期审读

RC 生命周期清单包含在 `0.3.0-rc.1` 可用的 1,322 个普通实体，其中 1,262 个为 draft。[处置记录](lifecycle-dispositions.json) 对这些可用实体接续既有已审读的家族、延期家族与共享切片。全部 1,262 个 draft 保持 `remain-draft`；15 个历史 Compiler 契约/测试保留独立的 `not-applicable` 处置。本次准备不提升任何普通实体。

四条自 stable `0.3.0` 引入的记录不在该 prerelease 的版本过滤清单内，也不回填更早的起始版本：`P-BRUTALIST-DRAWER-FOOTER`、`P-BRUTALIST-DRAWER-HEADER`、`T-BRUTALIST-DRAWER-STRUCTURE-0001` 与 `T-TOAST-STACK-0001`。60 个非 draft 实体仍缺少 activation provenance，113 个 legacy block target 仍未分类。处置覆盖不等于独立 admission 或执行证据。

## 已知 blocker 与待补证据

- 保留的 Dropdown 范围并非只差执行证据：`issue.1100.005` 与 `issue.1161.002` 要求子菜单和 checkbox/radio 组。有效的 [0.3 归属](https://github.com/Proto-UI/Proto-UI/issues/1161#issuecomment-6700043691)与[覆盖旧延期的范围决定](https://github.com/Proto-UI/Proto-UI/issues/1100#issuecomment-6700065987)继续保留该要求。
- 在整合源码 `1cff2e7e73e8b5c3c9c767d4399d521d2605049c` 中，`P-BASE-DROPDOWN-MENU` 将上述变体排除于当前保证之外，Base 导出实现仅有普通菜单项。原有 RC 阶段规则仍构成阻挡；本次准备没有延期该能力，也没有宣称范围已完成。
- 同一源码审计还确认：Autocomplete 分组（`issue.1095.001`）、Combobox 多选/chips 及对应可访问性组（`issue.1095.002`）、Command 分组与受控 active 状态（`issue.1095.003`）仍有保留的语义或公开接口缺口。这不表示现有普通组件完全没有实现。
- Menubar 与 ContextMenu 仍分别保留子菜单和 checkbox/radio recipe 要求（`issue.1095.006`、`issue.1095.008`），当前导出没有这些部件。[#1095 的有效范围决定](https://github.com/Proto-UI/Proto-UI/issues/1095#issuecomment-6700063976)同样覆盖了旧的整单 0.4 延期。上述六组共七条原始条件尚未解决；这里没有新增延期。
- 2026-11-28 的公开 registry 检查找到全部 47 个 package identity，其中 43 个 ready、4 个被现有 bootstrap policy 阻挡。上述每个新模块都同时拥有 `0.0.0-stage` 与已 deprecated 的 `0.0.0-bootstrap.0`，`latest` 指向 bootstrap，且没有 `next`。
- 因此 bootstrap 不是唯一版本。Registry prerequisite 保留现有门禁，由单独授权的修复处理。私有 Trusted Publisher 授权仍需独立核验。
- 整合负责人需要合并当前 CI 修复，并在最终源码上重跑完整 release rehearsal、strict package budgets、适用生成输入检查与保留的 0.3 验收门禁。本次准备的局部检查不代表这些检查已经通过。原始失败、跳过和未执行条件在解决前继续保留为证据欠账。
- 本次准备没有执行 package 发布、Git tag 创建、GitHub prerelease、不可变 snapshot/checksum 核验或后续 V 实体激活。

[准备记录](../../records/2026-11-28-0.3.0-rc.1-release-prep.zh-CN.md) 记录基线、精确命令、实际结果与剩余负责人。受保护发布必须在已评审的 `main` 候选上执行，采用完整 workspace package 集合与 `next` channel。
