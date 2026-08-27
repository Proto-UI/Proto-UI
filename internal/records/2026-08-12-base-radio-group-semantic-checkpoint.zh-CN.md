# Base Radio Group 语义检查点

- 日期：2026-08-12
- 关联 issue：[#349](https://github.com/Proto-UI/Proto-UI/issues/349)
- 状态：maintainer 已批准，进入 Base 实现

## 结论

本检查点批准一个 `base-radio-group` anatomy family，并限定三个独立 P 实体：

- `P-BASE-RADIO-GROUP`：唯一 selected value owner，同时拥有 Collection、Focus Roving 与 `radiogroup` 语义对象；
- `P-BASE-RADIO-GROUP-ITEM`：一个可聚焦 `radio` choice，从 group value 派生 checked/effective-disabled，并向 group 请求 selection；
- `P-BASE-RADIO-GROUP-INDICATOR`：可选且可重复的视觉反馈 part，只消费 item context，不拥有 value、activation、focus、a11y control 或 form 语义。

不建立独立 `P-BASE-RADIO`，不复用 Checkbox 协议，也不增加没有独立信息路径的 List part。

## 已批准边界

- Root props 仅为 `value?`、`defaultValue?`、`disabled?`、`a11yLabel?`；Item props 仅为必填非空 `value` 与 `disabled?`。
- Group 是唯一 selection owner。空值与 unmatched value 合法；用户交互只能选择，不能清空；结构变化不能改写 value 或发出 `valueChange`。
- 非法 duplicate value 必须被运行时安全边界限制为至多一个 checked a11y object，ambiguous request 不得被接受。
- Focus Roving 负责双轴、循环的 arrow navigation 与 selected-or-first entry。Tab 进入空 selection 不触发选择；Space 选择；Enter 不处理；Arrow 与 Home/End 同步移动焦点并选择；disabled item 被跳过。
- Root 投影一个具名 `radiogroup`；Item 投影 `radio`、动态 checked 与 effective disabled；Indicator 不创建重复 control object。
- 第一批不公开 `orientation`、`loop`，不包含 Toolbar 特例。
- Form 相关能力整体后延：`name`、form owner、native/hidden input、submission、reset、validation、原生 `input`/`change` 时序。本次实现不得声称部分 form 支持。

## 生命周期与交付

新增三个 P 实体及三个对应 T 实体，均为 `draft`、`since: 0.3.0`。实现覆盖 Base source、tests、package/CLI surface、双语 docs/demo、Web Component/React/Vue 投影与正式生成物；不改写 `0.2.0-rc.7` 历史发布证据，也不在本 issue 内实现 Shadcn projection。

完整设计见 `docs/superpowers/specs/2026-08-12-base-radio-group-semantic-design.md`。Issue checkpoint：<https://github.com/Proto-UI/Proto-UI/issues/349#issuecomment-5266367116>。
