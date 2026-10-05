# Header ghost presentation (2026-10-04)

The user identified an inconsistent control language: the shared Header Search looked unframed while its Selects looked like boxed form fields. The accepted consumer rule is quiet Header commands with clear hover/focus, while labelled compact preferences and ordinary form fields retain their field surfaces.

The existing public API had no unframed Select appearance in either family, nor a Brutalist Button ghost variant. The user-directed scope explicitly admitted minimum additive visual inputs on these existing Base-derived prototypes, not a website-only prototype or private CSS paint override:

- Shadcn Select Trigger: `appearance: default | ghost`, default `default`.
- Brutalist Select Trigger: `appearance: flat | elevated | ghost`, default `flat`.
- Brutalist Button: existing `variant` adds `ghost`, default remains `solid`.

All three continue to call their original Base as-hook once. Existing default, flat/elevated and solid/surface/destructive behavior and appearance remain. Ghost changes presentation only: transparent resting border/fill, no resting hard shadow, readable family foreground, family-neutral interaction feedback and retained focus/disabled semantics. Active appearance changes withdraw previous paint and movement. These are explicitly Proto UI additions, not claims of pinned-upstream parity. No new package export, dependency, release, lifecycle admission or theme palette was added.

The Header consumes these props. Desktop Selects are ghost; compact labelled preferences restore their family default through public props without replacing the Select owner. Header command Buttons use ghost. The existing explicit elevated module fixture remains available to prove compatibility. The hosted Header suite now exercises ghost/default, real hover/press/focus, popup, runtime and compact reparenting; its immutable historical flat negative stays source-bound.

Before publication, three new public ghost tests failed against the unchanged implementation, then passed after the visual rules landed. The public primitive/theme suite passed29 tests; the consumer suite passed93, including two families across all four installed Adapter runtimes. The evidence callback contracts passed18 and the prototype catalog passed. Full exact-head types/general and hosted visual acceptance remain pending. This is not a completed visual or release claim.

The preceding9578 source passed the full mobile matrix, native links, source selection, Copy and grammar. Its separate density probe still selected a hidden duplicate TOC link; that probe now limits owner reads to visible navigation. The actual visible current was correct in its screenshot. Search retained a real1329ms readiness failure under the unchanged1000ms deadline. A separate post-failure CPU-profile navigation is added only as diagnostic evidence; it never runs during or replaces the original acceptance observation.

## Exact6825 review and repair

The first actual1440px Chinese dark Shadcn document frame was inspected and shows the intended unframed Header. The mobile matrix again passed all10 normal/pressure cases, and native links, source selection, Copy, grammar and runtime-box passed. The Header matrix passed all8 Brutalist runtime/theme cases; the8 Shadcn cases hit an incorrectly inherited Brutalist-only `Content box-shadow:none` assertion. The correction now requires each family's real unchanged Content recipe, including Shadcn shadow-md. This is not a product request to remove popup elevation.

Manual inspection of the Brutalist documentation frame found a real missed consumer path: the older Web Component initializer still translated `ghost` into `surface`, leaving Theme/menu boxed. Ghost is now a valid family input and passes through unchanged; the mapper still translates only unsupported outline/secondary aliases. A dedicated actual-WC regression proves transparent border/fill and no hard shadow with the44px Header target.

The short new Brutalist Button page fits within the viewport, so native hash navigation cannot scroll its lower heading to the current reading line. The probe now requires actual bottom clamping and a fully visible target before accepting a different current link; otherwise the exact visible target must become current. Unique strong current styling remains asserted after moving the pointer away. The first-pair capture now includes both families so this path cannot hide behind a Shadcn-only first frame.

Search's original1000ms observations all passed in this run; four later failures were stale expected surface fill on the newly ghost Brutalist command. Its visual assertion is updated, not the timing threshold. Post-failure profiling is now restricted to recorded readiness failures rather than any later assertion in the initial stage.

Full local general verification after the first stale expectations were reconciled passed3722 tests/594 suites, with3 skipped and34 todo, under serial file execution. The earlier parallel run's Base Dialog teardown errors are retained; controlled47-test and full serial runs had no such errors. After the final WC mapper repair,57 focused tests and18 evidence contracts passed, and395 workspace/docs files type-checked with0 errors/0 warnings and3 existing hints. Exact new-head hosted verification and final rendered review remain pending.
