# Proto UI 0.3.0-alpha.0

> Draft release notes。本版本尚未发布；npm、Git tag、GitHub prerelease、dist-tag 与不可变 snapshot 证据仍待完成。

Proto UI 0.3.0-alpha.0 开启 0.3 的架构、API 与 Prototype 演进阶段。使用 alpha 是有意的：本阶段仍可接纳经过评审的架构调整、顶层 API 变化与新能力，它不是 release candidate，也不构成 stable compatibility 承诺。

## Expose Event ownership

- 新增公开 package `@proto.ui/module-expose-event` 与独立 `ExposeEventModuleDef`。
- 将 outward-signal facade implementation 与 `EXPOSE_EVENT_SINK_CAP` consumption 从 User → Component Event Module 移出。
- 以 Expose core registry 作为唯一 declaration registry，删除 Event 持有的重复 key map。
- 将 standard Runtime 以及 React、Vue、Web Component Adapter profile 迁移到 `expose-event` wiring。
- 在 `@proto.ui/module-event` 暂时保留 deprecated source re-export 与完全相同的 legacy token identity；Adapter wiring 必须从 `event` 迁移到 `expose-event`。

## Release governance

- 明确 alpha、beta 与 rc 的稳定化阶段语义；rc 只用于被认为可晋升 stable 的候选版本。
- 将当前 43 个公开 package 对齐到精确的 `0.3.0-alpha.0` 生态身份。
- 为 0.3 contribution 提供已声明的精确 V-entity version，同时继续让每个 feature 或 package 变化独立接受评审。
- 未来新增公开 package 的 identity 与 registry bootstrap 仍由引入它们的实现 PR 负责。
- 已提前完成 `@proto.ui/module-expose-event` npm identity bootstrap 与 Trusted Publisher 绑定；其 deprecated placeholder 不构成 release evidence。

## Image View

- 新增公开 package `@proto.ui/module-image-view`，并将其纳入精确的 43-package release identity，作为 Base Image 与 Runtime 使用的 host-mediated image presentation protocol。
- 通过可执行 fake-host 与 runtime 证据覆盖 generation-bound loading、stale completion rejection、replacement visual clearing、显式 accessibility mode，以及 Base Image 的 controlled/uncontrolled source ownership。
- 首次 `@proto.ui/module-image-view` npm identity bootstrap、受保护 release workflow 配置与 registry readiness 仍是发布前显式门禁；bootstrap 不得占用 `latest` 或 `next`。

## Official Vue 2 Adapter

- 接纳 `@proto.ui/adapter-vue2` 作为面向 Vue `>=2.6.0 <2.7` 的 official Web Adapter profile，并与 Vue 3 的 `@proto.ui/adapter-vue` package 保持独立。
- 将 Vue 2 纳入公开 Previewer registry，以及共享 Dialog、Select controlled-value 与 Scroll Area Move conformance journey。
- 补齐公开 package metadata、精确版本 BOM、lifecycle / view-epoch 回归证据与 `A-VUE-2-0001` profile。
- 首次 npm identity bootstrap 与 Trusted Publisher 配置仍是发布前显式门禁；本 draft 不声称 package 已经可从 npm 安装。

## 发布状态

本准备变更不发布 package、不创建 `v0.3.0-alpha.0`、不移动 npm `next`，也不激活 `V-PROTO-UI-0009`。这些动作必须在变更合入 `main` 后，基于最终已评审 package set 通过完整 release rehearsal、受保护发布与独立 evidence review 完成。
