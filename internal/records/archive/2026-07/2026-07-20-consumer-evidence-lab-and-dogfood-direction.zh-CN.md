# 2026-07-20 外部消费证据 Lab 与内部狗粮方向记录

> Internal record. Not normative. 本文记录 `0.2.0-rc.0` 发布后，对仓库外消费证据、内部应用狗粮、journey 与证据回流方式的一次阶段性讨论。稳定规则仍应分别提升到 Lab 仓库约定、官网贡献文档、发布治理或对应 spec 实体；本文不替代这些真相源。

---

## 1）背景

Proto UI `0.2.0-rc.0` 已形成首条全局精确 release train。仓库现有自动验证能够证明：

- 公开 package 可以 staging、pack 并形成精确依赖闭包。
- React + Vite 隔离 consumer 可以完成 CLI 生成、类型检查、production build 与有限运行时断言。
- CLI smoke 可以为 React、Vue 与 Web Component 生成 facade。
- 官网已有 `PrototypePreviewer` 与跨 adapter `DemoMatrix`。

这些证据仍不能回答真实使用者在仓库外会经历什么。当前缺少可复验的人工记录来说明：

- 第一次安装和第一次成功需要多少步骤。
- 生成组件的实际 API 是否容易发现和组合。
- 文档是否足以让使用者独立完成任务。
- 浏览器中的焦点、Portal、键盘、reduced motion 与样式是否成立。
- 真实工程配置、CSS、SSR、bundle 与第三方依赖是否形成阻力。
- 一个旧 consumer 升级到下一条 minor release train 时需要修改什么。

同时，官网与 Workspace 是 Proto UI 自身长期维护的真实应用。它们能够提供复杂且持续的狗粮证据，但都位于 monorepo 内，不能替代 registry 安装与独立 lockfile。

相关既有记录：

- `internal/records/2026-07-18-0.2-closure-and-followup-roadmap.zh-CN.md`
- `internal/records/2026-07-19-react-release-consumer-smoke.zh-CN.md`
- `internal/records/2026-07-20-0.2-rc-post-publication-priority-audit.zh-CN.md`

## 2）当前判断：建立互补证据组合

不寻找一个同时承担所有目标的“完美外部项目”。当前采用四种互补证据角色：

1. **内部 HEAD 狗粮**：官网与 Workspace 使用当前工作树，尽早暴露集成问题。
2. **外部 release consumer**：独立项目只消费 registry 中的精确版本，验证真实安装与应用使用。
3. **跨版本 upgrade lane**：从上一 minor 的冻结 consumer 升级到当前 minor，记录失败和迁移成本。
4. **专业 authoring canary**：后续用很小的仓库外 styled prototype 试验验证组件物料作者体验。

官网、Workspace、自动 smoke 与外部 Lab 不是替代关系：

- 自动 smoke 证明最低机械闭包。
- 外部 Lab 证明当前 release 的使用体验。
- 官网和 Workspace 证明 HEAD 在长期复杂应用中的表现。
- upgrade lane 证明版本演进成本。

## 3）外部 Lab 仓库形态

建立一个位于 Proto UI GitHub 组织下的公开 Git 仓库。该仓库前期作为可审计工程证据留档，不主动作为官网 Showcase 或营销入口。

仓库采用“单 Git 仓库、多个隔离项目”的形态：

- 不声明 npm/pnpm/yarn workspace。
- 每个实验拥有独立 `package.json`、lockfile、构建配置和 CI job。
- 实验之间不得依赖彼此源码或共享 `node_modules`。
- 根目录只维护 README、证据模板、命名规则与 CI 约定。
- 不使用 Proto UI monorepo 源码、`workspace:*`、软链接或未发布入口。
- 每份证据固定 Proto UI 精确版本；dist-tag 只能作为便利验证，不能成为记录身份。

概念结构：

```text
proto-ui-labs/
  README.md
  evidence-template.md
  experiments/
    react-shadcn-api-0.2/
      package.json
      package-lock.json
      evidence.md
    vue-shadcn-api-0.2/
      package.json
      pnpm-lock.yaml
      evidence.md
    wc-content-site-0.2/
      package.json
      package-lock.json
      evidence.md
```

具体仓库名称、package manager 选择和目录名可以在创建时调整；独立 lockfile 与无 workspace hoisting 是稳定边界。

## 4）首轮 journey：Shadcn API field study

首轮不急于模拟复杂业务产品，而先系统试用 Proto UI Shadcn 产物的 API 与功能面。原因是当前官网组件 API 文档尚不完整；先建立消费视角的 API 事实，能够直接反哺文档结构，并为后续真实任务流提供可靠组件知识。

首轮以 React + TypeScript + Vite 为起点，使用当时公开的推荐安装方式完成：

- CLI `--help` 与 `init`。
- 添加 Shadcn Button、Switch、Select、Dialog，并根据试用需要扩展其他 family。
- 记录生成的 facade、导入入口、anatomy parts 与宿主 API。
- 观察 props、events、slots/children、methods/exposes、controlled/uncontrolled 与状态更新。
- 观察组件组合、样式接入、dev server、类型检查与 production build。
- 在真实浏览器中观察键盘、焦点、Portal、reduced motion、remount 与基础 a11y。
- 标记 API 存在但难以发现、文档遗漏、API escape 与宿主差异。

首轮主要目标不是把所有组件变成自动测试，而是回答：

1. 一个外部使用者实际拿到了什么 API。
2. 组件 API 文档应采用怎样的统一结构。
3. 当前哪些缺口最阻碍第一次成功与正确组合。
4. 哪些观察应进入官网，哪些应回到 CLI、Prototype、Adapter 或 spec。

## 5）Markdown evidence 基线

前期证据以 Markdown 为主，不要求先建立专用 schema 或测试框架。每个实验至少记录：

- 实验 ID、日期与目标。
- OS、Node、package manager、宿主框架、bundler 与浏览器版本。
- Proto UI 精确 release version。
- 从空目录开始的命令与安装结果。
- CLI 生成文件与必要的手工修改。
- 组件/API inventory。
- 尝试的任务与可观察结果。
- 类型、构建、运行时、CSS、a11y、SSR 与 bundle 发现。
- API escape、错误信息与文档缺口。
- 与 Proto UI issue、record、`P-*`、`T-*`、`M-*`、`HC-*` 的关联。
- 当前结论、未确认项与后续建议。

当某项行为稳定且需要防回归时，再逐步把 Markdown 观察提升为浏览器测试、conformance fixture 或 Proto UI `T-*` 实体。Markdown 本身不是规范真理之源。

## 6）Journey 与版本的关系

Journey 首先描述稳定的用户任务和可观察结果，不与某一套 API 写法绑定。每个新 minor 应同时保留：

- **Fresh install**：从空项目按当前文档重新完成任务。
- **Upgrade**：从上一 minor 的冻结 baseline 直接升级，先保存原始失败，再完成迁移。

Lab `main` 只维护当前推荐实现。历史可工作 consumer 通过 Git tag、release artifact 或明确 baseline 保存，不在主分支持续复制多套长期维护目录。

完整版本生命周期见：

- `internal/records/2026-07-20-calendar-release-and-support-lifecycle-direction.zh-CN.md`

## 7）官网狗粮边界

官网是复杂内容站和多 adapter 集成 canary，但不是外部安装证据。当前决定采用“消费者墙”：

- 普通官网/Starlight 应用代码不得直接消费 `@proto.ui/core`、runtime、module、adapter 或 raw prototype library。
- 应优先消费 CLI 生成的 Web Component 组件和稳定样式入口。
- prototype/style 基础设施区域由核心维护者负责；当前核心维护者包括项目维护者在内共两人。
- 外围贡献者无需为了修改官网学习 prototype authoring。
- Proto UI 暂无合适原型时，外围贡献者可以按正常 Web/Astro 方式完成实现。
- 只有已经存在合适 prototype，或某个场景具有明确战略价值时，才建立低优先级 `dogfood-candidate` 跟进；不为每段原生交互机械制造迁移债务。

官网以 Astro/Starlight 为基础，优先消费 Web Component。但导航、搜索、语言选择等 SEO/可访问性关键区域不能只服务端输出空 custom element：

1. Astro 应先输出语义 HTML、内容与基础表单/链接。
2. 无 JavaScript 时关键内容仍可读取和导航。
3. Web Component adapter 在客户端渐进增强现有 light DOM 或等价语义结构。
4. hydration/upgrade 前后不得丢失关键内容、accessible name 与 SEO 信息。

如果当前 WC adapter 不能增强既有 SSR 内容，关键区域继续保留原生 Astro，相关缺口进入 adapter/host capability 研究，而不是由官网私有 hack 掩盖。

## 8）Workspace 狗粮边界

Workspace 是持续演进的内部 React 应用，适合验证：

- 长寿命状态与高频更新。
- 树、图、导航和版本对比。
- 大数据量、性能与键盘交互。
- 组件 API 在真实工具中的长期维护成本。

短期不安排纯迁移项目。下一次集中强化 GUI、图结构展示、预览或其他功能时，选择一个真实垂直区域开始消费 Proto UI 生成组件。普通应用代码同样遵守消费者墙；原型迭代由核心维护者承担。

## 9）证据回流

外部发现按以下顺序处理：

```text
原始观察
  -> Lab evidence.md
  -> Proto UI issue / internal record
  -> 实现或文档修正
  -> 稳定事实提升到 P/T/M/HC/Adapter profile 或治理文档
```

不允许 Lab 成为第二套规范真理之源。Lab 可以引用 spec entity ID，但运行时不得依赖 Proto UI 源仓库中的 YAML。

## 10）当前不做

- 不在第一轮前设计完整 Lab 数据库、仪表盘或专用证据 schema。
- 不要求首轮 API field study 覆盖全部组件和三个宿主。
- 不把 Lab 宣传为官方生产就绪 Showcase。
- 不建立统一跨宿主 UI DSL 来隐藏 React、Vue 与 WC 的实际使用差异。
- 不强迫官网或 Workspace 达成“全部 UI 必须由 Proto UI 生成”的纯度目标。
- 不把外部人工 journey 设为按时发布某个版本的必要门禁。

## 11）工作顺序

1. 创建公开 Lab Git 仓库与 Markdown evidence 模板。
2. 建立独立 React + TypeScript + Vite 实验及 lockfile。
3. 使用当前公开 package/CLI 路径完成 Shadcn API field study，形成改造前基线。
4. 根据消费结果设计组件 API 文档模板并回填官网优先页面。
5. 将安装、样式和本地化摩擦交给 CLI/Style Compiler 路线处理。
6. React 路线稳定后，分别建立 Vue 与 Web Component 独立实验。
7. 在下一 minor 首次完整执行 fresh install 与 previous-minor upgrade 两条车道。
8. 外部证据出现后，选择真实阻塞链推进 Module/HC/Adapter 垂直编目。

## 12）Open questions

- Lab 仓库正式名称、CI 平台与默认 package manager。
- 第一版组件 API 文档模板的字段和中英文投射方式。
- 哪些 Markdown 观察应提升为 Lab 自动测试，哪些应提升为 Proto UI `T-*`。
- 官网第一个适合 WC 渐进增强的 Starlight 组件。
- WC adapter 是否需要一等“增强既有 SSR/light DOM”能力或 profile。
- 专业 authoring canary 应在 Shadcn 本地化的哪个阶段开始。

## 13）后续提升目标

本记录中的稳定内容后续应分别提升到：

- Lab 仓库 README、evidence template 与贡献约定。
- Proto UI 官网贡献指南和内部应用 import policy。
- 真实浏览器 conformance tests 与对应 `T-*` 实体。
- WC adapter profile、Portal/SSR/host capability 实体。
- 版本治理与 upgrade workflow。
