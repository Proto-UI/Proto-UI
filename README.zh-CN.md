# Proto UI

**Proto UI 是一份与框架无关的组件交互协议，也是一套把同一个原型投射到不同宿主的工具链。**

Proto UI 的“原型（Prototype）”描述组件的身份与交互语义，Adapter 再把这份协议翻译为 React、Vue、Web Components，以及未来更多平台中的具体组件。目标是让交互逻辑变得明确、可测试、可复用，并能跨生态迁移。

中文 | [English](README.md)

> **当前状态：** Proto UI 是一个 v0 项目。精确版本 `0.2.0` 已通过 npm 稳定 `latest` channel 发布。0.2 release line 的稳定发布不等于 v1 兼容性承诺；用于生产环境前，请先评估当前边界。

## 核心思路

组件实现在不同框架中会发生变化，但它所表达的交互主体应当保持可识别。Proto UI 将这两个层次拆开：

```text
Prototype protocol -> Adapter -> Host component instance
```

Prototype 负责可移植行为和语义身份，Adapter 负责将它翻译到具体宿主。应用仍然使用原生框架的方式组合和消费最终组件。

因此，Proto UI 并不是要再发明一个应用框架，而是希望与现有技术栈协作。

基于 Compiler 的输出仍是长期方向：

```text
Prototype protocol -> Compiler -> Host component code
```

当前发布采用 Adapter 架构；Compiler 输出与零运行时交付还不是已经发布的保证。

## 从稳定版 0.2.0 开始

公开上手流程使用 npm `latest`。在本次发行中，`@latest` 解析到 `0.2.0`；CLI 会按自身精确版本安装 Adapter 与 Prototype package，使整个生态保持在同一条 release train：

```sh
npx @proto.ui/cli@latest --help
npx @proto.ui/cli@latest init
npx @proto.ui/cli@latest add react shadcn-button
```

请在已有应用项目中执行 `init` 和 `add`。CLI 会创建本地 `proto-ui/` workspace，安装版本完全一致的官方 package，生成样式预设和宿主专用的 component facade。

完整的生成路径、样式引入、带类型组件使用、多宿主方式和当前限制见[快速开始](https://proto-ui.com/zh-cn/start-here/quick-start/)。发行证据见 [v0.2.0 Release](https://github.com/Proto-UI/Proto-UI/releases/tag/v0.2.0)。

## 目前已经具备的能力

- 面向 **React**、**Vue** 和 **Web Components** 的官方 Adapter。
- 用于表达可复用交互协议的 Base prototype library。
- 在 Base 协议之上叠加设计语言表面的 Shadcn 衍生 prototype library。
- 支持按图标路径引入的 Lucide 衍生 icon prototype library。
- 用于初始化、精确版本安装、样式生成和宿主组件 facade 的 CLI。
- 经过机器校验的 spec catalog，将 Knowledge、Decision、Contract、Prototype、Module、Host Capability、conformance case 与可执行测试路径连接起来。

## 当前边界

- `0.2.0` 已稳定发布到 npm `latest` channel，但 v0 API、生成结构与协议细节仍可能在后续版本中继续演进。
- 当前 CLI 会安装官方 Prototype package 并生成本地 component facade；暂时还不会把 styled prototype 源码写入应用项目供直接编辑。
- Shadcn 兼容是明确目标，但尚不完整；当前模型有意不提供 Radix 风格的 `asChild`。
- Adapter 架构仍然携带 runtime；Compiler 输出与零运行时交付属于未来工作。
- 文档、真实项目试用证据、SSR 覆盖、可访问性验证和 bundle 分析仍在补充。
- 当前大部分 catalog 实体仍为 `draft`；进入 catalog 不等于已经成为稳定公共保证。

Proto UI 当前更适合实验、可控接入、组件系统研究，以及能够评估 v0 兼容性边界的团队。

## 项目真理之源与文档

Proto UI 以 [`spec/**`](spec/) 下的版本化实体作为机器治理的真理之源。实体生命周期必须参与判断：`active` 表示当前稳定保证，`draft` 表示已经编目但仍在推进中的定义。

旧的 [`internal/contracts/**`](internal/contracts/) 文档正在被逐步取缔。它们仍可用于解释和补充尚未完全编目的领域，但不能覆盖适用的 spec 实体。短期方向和日常工程历史放在 [`internal/records/**`](internal/records/)，并且始终是非规范记录。

面向贡献者与 Agent 的入口：

- [Agent 仓库指引](AGENTS.md)
- [Spec catalog 指引](spec/README.md)
- 自动生成的项目理解：运行 `corepack pnpm@10.32.1 spec:docs:agent`，再按 [AGENTS.md](AGENTS.md) 说明阅读被 Git 忽略的本地文件
- [贡献指南](CONTRIBUTING.md)

## 仓库导航

- [`spec/`](spec/)：机器治理的项目实体。
- [`packages/spec/`](packages/spec/)：schema、校验、快照与关系图工具。
- [`packages/core/`](packages/core/)：核心协议语法与基础原语。
- [`packages/runtime/`](packages/runtime/)：Adapter 阶段的 runtime 与编排。
- [`packages/modules/`](packages/modules/)：可复用语义 Module。
- [`packages/adapters/`](packages/adapters/)：React、Vue、Web Component 及共享 Adapter 实现。
- [`packages/prototypes/`](packages/prototypes/)：Base、Shadcn 与 Lucide prototype library。
- [`packages/cli/`](packages/cli/)：项目初始化、facade 生成与样式工具。
- [`apps/www/`](apps/www/)：公开文档与 Demo。
- [`apps/workspace/`](apps/workspace/)：内部 spec workspace UI。
- [`internal/governance/`](internal/governance/)：发布与 package 治理。
- [`internal/releases/`](internal/releases/)：release note、BOM 与发行证据。

## 本地开发

请使用当前 CI 基线 Node.js 22，并通过 Corepack 使用 `package.json` 中声明的 pnpm 版本；该版本已与 lockfile 和 CI 对齐。

```sh
corepack pnpm@10.32.1 install --frozen-lockfile
corepack pnpm@10.32.1 docs:dev
```

常用仓库检查：

```sh
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 test
```

## 近期方向

当前工作的重点是：在真实项目中使用稳定版 `0.2.0`，修复上手或语义 blocker，依据消费证据持续完善文档，并在不无序扩张 Prototype surface 的前提下准备后续发行工作。

Module、Host Capability 与 Adapter 的系统编目会根据真实消费证据，以完整垂直切片继续推进。Compiler 方向和可在本地编辑的 styled prototype 工作流仍属于长期方向，而不是当前版本承诺。

路线方向记录在 [`internal/records/**`](internal/records/)；发行身份与稳定语义仍由 spec 和发布证据治理。

## 谁可能会感兴趣

- 组件库与设计系统作者
- 关注交互质量的前端工程师
- HCI 从业者和研究人员
- Adapter、Compiler 与跨平台工具作者
- 希望探索基础 UI 架构的贡献者

## 贡献与讨论

- **官网：** [proto-ui.com](https://proto-ui.com)
- **GitHub Issues：** [Proto-UI/Proto-UI](https://github.com/Proto-UI/Proto-UI/issues)
- **贡献指南：** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Discord：** [加入社区](https://discord.gg/MrWQd7h34R)
- **邮箱：** guangliang2018@foxmail.com

欢迎参与协议、测试、Adapter、Prototype library、文档和消费证据建设。

## License

MIT
