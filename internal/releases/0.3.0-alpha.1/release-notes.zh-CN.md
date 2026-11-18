# Proto UI 0.3.0-alpha.1

> 已于 2026 年 9 月 20 日通过 npm `next` channel 发布。已发布 `package-bom-0.3.0-alpha.1.json` 发行物料列出的 43 个公开 package、`v0.3.0-alpha.1` tag、prerelease GitHub Release 与不可变 spec snapshot 共享这一精确发行身份。

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

## 发版验证

受保护的发布 workflow 运行 <https://github.com/Proto-UI/Proto-UI/actions/runs/35504873221> 对 head `e7961001af1d313b1518be694f866b0e98337b0d` 的结论为 `success`，该 commit 正是 `v0.3.0-alpha.1` lightweight tag 解析到的对象。npm 在 `2026-09-20T10:24:41.722Z` 写入首个 package，在 `2026-09-20T10:31:33.390Z` 写入最后一个 package；prerelease GitHub Release 的发布时间为 `2026-09-20T10:28:40Z`。已发布发行 BOM 中的全部 43 个 package 都存在精确版本 `0.3.0-alpha.1` 且带 registry integrity，`next` 对每一个都解析到 `0.3.0-alpha.1`。该 Release 附带的不可变 spec snapshot 的 SHA-256 为 `e483b661a09bb333b12c99d9639c016cb5bb6829281b939012859864ea8754ee`，与其已发布 checksum 文件一致。npm 未为这些版本发布 `gitHead`，因此 commit 绑定来自发布 workflow 的 head 与 tag 目标，而不是 registry metadata。

这些发行事实已于 2026-11-17 与 2026-11-18 从 npm registry 与 GitHub release API 复读。它们只描述本次已发布发行：不激活 `V-PROTO-UI-0010`，也不对后续任何 release train 作断言。
