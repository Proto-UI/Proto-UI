# 2026-08-24 Vue 2 PR #462 审查修复范围

> Internal record. Not normative. 本记录说明本次 PR 修复的边界；稳定语义仍以 `spec/**` 与适用 contract 为准。

> 2026-08-26 注：本文保存上一轮审查范围；后续 maintainer admission 与公开化范围见 `2026-08-26-vue2-official-adapter-admission.zh-CN.md`。

本次修复处理 Vue 2 adapter 的 capability wiring、`ScopedExposesReader` 的 per-instance 生命周期和 terminal disposal、focus projection，以及 private feasibility package 与公开 Adapter 集合的边界。Vue 2 不属于官网的正式 `AdapterIds` 或共享 Web conformance matrix；内部 Demo Matrix 可以显式使用其 internal runtime 进行人工验证。

PR #462 review 中关于异步 runtime 切换的 stale-mount 问题也在本次一并修复。该问题影响 React、Vue 与 Vue 2 的共同 Previewer mount 边界：远程 runtime 加载期间发生 switch 或 unmount 时，旧 completion 不得创建 root/app、append DOM 或夺回 host。本次在共享 host mount 边界实现 generation guard，并用 deferred-loader 回归测试覆盖；`esm.sh` 的远程懒加载策略保持不变。
