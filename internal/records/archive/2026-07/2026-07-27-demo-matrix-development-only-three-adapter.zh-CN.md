# 2026-07-27：Demo Matrix 恢复三 adapter 并排并退出生产构建

> Internal record. Not normative. 本文记录对 2026-07-26 Demo Matrix 体积优化的后续修正；前一记录继续保留当时的测量与历史事实。

## 问题

2026-07-26 的 monorepo build/size 优化把 Demo Matrix 从每个 demo 同时挂载 Web Component、React、Vue 三个独立 Previewer，改为只挂载一个可切换 adapter 的 Previewer。该变化把英文页面 HTML 从 1,505,613 B 降至 585,968 B，但同时移除了横向同时观察三个 adapter 产物的主要调试路径。

人工验收确认，这个取舍不符合 Demo Matrix 的内部工具定位。该页面的核心价值是快速比较所有 adapter，而不是作为生产文档向读者交付。

## 修正

- 恢复每个 demo 的 Web Components、React、Vue 三列独立 Previewer；宽度低于 960px 时仍折叠为单列。
- 中英文 Demo Matrix content entry 使用 Starlight 原生 `draft: true`。开发服务器继续生成并提供路由，production build 会在 routing 阶段过滤这两页。
- 不引入自定义路由 middleware 或构建后删除脚本；由文档框架既有 draft contract 同时保证开发可见与生产缺席。
- 2026-07-26 的尺寸优化记录不回写；它仍然描述当时的单 Previewer 实现和测量结果。rc.7 草案改为描述最终候选行为。

## 验收

- 开发路由 `/en/internal/demo-matrix/` 与 `/zh-cn/internal/demo-matrix/` 可访问，并报告 `demos × 3` 个 Preview mounts。
- 每个 demo 同时出现 Web Components、React 与 Vue 三个带标签的 Previewer。
- `astro build` 产物中不存在上述两个 `internal/demo-matrix/index.html`，sitemap 也不包含对应 URL。
