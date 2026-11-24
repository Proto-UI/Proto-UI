---
title: '从 Base 投射风格化 Prototype'
description: '在复用 Base 交互协议的基础上，完整交付设计语言规范、样式实现、测试、导出、CLI 与 Demo。'
---

在现有 Base 协议之上构建设计语言风格组件，是原型作者最常见也最顺畅的完整交付路径。只要 Base 已经定义好底层交互协议，风格层只需专注于视觉体系、设计语言 API 以及明确记录的差异。

## 开始前的准备

动手前确认以下信息已就位：

- 对应的 Base `P-*` 实体与 `T-*` 测试已经存在；
- 目标 Issue 明确列出了 Base 归属、目标风格组件身份与生命周期状态；
- Base 所管理的状态、事件、焦点、无障碍、Context、定位或宿主能力边界清晰；
- 风格层需要新增的 props、Token、样式 `Rule`、视觉 Anatomy 与兼容范围明确。

如果发现缺失底层交互协议、需要全新的 Base 身份，先把新 Base 标记为 `draft` 候选并补充聚焦测试，不要通过直接拷贝其他风格库代码来猜测边界。

## 区分基于 Base 继承与 styled-only

### 基于 Base 继承

当风格组件需要复用 Base 已有的状态与交互通路时，在规范中通过 `inherits.prototypes` 声明继承，并在实现中调用对应的 Base `asHook`。风格层只负责叠加视觉表现，不另起炉灶维护第二套交互状态。

### Styled-only

当组件只包含设计语言属性、样式规则、内容布局或视觉 Anatomy，且没有独立的跨宿主交互协议时，直接声明为正式的 `styled-only` 原型即可，不需要为继承而在 Base 中造一个空壳协议。

## 交付步骤

### 1. 记录来源与兼容范围

如果适配的是 Shadcn、Lucide 或其他第三方设计语言，请记录：

- 上游仓库地址与文件路径；
- 对应的版本、Tag 或提交记录；
- 许可证与必要的版权声明；
- 哪些 API、Token、资源或视觉样式为直接适配、改写或仅作参考；
- 哪些上游 API 明确不支持或存在行为差异。

如果是原创设计语言，简明说明其定位即可。

### 2. 编写风格层 `P-*` 实体

风格层的 `P-*` 规范聚焦增量与差异：

- 通过 `inherits.prototypes` 指向对应的 Base 实体；
- 只为风格层新增能力编写准则；
- 如需在 `setup` 期放弃或替换某项 Base 能力（negative patch），明确写明被替换的能力与新行为；
- 记录设计语言 props、`variant`、Token、视觉 Anatomy 与公开兼容范围；
- 关联对应的 `T-*` 测试用例与真实源码路径。

无需在风格层重复抄写 Base 准则，也只把已实现的兼容能力写入规范。

### 3. 基于 Base `asHook` 编写实现

源码通常先调用所属 Base 的 `asHook`，再叠加：

- 设计语言 props；
- `feedback.style` 样式 Token；
- 基于 Base 状态或元信息的样式 `Rule`；
- 规范中声明的视觉 Anatomy；
- 风格库自己的类型定义与公开导出入口。

如果发现风格层开始自己维护值、事件请求、焦点、无障碍、关闭策略或定位，说明状态归属发生了偏移——请及时调整实现与规范，让 Base 保持单一数据源。

### 4. 编写正向与边界测试

聚焦单测应覆盖：

- 风格入口正确调用对应的 Base 入口；
- 设计语言 props 及其默认值；
- 关键交互状态下 Token 与样式 `Rule` 的输出；
- 明确不支持的 variant、事件、部件或兼容 API 保持缺席；
- 交互状态、焦点、激活与无障碍属性仍由 Base 统一管理；
- 公开子路径与根导出名称准确一致。

### 5. 完成公开交付面

每个新增的公开原型或复合家族，都在同一 PR 中提供接入官网导航的可访问页面，并附上本地预览路由，方便评审直接交互查看。

完整交付面通常包含：

- 按组件家族组织的包导出子路径；
- 根入口兼容导出；
- CLI 注册表与 facade 生成配置；
- Component preset 与样式 Token 闭包（如风格库使用 preset）；
- 中英文文档页面；
- 消费真实公开包导出的交互 Demo；
- Web Component、React 与 Vue 预览；
- 通过 generator 更新后的派生数据文件。

#### 让官网 Demo 贴近真实安装体验

官网 Demo 应直接导入公开包路径，并使用开发者安装组件后自带的 Anatomy、Trigger、状态、事件与默认行为完成演示：

- Dialog 使用自带的 Trigger 打开，而不是靠外部按钮手动调用暴露方法；
- 自治组件无需在页面层另建状态或事件代理；
- 避免用页面私有 CSS、脚本或数据垫片掩盖组件或 Adapter 问题。

只有在组件按设计没有自然触发器（如 Toast 调用）或专门演示公开控制方法（如直接控制 Transition）时，才在组件外部保留最小化的公开 API 调用，并在 Demo 源码和 PR 中注明哪些胶水代码需由应用侧自行实现。

## 评审中的协作边界

对于已有的 Base 主题，作者可以自主推进并和评审一起收敛以下细节：

- 源码目录与文件组织；
- Token 与样式 `Rule` 的内部复用方式；
- 测试夹具与 Demo 展示形态；
- 公开 props、events、states、Anatomy 或 negative patch 的增删与调整；
- 第三方兼容范围或 `styled-only` 分类调整；
- 新增依赖评估。

只有当方案需要向 Base 体系准入一个全新的独立交互身份时，才需要单独确认 Base 准入；在确认前保持该新身份为 `draft` 即可，其余可逆的风格实现与测试工作均可正常推进。

## 参考实现

推荐按以下顺序阅读仓库中的已有案例，体会状态归属与测试组织方式：

1. 目标组件对应的 Base `P-*` / `T-*` 与源码；
2. `packages/prototypes/shadcn/src/button/` 及测试；
3. `packages/prototypes/shadcn/src/switch/` 及测试；
4. `packages/prototypes/brutalist/src/separator/` 及测试（观察同一 Base 协议在另一套设计语言中的落地方式）。

## 本地检查

先运行 Base 与风格层的聚焦单元测试，再执行：

```sh
corepack pnpm@10.32.1 check:styles:preset
corepack pnpm@10.32.1 check:component-presets
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 docs:build
```

并非所有风格库都使用 component preset，按实际适用的检查运行即可。若改动涉及包导出或依赖关系，补充运行包构建与 manifest 检查。

下一步：提交前对照[原型作者检查清单](/zh-cn/build/prototypes/checklist/)逐项核验。
