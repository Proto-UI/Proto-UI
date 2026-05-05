# v0 发布前后 Good First Issue 分发计划

日期：2026-05-04

## 目标

把 v0 发布前后值得开放给外部贡献者的工作拆成小任务，并用可审阅、可 dry-run、可重复执行的方式发布到 GitHub Issues。

## 发布原则

- 先模板化，再批量发布。模板保证每个 issue 都有目标、范围、验收标准、参考资料和非目标。
- 默认小范围。Good First Issue 应该能由新贡献者独立完成，或至少能独立产出一个可评审的 spike / 文档 / demo。
- 先发高确定性工作。优先发布 base / shadcn 原型补齐、指南文档、白皮书插图和轻量社区内容；对适配器类工作优先发布调研与最小验证任务。
- 发布脚本默认 dry-run。只有显式传入 `--publish` 时才调用 GitHub CLI 创建 label 和 issue。
- issue 文案在仓库内保存。首批 issue 放在 `internal/issues/v0-good-first-issues.json`，这样可以通过 PR 审阅、修改、复用。

## 建议标签

- `good first issue`
- `help wanted`
- `v0 launch`
- `prototype`
- `adapter`
- `docs`
- `whitepaper`
- `community`
- `automation`
- `spike`

## 分批策略

第一批：高确定性、贡献者可直接上手。

- base 原型：radio、checkbox、slider、tooltip。
- shadcn 原型：radio group、checkbox、slider、tooltip。
- 文档：第一次编写原型、第一次编写适配器、贡献路径、白皮书信息通路模型插图。

第二批：需要 maintainer 先收窄边界。

- 小程序、Vue 2、React 15 等适配器的最小能力验证。
- 基于 base 原型实现其他设计语言原型库的 scaffold / spike。

第三批：社区运营与宣传。

- Proto UI 理念讲解视频脚本。
- 教学导向视频脚本。
- 官方社群维护指南。

## 操作方式

预览首批 issue：

```sh
pnpm issues:good-first:dry-run
```

按分类预览：

```sh
node scripts/issues/publish-good-first-issues.mjs --category docs
```

正式发布：

```sh
pnpm issues:good-first:publish -- --repo guangliang2019/Prototype-UI
```

默认会跳过同标题的既有 issue。需要允许重复发布时传入 `--allow-duplicates`。
