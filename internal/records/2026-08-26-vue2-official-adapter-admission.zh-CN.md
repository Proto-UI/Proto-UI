# 2026-08-26 Vue 2 official Adapter admission

> Internal record. Not normative. 本记录保存 PR #462 的 maintainer admission、实现范围与剩余外部门禁。稳定语义以 `spec/adapters/A-VUE-2-0001.yaml` 及其关联实体为准。

## 决定来源

Maintainer 在 PR #462 的 [review follow-up](https://github.com/Proto-UI/Proto-UI/pull/462#issuecomment-5405068032) 中明确接受 Vue 2 作为 public / official Adapter profile，并要求同一变更补齐 `A-*` entity、公开 package 与 registry、conformance evidence、fresh review 和 DCO。

该决定取代 2026-08-22 至 2026-08-24 期间把 Vue 2 限制在 private feasibility / internal Demo Matrix 的临时方向。旧记录继续保存当时事实，不再描述当前治理方向。

## 仓库内 admission

- `A-VUE-2-0001` 定义 `@proto.ui/adapter-vue2` 在 Web platform 上面向 Vue `>=2.6.0 <2.7` 的 official profile。
- package manifest 进入公开发布扫描边界，版本与 release train 对齐为 `0.3.0-alpha.0`，并声明 public npm access。
- `vue2` 进入公开 `AdapterIds`、Previewer 默认 runtime 集合和共享 Web conformance matrix。
- Props、Event、lifecycle、State、Expose、Expose State 与 Expose Event 的 profile criteria 连接到现有或新增 executable evidence。
- Dialog、Select controlled value 与 Brutalist Scroll Area Move 使用与 Web Components、React、Vue 相同的 DOM journey；关闭的 overlay children 保持 mounted，并通过 `data-pui-view-detached` 从 paint、accessibility 与 tab order 排除。

## 不在 branch 内伪造的门禁

仓库 manifest 的公开状态不等于 npm 已存在该 package。当前 `@proto.ui/adapter-vue2` registry identity 尚未建立；首次发布仍需要有权限的 maintainer 完成 npm identity bootstrap / Trusted Publisher 配置，并由 release workflow 产生 publication evidence。

PR 仍必须满足 DCO。历史 commits 的签署只能由对应作者通过允许的 sign-off 流程修复；maintainer 不得代签、代理确认或绕过 DCO。fresh independent review 与所有 branch protection checks 也必须在 merge 前重新通过。
