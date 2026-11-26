# Select native disabled input and environment evidence

Date: 2026-11-10
Status: source candidate authored; all product execution and independent acceptance pending with Main.

## Current authority and historical boundary

Issue [#1159](https://github.com/Proto-UI/Proto-UI/issues/1159) remains open. The historical [eight-case green run](https://github.com/Proto-UI/Proto-UI/actions/runs/42438516187) belongs to `811328179`, not this worktree's `0607c6c5c386b8a932ab850e92a8873b2121dc45`. It established first entry, keyboard selection, reopen, Escape focus restoration and 390px geometry; disabled coverage inspected only its ARIA attribute. No current-head product defect or native passing result is asserted by this test-only candidate.

The current public demo is Rhea. The [popup anchor-width repair](2026-11-07-select-popup-anchor-width.md) retired the Root/Item sizing policy and row-level lease. The [2026-11-03 sizing record](2026-11-03-select-website-item-sizing.md) remains unchanged as historical evidence. This candidate preserves the current popup-equals-Trigger rule, symmetric row inset of at most 4px per side, 0.5px geometry tolerance, horizontal-overflow/focus checks, all original keyboard actions, 1,200ms/96-frame pre-action motion bound and 120s per-case deadline. It does not restore `itemSizing`, change appearance, remove legal motion or modify the shared harness.

Expected behavior follows draft `P-BASE-SELECT-ITEM-DISABLED`, `-STATE-SEPARATION`, `-MOUSE-FOCUS-HANDOFF` and `-COMMIT`, with Content keyboard/dismiss ownership. `T-BASE-SELECT-ITEM-0001` maps this native implementation as **planned**. Running the interaction under reduced-motion preference does not define a new animation-suppression policy; Rhea's pinned Surface recipe already uses `animate-none`, while New York's separate 150/0ms contract and exact trajectory debt remain intact.

## Authored consumer coverage

The existing registered native carrier now authors three separately named environments: default LTR/no-preference, RTL/no-preference, and LTR/reduced-motion. Each retains both page languages and all four real runtime choices, for **24 intended cases, not 24 collected or executed cases**. Default case identities and output filenames retain the original eight names. The additional environments use distinct filenames. Every geometry snapshot records computed direction on Trigger, Content, Surface, Viewport and Items plus the browser's actual reduced-motion media result; requested setup alone is not accepted as proof.

After the original complete journey, each case opens the selected Web Components option again, uses Home/End to exercise enabled-only navigation past disabled Solid, then moves and clicks the disabled row's center with trusted mouse input. The carrier records unchanged committed selection/open state and absence of disabled focus at a later rendering observation. Two frames are not a React commit barrier. The following enabled Vue handoff must reach its changed DOM focus invariant while selection remains Web Components, and its native click must commit a different value and close. Selected Vue reentry and Escape focus restoration then complete the positive comparator. Real Tab/Shift+Tab restores keyboard modality before the final pre-action trace. These observable outcomes do not count hidden request signals or prove dynamic Root/Item disabled transitions.

The pointer point must hit inside the current controlled popup. Disabled `pointer-events:none` may legitimately hit its Group; the actual target is retained rather than forcing a disabled Locator click. An enabled sibling must receive the intended hit. This distinguishes the visible consumer's disabled input behavior from synthetic Item event delivery and prevents a click on an unrelated occluding page control from passing as the disabled test.

Each successful case authors eight ordered observation phases:

1. `first-entry`
2. `selected-reopen`
3. `narrow-reopen`
4. `disabled-keyboard-skip`
5. `disabled-pointer-move`
6. `disabled-pointer-click`
7. `enabled-pointer-move`
8. `pointer-selected-reopen`

Five complete motion traces and four pointer-input records accompany these facts. Evidence JSON retains all early/terminal motion samples, requested environment, actual hit positions and primary/secondary errors. New disabled and pointer-reopen screenshots accompany the retained first-entry/narrow captures. These are authored capture paths; no new image has been produced or uploaded by this implementation owner.

The Select-specific workflow receipt expands to the literal 24-case inventory and these actual phase/capture inventories. Its legacy `styled-demo-eight` job identifier stays intact because the existing scheduling-policy checker binds it. Callable/manual triggers, exact-head checkout, permissions, concurrency, 25-minute bound and retention policy remain intact. This local receipt update is not a native execution result and requires no central suite-registry or scheduling-policy test change.

## Main validation and continuation

Main owns all actual checks. Run the unchanged original eight at the exact baseline first, preserving complete logs/captures, then the candidate's complete 24 with source-bound JSON and readable screenshots. A failure identifies the next repair; no timeout or geometry threshold may be raised to obtain a pass. A candidate run from uncommitted source must retain actual per-file hashes and its dirty-source boundary rather than claim that `HEAD^{tree}` alone identifies those bytes. The child implementation phase has run no collection, types, formatter, tests, browser, server or build.

Main should run scoped format/type/spec-authoring and the existing CI scheduling-policy checks, then return actual native and independent-review findings to the Select owner. Publication, exact-head DCO/CI/platform approval, lawful merge and criterion-bound tracking remain Main-owned transitions. None has happened as a result of authoring this record.

Still independent and open: genuine first empty-selection pointer entry; first-visible/compositor capture; real animation cancellation/interruption; 200% text and long-content variants; live disabled policy changes; event-request counts; exact repeated-public-open consumer evidence; full family/style/consumer and www/CLI migration; scroll controls; collision/resolved-side/transform-origin parity; native AT and independently compiled output. Bootstrap/Liquid Glass mappings retain their 0.4 WIP placement. The historical `f119025`-specific dispatch condition is not satisfied by a later-head run. Original failures, prior source/deadline bindings and every unchecked Issue condition remain preserved; no Issue or release checkbox is earned by authoring these tests.
