# Sprint 6: DPR source recovery after the fifth native result

This record accompanies the three source files listed in
`evidence/2026-11-22-sprint-6/dpr-source-recovery.json`.
It records an implementation and evidence recovery; it does not close the seven
Sprint 6 Issues or declare PR #1712 ready.

## Observed failure and responsibility

The fifth candidate was
`3801353bb6086d11b257dace4f0dc347fea98488`.
Its [frame acceptance run](https://github.com/Proto-UI/Proto-UI/actions/runs/45025405460)
failed the existing dark material release case after the original 20-second DPR
wait. All four hosts correctly rejected an out-of-date source:
the canvas remained 466 × 172 physical pixels while its CSS geometry was
466 × 172 and the readable DPR was 2. The material quality was
`opaque-fallback`, with reason `source-resize-or-dpr-stale`.
The complete run remains failed; earlier successful measurement steps do not
override that result.

The source producer previously handled resolution changes synchronously.
A controlled unit counterexample delivers the notification before the new DPR
becomes readable, then changes the DPR before the next animation frame. Both
resolution and resize cases fail against the unchanged fifth-candidate producer.
This establishes a reachable ordering defect. It does not establish the exact
browser callback order behind the archived native timeout.

The fix routes resolution, resize and ResizeObserver notifications through the
existing bounded layout frame. That frame rebinds the exact resolution query
using its current DPR before layout and source refresh. First paint remains
synchronous. The implementation removes retired media listeners, coalesces
notifications, preserves a pending viewport repair when dynamic animation is
paused, and retires both frame handles on disposal. It adds no idle polling.

## Acceptance oracle

The native material test now checks, within each original 20-second wait, the
current DPR, all four physical source dimensions, positive CSS geometry, the
visible-app-canvas source, and the consumer's committed source revision. Both
the DPR 2 transition and restoration require revision advancement from their
preceding observed snapshot. This prevents a previous `self-optical` dataset
from accepting a transition before the physical source is refreshed.

All ten original quality calls, eleven `page.waitForFunction` calls, timeouts,
and the CDP viewport sequence remain. Three existing waits have stronger joint
conditions. The test does not repair the scene or add redraw calls.

## Executed checks and recovery boundary

Before the execution environment disconnected, the old producer failed both
selected ordering cases with exit code 1. The corrected complete unit file
passed 27/27 tests, with no failures, pending tests or todos, and exit code 0.
The original 21 tests remain verbatim. The native oracle passed the actual
syntax/transpile and AST checks. Its scoped semantic TypeScript check was still
running when the environment became unavailable; no terminal result was
received, so it is not recorded as passed.

An independent reviewer examined all three files before the interruption.
The original local logs and prepared fifth-run archives became inaccessible.
They are not recreated from summaries or claimed to be committed here.

Recovery reads each complete source file from the immutable fifth commit,
applies the previously reviewed changes, and checks its complete SHA-256 against
the digest frozen before the interruption. All three digests match. The
accompanying manifest records these byte comparisons and their limits.
Publication uses the existing authorized GitHub connector with the expected
parent, no force update and actual server readback. It does not claim that the
unavailable local publication or collaboration CLI ran.

## Fifth-candidate results retained

| Existing run | Terminal result | Scope |
| --- | --- | --- |
| [Bootstrap](https://github.com/Proto-UI/Proto-UI/actions/runs/45025119696) | Success | 15 native part tests; 38 navbar cells; 96 motion cells; actual upstream-reference captures and formal preset check |
| [Liquid main](https://github.com/Proto-UI/Proto-UI/actions/runs/45025270205) | Success | 960 main assertions and 94 state assertions; explicit bounded `browser_only=true` selection |
| [Liquid frame](https://github.com/Proto-UI/Proto-UI/actions/runs/45025405460) | Failure | Measurement, progress and GPU checks passed; one of five selected release cases failed at DPR 2 |

The frame run's candidate static/dynamic listener p95 was
12.510/36.690 ms; event p95 was 12.810/41.075 ms.
The matched baseline listener p95 was 12.200/16.475 ms.
The candidate dynamic result regressed. These software-rendered measurements
do not meet the original 10 ms target and are not physical 120 Hz or
input-to-photon evidence.

The four original [#1467](https://github.com/Proto-UI/Proto-UI/issues/1467)
navbar acceptance boxes were updated with the actual fifth-candidate evidence,
independent review and exact body readback. The Issue remains open and the PR
remains a draft. Its bounded navbar acceptance does not close the complete
Bootstrap family.

## Required continuation

The recovered producer is also used by the mixed Bootstrap/Liquid projection
page and the optical/hover evidence lanes. Run all three existing workflows
against the actual newly published candidate: full Bootstrap, full Liquid
(`browser_only=false`), and the frame acceptance with matched baseline
`49fc3ac3a5df6f6850795f25503940c5a2d0f2e8`. The fifth results remain historical
results and cannot substitute for those executions.

Retain original failures, recover or independently re-download the raw artifacts
with a working execution environment, resolve the semantic type-check result,
complete ordinary canonical independent review and criterion-bound tracking,
then re-read the actual PR state before any ready transition. No review, CI,
rights, DCO, platform permission or evidence requirement is waived.

The real application consumers include Harness app `shenko` and
`OpenGreendam/verdant`. This Sprint 6 candidate has not migrated their pins or
executed those Apps. Their separate prior work remains attributable to its
original source and evidence.
