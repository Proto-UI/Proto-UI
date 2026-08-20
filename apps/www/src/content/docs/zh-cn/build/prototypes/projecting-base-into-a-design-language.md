---
title: '从 Base 投射风格化 Prototype'
description: '在不重定义 Base 语义的前提下交付设计语言 P 实体、实现、测试、导出和 Demo。'
---

风格化投射是 0.3 阶段最适合开放给 Prototype 作者的完整贡献路径。它的前提不是“这个组件在某个设计系统里存在”，而是 Base 已经拥有可复用协议，新的 Prototype 只负责设计语言表面和经过编目的差异。

## 开始前必须满足的条件

- 对应 Base `P-*` 实体和 `T-*` evidence 已经存在；
- Issue 明确列出 Base owner、derived identity 和 lifecycle status；
- Base 拥有的 state、event、focus、accessibility、context、positioning 或 host-capability 责任已经写清楚；
- 设计语言允许增加的 props、tokens、rules、anatomy 和兼容范围已经写清楚；
- Issue 明确允许开始实现，而不是仍处于 `needs maintainer design`。

缺少任何一项时，先完善 Issue，不要靠复制现有风格库代码推断边界。

## Base projection 与 styled-only 的区别

### Base projection

当设计语言对象需要复用 Base 已有的信息通路时，derived P 通过 `inherits.prototypes` 和对应 `asHook` 继承 Base。它可以增加表现，但不能创建竞争 owner。

### Styled-only

当对象只拥有设计语言 props、视觉规则、内容模型或视觉 anatomy，且没有值得进入 Base 的独立跨宿主协议时，它可以是正式 styled-only P。不要为了获得 inheritance hook 而制造空 Base 实体。

Base admission 的核心判断是：是否存在独立、跨宿主、可测试的 input-fact → observable-output 通路。目录名、anatomy 名或空 `asHook` 都不是证据。

## 交付顺序

### 1. 固定来源和兼容边界

对于 Shadcn、Lucide 或其他第三方设计语言，记录：

- 精确上游仓库和路径；
- revision、release 或 commit；
- license 与 notice；
- 哪些 API、tokens、assets 或视觉行为被复制、改写或只作比较；
- 哪些上游 API 明确不兼容或尚未支持。

原创设计语言也要明确它不是某个第三方系统的官方集成、克隆或认证实现。

### 2. 编写 derived P entity

P entity 应：

- 通过 `inherits.prototypes` 指向 Base identity；
- 只为 derived surface 写 criteria；
- 对任何 setup-time negative patch 明确声明放弃或替换了哪项 Base 能力；
- 声明 design-language props、variant、tokens、visual anatomy 和公开兼容边界；
- 关联 substantive `T-*` evidence 和真实 source path。

不要在 derived P 中复制整份 Base criteria，也不要把未实现的上游 API 写成承诺。

### 3. 从 Base `asHook` 建立实现

实现通常先调用对应 Base `asHook`，再增加：

- design-language props；
- `feedback.style` tokens；
- 基于 Base states 或 meta 的 rules；
- 必要且经过编目的视觉 anatomy；
- derived library 自己的类型和公开入口。

如果实现开始重新维护 Base value、事件请求、焦点、a11y、dismissal 或 positioning，说明所有权已经漂移，应停止并回到 Issue。

### 4. 验证正向与缺失保证

Focused tests 至少覆盖：

- derived entry 确实消费正确的 Base entry；
- design-language props 和默认值；
- 关键状态下 token/rule 输出；
- unsupported variants、events、parts 或兼容 API 保持缺失；
- 没有第二个 value、event、focus、activation 或 accessibility owner；
- exact package/root exports。

只测试截图或 className 不足以证明协议继承正确。

### 5. 完成公开交付面

每个新增公开 Prototype identity 或 anatomy family 都必须在同一 PR 中进入官网可访问页面。这不是可由 Issue 省略的可选投影。页面应接入对应原型库的文档入口，并让 reviewer 能通过 PR 中记录的本地路由交互检查。

完整交付面包括：

- anatomy-family package subpath；
- root compatibility export；
- CLI registry 和 facade generation；
- component preset 与 token closure；
- 中英文文档；
- 真实 package export Demo；
- Web Component、React、Vue 预览；
- 生成的 workspace/Agent projection。

生成文件必须通过 generator 更新。

#### 官网 Demo 应拟合安装后的使用方式

官网 Demo 必须消费真实公开 package export，并尽量只使用开发者安装该 Prototype 后就能获得的 anatomy、trigger、state、event、props 和默认行为。不要为了演示效果在页面层重新实现组件本应自治完成的控制流。

- Dialog 应通过自身 Trigger 请求打开，而不是让一个无关 Button callback 调用 Dialog expose；
- 自治 Prototype 不应为了 Demo 引入额外 state owner 或事件 owner；
- 页面私有 CSS、脚本或 fixture 不得掩盖 Prototype、Base inheritance 或 Adapter 问题；
- 内部 Demo Matrix 是补充验证，不替代官网页面。

只有 Prototype 按设计没有自然 trigger，或其公开 controls 本身就是演示对象时，才允许最小外部 orchestration。Toast-style invocation 和直接驱动 Transition 是典型例外。例外必须位于 Prototype 之外、只使用公开 API，并在 Demo source 与 PR 中说明为什么不可避免、哪些代码不会随 package 安装且需要消费者自行实现。

## 贡献者可以决定什么？

在 frozen issue boundary 内，贡献者通常可以决定：

- source 文件组织；
- token 和 rule 的内部复用方式；
- focused test 的具体 fixture；
- Demo 如何清楚展示已批准的 states；
- 不改变公开语义的局部重构。

需要 maintainer checkpoint 的内容包括：

- 新增或删除公开 props、events、states 或 anatomy identity；
- 改变 Base ownership；
- 新增 negative patch；
- 扩大第三方 compatibility claim；
- 从 projection 改为 styled-only，或反向改变；
- 引入新 dependency。

## 参考实现

建议按顺序阅读：

1. 对应 Base P/T 和 package source；
2. `packages/prototypes/shadcn/src/button/` 与测试；
3. `packages/prototypes/shadcn/src/switch/` 与测试；
4. `packages/prototypes/brutalist/src/separator/` 与测试，用来理解同一 Base 协议如何进入另一个设计语言。

学习它们的 owner 边界和 evidence 结构，不要逐文件机械复制。

## 验证

先运行 Base 与 derived focused tests，再运行：

```sh
corepack pnpm@10.32.1 check:styles:preset
corepack pnpm@10.32.1 check:component-presets
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 docs:build
```

并非每个风格库都使用 component preset；PR 应说明哪些检查适用。影响 public package graph 时，还要运行 package build、manifest 和 consumer smoke。

下一步：提交前使用[原型作者检查清单](/zh-cn/build/prototypes/checklist/)。
