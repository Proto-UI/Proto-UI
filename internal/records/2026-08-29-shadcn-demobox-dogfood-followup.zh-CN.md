# Shadcn site controls 与 Runtime demobox dogfood 跟进

日期：2026-08-29

本文记录 PR #567 与 Issue #568 的一次实现和 dogfood 验证跟进，不改变 `spec/**` 的规范语义，也不替代可执行测试。

## 观察到的事实

- 首页 Runtime demobox 在本地触发切换后会经过一次 document-level teardown/remount；当前实现把发起切换的 trigger 作为 focus target 传入该路径，并在 remount 解锁 Select 后恢复焦点。
- Previewer 对过期异步完成、无变化请求和强制更新分别做了保护；较新的请求不会被旧请求的 finally 分支清空。
- Demo Matrix 的浏览器覆盖在 1440px、390px 和 320px 验证 runtime 行数、mount 数、列几何、无水平溢出，以及每个交互控件的稳定非空 role/name；首页覆盖验证 Dialog focus/restore journey。

## 当前证据

- Matrix 与首页 browser suites：5/5。
- 相关 Vitest focused suites：17/17。
- `apps-www check`：178 files，0 errors/warnings/hints。
- `check:agent-doc`：通过。
- `check:agent-operations`：56/56。
- Demo Matrix policy tests：3/3。

## 后续

- PR #567 仍需独立维护者审查；作者不能自我 approval 或 merge。
- Issue #568 继续作为站点控件、Runtime demobox 和 dogfood matrix 的聚合跟踪；新增发现应绑定到具体 head、可观察行为和对应测试。
