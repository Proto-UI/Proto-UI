# Sprint 3 Tooltip description presence follow-up — 2026-11-23

## Defect and repair boundary

The original complete native run at `794b9c6b75d85373c9a2f1a7d12af9098ed504a5` retains its result: 363/364, with the React Tooltip cold-budget counterexample failing the Content IDREF guard. The separate original Drawer suite passed 7/7. A later two-file, failure-only diagnostic ran the original 20 Tooltip cases and passed 20/20 without producing a failure snapshot. That non-reproduction did not close the original failure.

A deterministic real React / Happy DOM reproduction now establishes a concrete ownership defect. After the public `openTooltip()` request inside `act`, Root is open and Trigger already publishes `pui-tooltip-1-content`, while that ID has zero document targets. After React flushes the same batch, the target exists once and has the `tooltip` role. Logical Anatomy membership survives view detachment and does not prove that the React portal's current physical accessibility target has committed.

The repair belongs to Base Tooltip's expression of its owned Content relation. A general string relationship may deliberately reference an external authored ID; the generic Web projector must not guess a component-specific wait policy. Content now declares the existing same-domain accessibility part with the fixed protocol key `content`. Trigger selects that part only while its existing open-and-content condition holds, using an additive structured `describedBy` relationship. The existing A11y service owns target availability, unique matching, view epochs and withdrawal.

The protocol key is independent of the host ID. Content's explicit stable ID and role remain unchanged. Root control, Group timing and cancellation, disabled and focus behavior, existing host description tokens, and public exposes are retained. No Adapter, Compiler or page-specific component branch is introduced. `C-A11Y-0001`, `C-A11Y-PART-RELATIONSHIP-0001` and the Tooltip catalog entries retain their existing draft lifecycle; this change does not promote a stable guarantee.

## Executed evidence before publication

All execution used the owned remote checkout, Node 24.22.3 and pnpm 10.32.1, with the previous same-tree frozen installation and unchanged lock `e374ba03f76079fd191d63c2da1f62861b7e90bbeba64a0b310027fc2c15b7f8`. Each source-staged mechanism phase retained its exact input bytes and restored the original checkout afterward.

| Run | Result | Scope |
| --- | --- | --- |
| Original-source React mechanism | 1 intended fail, 1 pass | The first case failed on an actual dangling IDREF, in 159.356 ms; not setup or timeout. Outer process 7.352 s. |
| Same test plus two-source repair | 2/2 pass | Identical test bytes and names; outer process 3.840 s. |
| Existing Tooltip compatibility plus the new regression | 37/37 pass, six complete files | React 2, Base Tooltip 8, Group lifecycle 16, Button composition 2, Brutalist 4, Shadcn 5; 20.274 s. |
| Focused TypeScript 5.9.3 program | 680 source files, 0 diagnostics | Three changed code roots and their import closure; 6.855 s. Original `skipLibCheck: true` is inherited. This is not full workspace/docs checking. |

The new test bytes are `a5e5b90baaf1085997e08ec8b3d696d3fad3192b67426adadc9c2fe7d45f0601`. Green snapshots withhold the owned token before the physical commit, then restore the one connected Content after commit. Close, L1 detach and reopen preserve the same stable ID. The other case preserves controlled request authority, optional Content teardown, sibling Root isolation and the host baseline description.

Existing compatibility tests retain their original fake timers. The new two React cases and the driver do not mock a clock or scheduler. A copied `clockOrSchedulerMock: false` field in the compatibility producer was too broad; an append-only clarification binds the unchanged original receipt and driver. Its SHA is `8a4f9d4a953b7b9a3e522a055f5b447017935eb537a516d90897638f6598429f`. The existing Vite/esbuild ES2024 transform warning remains in the raw logs. Passing tests are not a zero-warning claim.

The new implementation mapping consumes only the existing `T-BASE-TOOLTIP-0001-CASE-A11Y`. It does not claim the separate Escape or complete Overlay/positioning criteria. The original native 20-case file, handoff probe, driver, authored 500/300 ms timing and negative-control assertions are unchanged.

## New native mechanism observations of the original production build

A separate, predeclared six-observation diagnostic consumed the unchanged sealed 794b production build: three ordinary React/light cold-to-warm journeys alternating with three original cold-budget counterexamples, each in a fresh BrowserContext. The original negative-control callback was extracted exactly. An independent read-only MutationObserver/RAF observer recorded actual node identity and IDREF targets; observer delivery counters are not product view epochs. The first driver result was sealed before a fixed 750 ms diagnostic tail, and later observations could not rewrite it.

All six observations completed in their declared order; there was no retry until green. Every trace observed a zero-target IDREF at a MutationObserver delivery. The first ordinary journey also observed incoming pair 1, `pui-tooltip-4-content`, with zero targets at an independent RAF sample 14.6 ms after native warm pointer entry. At that observation the outgoing pair had withdrawn its owned IDREF and its old Content was still connected/closed. The original unmodified driver then retained the same IDREF-guard failure. The other two ordinary driver journeys completed; all three injected negative journeys retained their expected cold-delay rejection.

This new native observation supports the incoming physical-binding mechanism. The independent observer can affect scheduling, its callback is not the driver's callback, and intervals between snapshots do not prove continuous absence duration. It does not retrospectively identify the pair or instant in the earlier complete run's missing failure snapshot.

The diagnostic naturally completed at 2026-11-23 00:10:59.735 UTC. All six traces were untruncated, the browser and preview closed, no observed owned process group remained, and all 4081 production files and bound source inputs were unchanged. Supervisor receipt SHA: `cf77ae6b5bca2ef44716fd6fb071f03615b2ce67e4018ac2aa3a4654f76eb498`.

## Receipts and remaining acceptance

Remote evidence root: `/tank/shared/projects/proto-ui-agent/seven-sprints-20261123-chvf1ono/evidence/s3-ci-followup-2118`.

- `tooltip-part-red-first`, `tooltip-part-green-first`, `tooltip-part-compatibility-first`, and `tooltip-part-focused-types-first` retain raw results, commands, exact input hashes and restoration receipts.
- `tooltip-identity-mechanism-first` retains all six original-production observations; the immutable packet is `tooltip-identity-mechanism-packet-first`, manifest `ace80433092ab023e70be95ba59f62d14c17d9fb9919ea6f8b5de5b59dbe196c`.
- The independent red/green audit is retained in the task evidence as `tooltip-part-red-green-audit/audit.json`, SHA `f0c2f670dde98a8bb227cf29561318ad1832a7284c7bbb91a501c3a4ad9e9552`. It preserves the original red result, complete raw-byte checks and the actual times of independent worktree/cleanup readback.

These staged source checks and old-production diagnostics do not establish candidate production acceptance. The repair must next be compiled into a new, commit-bound production build and run through the original complete native consumer inventory, the applicable original regression checks and full CI. The original red results remain preserved. Native OS assistive technology and a non-DOM host were not exercised here. Source/evidence reviews are not formal GitHub approval; the PR remains a Draft until its actual gates are satisfied.
