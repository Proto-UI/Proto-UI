# 2026-04-14 v0 Quick Start 路线决策

> Internal record. Not normative. 本文用于明确 Proto UI v0 首次公开发布时，官方 Quick Start 应采用哪条主路径，以及 README / Quick Start 后续应遵循的口径。

---

## 1）背景

当前首次公开发布最核心的阻塞项，不是实现能力本身，而是首个官方上手路径仍未冻结。

现有 Quick Start 仍包含“CLI 暂不可安装”的说明，因此它描述的是未来流程，而不是当前真实可执行的流程。

如果这件事不先定下来，则后续以下工作都无法稳定推进：

- README 对外口径
- EN / ZH Quick Start 重写
- clean environment smoke 验证
- 首发 package / prototype 子集的验证方式

因此，这个决策属于多个发版任务的上游依赖。

---

## 2）问题定义

v0 首次公开发布时，官方 Quick Start 到底应采用哪条路径：

- `manual install`
- `最小 CLI`

这里的“官方 Quick Start 路线”指的是：

- README 中推荐给新用户的首要路径
- docs 中 Quick Start 页面默认采用的安装与接入方式
- release 叙事中用于证明“用户确实能跑起来”的那条标准路径

---

## 3）决策

### 3.1 总体决策

Proto UI v0 首次公开发布时，官方 Quick Start 采用以下策略：

- 以 `CLI 安装` 作为默认主路径与推荐路径
- 对 Web Component 场景，将 `CLI 安装` 与 `HTML 引入（script 标签）` 视为并列主路径
- `manual install npm packages` 仅作为支持但不推荐的备选路径保留

### 3.2 Web Component 的特殊处理

对于 Web Component 场景，`CLI 安装` 与 `HTML 引入（script 标签）` 的权重应视为并列。

也就是说：

- 对 React / Vue 等典型模块化前端项目，Quick Start 的主叙事优先采用 CLI
- 对 Web Component 场景，不应强行把 CLI 描述成唯一正确入口
- Web Component 相关文档可以同时提供 CLI 与 `HTML 引入（script 标签）`，并在文案上保持并列地位

### 3.3 文档执行口径

从本决策起：

- README 的推荐安装路径应以 CLI 为准
- EN / ZH Quick Start 的默认主路径应以 CLI 为准
- Web Component 文档可根据场景把 CLI 与 `HTML 引入（script 标签）` 并列呈现
- `manual install npm packages` 不应再作为主 Quick Start 的主体路径
- `manual install npm packages` 可保留在 alternative setup 或 advanced installation 一类的位置中

---

## 4）为什么选择 CLI 作为主路径

### 4.1 它更符合现代前端项目的实际使用环境

Proto UI 面向的首批用户，大多数仍然是在依赖 Node、构建工具与模块化工程体系的前端项目中使用它。

即使是 Web Component，也不一定只是在裸 HTML 页面中直接接入。很多实际使用场景仍然是把 Web Component 集成进现代前端项目。

因此，把 CLI 作为默认推荐路径，更接近多数真实使用环境，而不是更远离它们。

### 4.2 它更适合作为首个官方闭环

Proto UI 的安装与使用并不是单一包安装这么简单，至少还涉及：

- 安装 adapter
- 安装 prototype
- 组合 prototype 与 adapter，生成实际可用组件

相比手动安装，CLI 更不容易让用户在这些步骤之间出错，尤其是在“把原型和 adapter 组合为组件”这一步上，更适合作为对外统一路径。

### 4.3 它更容易支持按需安装

如果走手动安装，当前更自然的方式通常是安装整个 prototype library。

这样做在 v0 初期虽然还勉强可接受，但随着 prototype 数量继续增长，会逐渐形成额外负担。

CLI 则更容易走向“按需把原型写入用户项目”的模式，因此更适合作为长期也更有扩展性的首发路径。

### 4.4 它更容易针对用户项目上下文做安装调整

CLI 可以根据用户当前项目的具体情况做有条件的安装与生成，例如：

- 是否已经安装 Tailwind
- 是否需要更强的样式隔离
- 是否采用某种特定目录结构

相比之下，原型库发包时通常只能提供一套标准包形态，难以覆盖这些差异。

把 CLI 作为主路径，更有利于在“统一推荐入口”与“面向具体项目调整”之间取得平衡。

### 4.5 它更有利于后续的局部定制

手动安装时，用户往往需要基于包内原型做二次定制。

这通常意味着他们需要更早理解 Proto UI 原型体系本身，学习成本更高。

CLI 路径则可以直接把原型写入用户项目，使用户先从“修改已有原型”开始，而不是一开始就进入“编写原型”的学习阶段。

这会让上手成本更低，也让进一步深入学习 Proto UI 的曲线更平滑。

---

## 5）为什么 Web Component 需要保留 `HTML 引入（script 标签）` 这条并列主路径

对于 Web Component 场景，`HTML 引入（script 标签）` 应被视为一条自然且合理的官方入口。

原因包括：

- 它对应的是 Web Component 最直接、最原生的使用方式
- 它适合不依赖复杂工程化环境的演示、嵌入与快速验证场景
- 它能帮助 Proto UI 在 Web Component 场景下提供一条更低门槛、更贴近平台本身的接入路径

因此，在 Web Component 文档里，把 CLI 与 `HTML 引入（script 标签）` 作为并列主路径，比把 CLI 与 manual npm install 并列更合理。

---

## 6）为什么不把 `manual install npm packages` 设为主路径

本次并不是否定 `manual install npm packages` 的价值。

保留它仍然是必要的。

但不把它设为主路径，主要有以下原因：

- 它更容易在 adapter、prototype 与组件组合步骤上出现人为差错
- 它不够适合作为统一对外推荐路径
- 它更难天然支持按需安装指定 prototype
- 它对项目环境差异的适配能力较弱
- 它把更多 Proto UI 内部机制暴露给首批用户，增加首次上手负担

因此，`manual install npm packages` 更适合作为：

- fallback 路径
- 解释底层结构的参考路径
- 高级使用者或调试场景下的补充路径

而不是作为整个 v0 首发的统一主叙事。

---

## 7）为什么不建议完全取消 `manual install npm packages`

虽然 `manual install npm packages` 已经不再适合作为推荐路径，但 v0 首发仍不建议彻底移除这条路径。

原因包括：

- 手动安装仍然是理解 package 结构与底层拼装方式的重要参考
- 某些环境下，用户可能暂时不适合直接使用 CLI
- 如果 CLI 在某些边界条件下能力不完整，manual install 仍是必要兜底

因此，本决策不是“只保留 CLI 和 HTML 引入，完全删除 manual npm install”。

而是：

- 默认推荐 CLI
- Web Component 场景下，CLI 与 HTML 引入并列
- manual npm install 保留为支持但不推荐的备选路径

---

## 8）后续动作

基于本决策，后续文档与验证工作应遵循以下顺序：

1. 将 README 的推荐安装口径改为 CLI 主路径。
2. 将 EN / ZH Quick Start 的默认路径改为 CLI。
3. 在 Web Component 相关文档中并列呈现 CLI 与 `HTML 引入（script 标签）`。
4. 将 `manual install npm packages` 移出主 Quick Start，保留到 alternative setup 或 advanced installation 一类的位置。
5. 基于该路径设计并执行 clean environment smoke 验证。

---

## 9）结论

Proto UI v0 首次公开发布的官方 Quick Start 路线确定为：

- 默认推荐：`CLI 安装`
- Web Component 场景下并列主路径：`CLI 安装` 与 `HTML 引入（script 标签）`
- 支持但不推荐：`manual install npm packages`

从现在开始，README 与 Quick Start 的后续修改都应以此决策为准。
