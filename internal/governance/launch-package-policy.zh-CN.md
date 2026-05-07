# Proto UI 首发 Package 策略

> 内部治理文档。本文定义 Proto UI 在 `v0.1.0` 首次公开发布时，应如何划分 package 层级、哪些 package 属于首发承诺面，以及在最后准备窗口中新增什么样的 package 仍可计入首发范围。

---

## 1. 本文目的

Proto UI 当前已经拥有较多 workspace package，但第一次公开发布并不需要把所有 package 都打磨成同等成熟的 public surface。

这份文档用于明确：

- 哪些 package 属于 `v0.1.0` 的首发承诺范围
- 哪些 package 虽然可以公开、可以发布，但不属于首发承诺范围
- 哪些 package 在首发治理上应视为 internal 或 dependency-directed
- 在首发前最后一个月内，哪些新增 package 仍可纳入 `v0.1.0`

它是一份发版范围治理文档。

它不是用于解释每个 package 细节用途的长期参考文档。

---

## 2. Package 分层

对于 `v0.1.0`，Proto UI 的 package 应分成三层。

### 2.1 首发承诺包

这一层定义 Proto UI 首次公开发布真正对外承诺的 public surface。

它们必须成为以下工作的直接依据：

- README 对外口径
- Quick Start 对外口径
- smoke 验证
- release note
- 面向首发的 release scan 与 packaging 加固

这一层主要面向 `Maker`。

### 2.2 公开但非首发承诺包

这一层的 package 可以公开、可以发布，也确实拥有真实用户。

但它们不属于 `v0.1.0` 的默认 first-user story，第一次公开发布不应以它们是否被打磨到与首发承诺包相同成熟度来判断成功与否。

这一层主要面向：

- `Prototype Author`
- `Adapter Author`
- 贡献者
- 维护者

### 2.3 Internal 或 dependency-directed 包

这一层的 package 可能依然很重要，也可能因为依赖关系需要发布。

但在首发治理视角下，它们应被视为：

- 内部架构构件
- 依赖导向的能力面
- 不作为默认入口的底层包

它们不属于 `v0.1.0` 的 public promise surface。

---

## 3. `v0.1.0` 首发承诺包名单

当前 `v0.1.0` 的首发承诺包名单为：

- `@proto.ui/adapter-react`
- `@proto.ui/adapter-vue`
- `@proto.ui/adapter-web-component`
- `@proto.ui/cli`
- `@proto.ui/prototypes-base`
- `@proto.ui/prototypes-lucide`
- `@proto.ui/prototypes-shadcn`

这组 package 构成了第一次公开发布的主叙事：

- Proto UI 能通过官方 adapter 被直接消费
- Proto UI 提供官方 CLI 用于项目脚手架与维护工作
- Proto UI 提供官方维护的基础原型库
- Proto UI 同时提供 styled 与 icon-driven 两套贴近真实使用场景的 prototype library

如果某个 package 不在这个名单里，那么它不会因为“存在于 workspace 中”或“技术上可以发布”而自动进入首发承诺面。

---

## 4. `v0.1.0` 公开但非首发承诺包

当前“公开但非首发承诺”的 package 集合为：

- `@proto.ui/adapter-base`
- `@proto.ui/core`
- `@proto.ui/types`
- `@proto.ui/hooks`

这些 package 不是“无意义的内部实现”。

它们拥有明确的受众和存在价值。

但它们并不属于默认 Quick Start，也不属于首次公开发布的默认 first-user promise。

它们应被定位为：

- authoring surface
- advanced surface
- contributor-facing surface

它们可以出现在更深层的文档中，但不应挤占首发承诺包在对外主叙事中的位置。

---

## 5. `v0.1.0` Internal 或 dependency-directed 包

以下 package 在首发治理中应视为 internal 或 dependency-directed：

- `@proto.ui/runtime`
- `@proto.ui/module-base`
- `@proto.ui/module-anatomy`
- `@proto.ui/module-as-trigger`
- `@proto.ui/module-boundary`
- `@proto.ui/module-context`
- `@proto.ui/module-event`
- `@proto.ui/module-expose`
- `@proto.ui/module-expose-state`
- `@proto.ui/module-expose-state-web`
- `@proto.ui/module-feedback`
- `@proto.ui/module-focus`
- `@proto.ui/module-hit-participation`
- `@proto.ui/module-overlay`
- `@proto.ui/module-presence`
- `@proto.ui/module-props`
- `@proto.ui/module-rule`
- `@proto.ui/module-rule-expose-state-web`
- `@proto.ui/module-rule-meta`
- `@proto.ui/module-state`
- `@proto.ui/module-state-accessibility`
- `@proto.ui/module-state-interaction`
- `@proto.ui/module-test-sys`

这样的分层**不**意味着它们不重要。

它意味着：

- 它们不属于 `v0.1.0` 的对外主承诺面
- 它们不应扩张第一次发布的对外故事
- 它们是否发布，应主要由架构与依赖需要决定，而不是由首发营销范围决定

---

## 6. 这套分层会如何影响发版工作

对于 `v0.1.0`，package 分层应当实实在在影响后续工作方式。

### 6.1 文档

README、Quick Start、面向首发的 docs 应主要围绕首发承诺包来描述和验证。

公开但非首发承诺包可以出现在更深入的文档里，但应被视为高级用法或贡献者向内容。

Internal 或 dependency-directed 包不应被包装成 first-user path 的一部分。

### 6.2 Release Scan

面向首发的 release scan 与 packaging 加固，应以首发承诺包名单作为主要发版门槛。

其他 package 当然也可以继续扫描、继续改进，但除非它们会阻塞以下事项，否则不应拖慢 `v0.1.0`：

- 首发承诺包的发布
- 首发承诺包依赖链的正确性
- 首发 package surface 在文档中的真实表达

### 6.3 Smoke 验证

首发就绪性的 smoke 验证，应优先围绕首发承诺包来设计。

对非首发承诺包追加验证当然有价值，但属于第二优先级。

### 6.4 Release Communication

release note 与 launch messaging 应明确区分：

- 哪些 package 属于第一次公开承诺
- 哪些 package 虽然公开，但属于高级能力面
- 哪些 package 主要是内部架构层面的存在

---

## 7. 首发前最后一个月内新增 package 的准入规则

在 `v0.1.0` 前最后一个月内，只有同时满足以下条件的新增 package，才可以进入首发承诺范围：

- 它直接服务于一条已经冻结的首发路径
- 它不会扩大当前已经冻结的 `v0.1.0` 产品叙事
- 它对于首发承诺包的真实可用性、可发布性或真实性是必要的
- 它能够在首发前补齐最小文档、最小测试与最小 packaging 验证
- 它不会显著增加 release 流程复杂度

通常仍可能被接受的例子包括：

- 现有 adapter / prototype 首发路径所必需的 companion package
- 使 CLI 主路径或 Web Component script 路径成立所必需的 package
- 用于补上已冻结首发叙事中的 release blocker 的桥接包

---

## 8. 默认应后移到 `0.2.0` 或更晚的新增 package

在最后准备窗口中，以下类型的新增 package 默认应后移到 `0.2.0` 或更晚：

- 新的 adapter 家族
- 新的 prototype library 家族
- 新的 module 家族
- 主要服务于未来生态扩张，而不是已冻结首发路径的 package
- 不会阻塞首发承诺包、但主要服务于 authoring / contributor 的 package
- 价值真实存在，但首发前无法证明成熟度的 package

新增项需要自己证明为什么必须进 `v0.1.0`。

如果一个新增 package 说不清为什么非进 `v0.1.0` 不可，那它就应当进入下一条 minor 线。

---

## 9. 非目标

这份文档不试图：

- 逐一解释每个 package 的完整内部职责
- 取代架构文档
- 一次性定死所有 dependency-directed package 的长期公开策略

这些事情应当由另一份 package surface 参考文档承担。

---

## 10. 总结

对于 `v0.1.0`，Proto UI 应将 package 分成三层：

- 首发承诺包
- 公开但非首发承诺包
- Internal 或 dependency-directed 包

当前 `v0.1.0` 的首发承诺包名单为：

- `@proto.ui/adapter-react`
- `@proto.ui/adapter-vue`
- `@proto.ui/adapter-web-component`
- `@proto.ui/cli`
- `@proto.ui/prototypes-base`
- `@proto.ui/prototypes-lucide`
- `@proto.ui/prototypes-shadcn`

其他 package 是否进入当前发版范围，不应由“它是否存在于 workspace 中”决定，而应由“它是否支撑这条已冻结的首发故事”决定。

---

## 11. 机器可执行治理源（2026-04-16 起）

为避免“文档与流水线口径漂移”，首发 package 治理从 2026-04-16 起新增一份机器可读配置：

- `internal/governance/launch-package-governance.json`

该文件用于驱动 `scripts/release/scan.mjs` 与 `scripts/release/publish.mjs` 的 `--profile launch` 模式。

关键约束如下：

- `launchCommitmentPackages`：首发承诺包，默认进入首发发布集合
- `candidatePackages`：候选包集合，必须逐个标注状态
- 候选包状态仅允许：
  - `approved`：允许通过 `--include-approved-candidates` 进入发布集合
  - `pending`：尚未准入，不得进入发布集合
  - `deferred`：明确后置，不得进入发布集合
- 新增 package 不会自动上车，必须先进入治理文件并完成准入决策

这保证了：

- 首发范围可被 CI/发布流水线直接执行
- `input` 这类可能引入新 module 或底层 API 的项可以逐个决策上车
- 首发范围扩展是“显式治理动作”，而不是“仓库里出现了就默认发布”
