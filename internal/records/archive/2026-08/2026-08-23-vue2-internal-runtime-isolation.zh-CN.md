# 2026-08-23 Vue 2 Runtime 暂时隔离到内部验证页

> Internal record. Not normative. 本记录保存当前网站验证范围；稳定 adapter 保证仍以 `spec/**` 为准。

> 2026-08-26 注：本文保存隔离阶段的历史状态；后续 official Adapter admission 见 `2026-08-26-vue2-official-adapter-admission.zh-CN.md`。

`@proto.ui/adapter-vue2` 继续处于 private feasibility 阶段，尚不作为公开网站所承诺的 Adapter。因此公开 `AdapterIds` 只包含 `wc`、`react` 与 `vue`：全局 Adapter Select、首页 Previewer 与公开文档不会显示 Vue 2，也不会让它成为共享 web-conformance matrix 的完整性成员。

Vue 2 runtime 保持可加载，但仅由 internal Demo Matrix 通过显式 internal runtime 集合使用，以供本地人工验证所有 demo。它获得的验证不得被表述为已完成正式 adapter 的发布或 conformance 承诺。

待 Vue 2 达到正式支持标准时，再在独立变更中同步扩大公开 AdapterIds、共享 web-conformance journey、发布状态、spec 与文档。
