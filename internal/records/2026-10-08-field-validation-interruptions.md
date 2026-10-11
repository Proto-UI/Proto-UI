# Field validation interruptions: composition termination and later defaults

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Reproduction and governing scope

Two independent [PR #872](https://github.com/Proto-UI/Proto-UI/pull/872) review hypotheses were reproduced on unchanged `63a8d4240d8dfc2a36f8cbab367e8a9c43f41fd7`, tree `2feebcf1159b9bf4c8dfc4edf64ef7ce587cc93b`:

- [Composition termination](https://github.com/Proto-UI/Proto-UI/pull/872#discussion_r4221070823): after Root or Control becomes readOnly during composition, TextControl reports its ended state but the Field binding retains composing=true. Explicit validation remains blocked. The same retained-fact defect exists while disabled, although disabled must continue to reject validation.
- [Initialization-only defaults](https://github.com/Proto-UI/Proto-UI/pull/872#discussion_r4218425993): an otherwise unchanged defaultInvalid/defaultErrors update clears the current pending lease, so its completion is rejected without replacement work.

Draft `C-FIELD-0001-VALIDATION`, `-OWNERSHIP` and `-ASYNC` govern the expected behavior. This change repairs their implementation without promoting that contract or changing its criteria. The existing homepage same-value request repair in `29be10fc` is a different owner and is not copied or overwritten here.

## Bounded repair

The binding still rejects input/change/compositionend edits under effective readOnly or disabled. After whole-report normalization and the existing reentrant-report identity check, a compositionend explicitly reporting composing=false may retire only a retained composing=true fact. Canonical value, initial baseline and focus stay unchanged, the rejected edit still returns false, and notification uses sync rather than automatic onChange validation. A malformed payload or composing=true report does not clear composition. A duplicate end does not cancel a later explicit readOnly request.

Independent review caught a regression in the first repair: a public compositionEnd callback could synchronously start a newer composition, after which the older default Control handler still reported a hardcoded false. Its narrow readOnly probe passes on the original baseline and fails on that first candidate. The handler now reads current composing state after the callback, preserving newer events. Added readOnly/disabled/editable reentry cases also guard against an obsolete end driving onChange; the final candidate retains the original red evidence.

Root's prop watcher excludes only defaultInvalid/defaultErrors from lease invalidation. A real policy or controlled-validity change in the same update still invalidates old work; initialization and completed validity ownership remain unchanged.

## Evidence and limits

`field-validation-interruptions.test.ts` adds twenty synthetic Web Component/generic bridge cases. On the unchanged formal baseline, twelve intended assertions fail and eight real-policy negative controls pass. On the candidate, all twenty pass. Assertions cover Root/Control readOnly, disabled blocking, canceled composition, stale/duplicate results, blocked value/baseline/focus admission, malformed reports, fresh editable input, pending/completed defaults and mixed policy updates.

The focused eleven-file run passes 320 tests: existing Base Field boundaries, both TextControl suites and all four Web Adapter Field suites, plus the new cases. The existing four-Adapter cases execute all five families; the new interruption cases directly exercise Web Component and the host-neutral generic bridge. A bounded TypeScript check of the changed files and their import closure passes with a 768 MiB heap cap. Prototype catalog and base-aware spec authoring checks pass. The pnpm spec-authoring wrapper initially hit the environment’s tsx IPC socket restriction; the same repository script passed through node --import tsx without invoking the unavailable IPC wrapper.

This is synthetic source/runtime evidence. No native IME, browser, screenshot, AT, GPUI, whole-workspace aggregate check or remote CI result is claimed. Exact integrated-head checks and native acceptance remain outstanding. The repair is prepared locally only; publication belongs to the parent integration task.
