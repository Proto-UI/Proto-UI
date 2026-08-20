# Agent 项目理解改为本地可再生投影

## 背景

`internal/agent/PROJECT-UNDERSTANDING.zh-CN.md` 完全由当前检出的 `spec/**` 与 `scripts/spec/generate-agent-project-understanding.mjs` 生成。过去该文件被 Git 跟踪，因此任意两个同时增加或调整 spec 实体的逻辑独立 PR 都会改写同一份全量快照，并在后合并的 PR 中产生与业务逻辑无关的冲突。

2026-07-31，Tooltip PR #352 与新增 Scroll Area / Move Gesture 领域的 `main` 发生合并时，四个共享代码入口可以自动合并，唯一实际文本冲突正是该生成快照。这说明冲突来自产物治理，而不是两个领域的语义矛盾。

## 当前处理

- `spec/**` 与生成器继续是投影的唯一输入。
- `internal/agent/PROJECT-UNDERSTANDING.zh-CN.md` 从版本控制中移除并加入 `.gitignore`，与 `apps/workspace/public/spec-workspace.json` 一样按需在本地生成。
- `corepack pnpm@10.32.1 spec:docs:agent` 仍会写出完整本地快照，供 Agent 或维护者阅读。
- `corepack pnpm@10.32.1 check:agent-doc` 始终加载、验证并渲染当前 spec；若本地投影存在，还会比较内容并拒绝陈旧文件。干净检出中不存在该一次性产物属于正常状态。
- `AGENTS.md`、`spec/README.md` 与双语 release workflow 明确本地生成、审阅但不提交该投影。

## 边界

这项调整只改变可再生工作区投影的版本控制策略，不降低 spec schema、关系、生成器或 release snapshot 的验证强度。`artifacts/spec-releases/**` 中用于发行证据的不可变 snapshot 仍按 release governance 管理，不属于本次调整范围。
