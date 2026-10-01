# Proto UI 0.3.0-alpha.1

> Draft release notes。本版本尚未发布；npm、Git tag、GitHub prerelease、dist-tag 与不可变 snapshot 证据仍待完成。

Proto UI 0.3.0-alpha.1 是 0.3 alpha release train 的可测试延续。它仍然是 alpha：不是 release candidate，也不构成 stable compatibility 承诺。

## Vue 2 CLI 与 Base Image

- 扩展官方 CLI 的 Adapter registry 与生成 facade 路径，使其识别 `vue2`。
- Vue 2 consumer 可通过与其他受支持 Web Adapter profile 相同的组件生成路径添加 Base Image Prototype。
- 将公开 Base Image 文档和 Demo Matrix 与已接纳的 `A-VUE-2-0001` profile 对齐，并提供亮色、暗色、桌面和移动端 browser evidence。

## Consumer 证据

- 在发布 CLI smoke suite 中增加隔离的 Vue `2.6.14` tarball consumer。
- 核验 CLI 生成的 Vue 2 Button 与 Base Image 组件可在 browser-like runtime 挂载和渲染。

## Registry readiness

- npm 无法移除唯一 bootstrap 版本上的 `latest` 时，保留其 deprecated bootstrap 遗留状态，但不让它进入 release channel。
- 仅当 `next` 指向一个已存在的非 bootstrap prerelease 时允许该遗留状态；它不改变 `latest`，也不伪造 stable 替换版本。

## 发布状态

本准备变更不发布 package、不创建 `v0.3.0-alpha.1`、不移动 npm `next`，也不激活 `V-PROTO-UI-0010`。这些动作必须在变更合入 `main` 后，基于最终已评审 package set 通过完整 release rehearsal、受保护发布与独立 evidence review 完成。
