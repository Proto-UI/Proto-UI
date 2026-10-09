# Vue 2 pending visibility completion repair

## Scope and authority

Human-directed investigation of the existing Vue 2.6 host translation, based on `48b6f1bf6def5ffe1d1a7c34be91d670b1e7a077` (tree `ac6a778aff629165d48af8669641e996f2ccb50c`). The governing Adapter profile is `A-VUE-2-0001`; its existing lifecycle, presence and host-readiness boundaries remain unchanged. This repair does not amend portable lifecycle semantics or claim new native material fidelity.

The independent Liquid elevation experiment and Select diagnostics are not part of this repair. Their pending source/proof packet remains separate.

## Observed failure and diagnosis

Official run `37937416562`, job `113842849329`, artifact `11620445449` executed that exact clean base. Accordion had 24 passed titles and one failed title: Liquid / Vue 2 nested reopening. The nested trigger remained invisible until the existing 30-second click deadline. The post-failure diagnostic found the nested root, item, heading and trigger with `data-pui-view-pending`, although Adapter `viewReady` was true, pending commit and signal were clear, and the current physical root and owner were valid. The outer content was visible. This post-failure observation is not within-deadline readiness evidence.

`finishPendingCommit` changed non-reactive readiness without completing its owned DOM pending attribute. Ordinary style flushes and the older conformance driver's unconditional parent force-update can cause later VNode updates that conceal the gap. A real `createWebMaterialSink` fallback reproduces the nested pending attribute in the new local test without an unrelated parent render. A controlled frame-owning sink also reproduces the missing completion.

## Repair

Both commit queues retain their commit version. Completion checks that version, current and bound root, gate identity, presence, active lifetime and view owner. After the runtime acknowledgement, it rechecks those identities before removing only the Adapter-owned pending attribute and notifying readiness. The same explicit attribute completion pattern already exists in the Vue Adapter.

No new force-update loop, timeout increase, forced click, visibility-rule removal, material-default change or protocol expansion is used. A synchronous reentrant commit or lifetime change owns its own completion. A thrown acknowledgement keeps its original thrown value and does not reveal the root.

## Evidence and remaining boundary

The same ten real-Vue tests produce four failures and six passes against the unchanged base, and ten passes against the candidate. They cover ordinary style, owned-frame and actual Web Material fallback paths; repeated nested reopening; a delayed old acknowledgement across hide/reopen and a new physical root; acknowledgement reentry through hide, disposal and update; and thrown Error, undefined and zero. Tests do not claim optical GPU rendering.

The Vue 2 suite passed all 54 files / 271 tests. Independent review additionally exercises completion guards directly. Focused TypeScript passed. The real public-package build passed the 37-package dependency closure required by `@proto.ui/adapter-vue2` (37 of the repository’s 45 public packages, not an all-package build). Exact final results are recorded in the evidence receipt. An initial reduced-source export omitted previewer modules; an initial package build resolved old shared workspace declarations. Those setup failures are retained separately from the final checks, and no Material source was changed to suppress them.

A normal launch of the existing Chromium binary through installed Playwright, with the Chromium sandbox enabled, failed before any page was opened: `process_singleton_posix.cc:297 socket() failed: Operation not permitted`. No launch workaround or additional installation was attempted. Native baseline and candidate execution therefore remain unrun locally. The existing official Accordion browser workflow must rerun at the integrated exact source before the native failure can be considered repaired. Local tests and this record are not native acceptance or visual acceptance.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
