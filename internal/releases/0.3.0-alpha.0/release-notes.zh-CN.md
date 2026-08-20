# Proto UI 0.3.0-alpha.0

> Draft release notes。本版本尚未发布；npm、Git tag、GitHub prerelease、dist-tag 与不可变 snapshot 证据仍待完成。

Proto UI 0.3.0-alpha.0 开启 0.3 的架构、API 与 Prototype 演进阶段。使用 alpha 是有意的：本阶段仍可接纳经过评审的架构调整、顶层 API 变化与新能力，它不是 release candidate，也不构成 stable compatibility 承诺。

## Release governance

- 明确 alpha、beta 与 rc 的稳定化阶段语义；rc 只用于被认为可晋升 stable 的候选版本。
- 将当前 40 个公开 package 对齐到精确的 `0.3.0-alpha.0` 生态身份。
- 为 0.3 contribution 提供已声明的精确 V-entity version，同时继续让每个 feature 或 package 变化独立接受评审。
- 未来新增公开 package 的 identity 与 registry bootstrap 仍由引入它们的实现 PR 负责。

## 发布状态

本准备变更不发布 package、不创建 `v0.3.0-alpha.0`、不移动 npm `next`，也不激活 `V-PROTO-UI-0009`。这些动作必须在变更合入 `main` 后，基于最终已评审 package set 通过完整 release rehearsal、受保护发布与独立 evidence review 完成。
