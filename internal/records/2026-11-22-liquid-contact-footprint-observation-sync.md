# Liquid contact footprint observation synchronization

This correction binds two existing browser observation helpers and three finite negative fixtures to the complete pointer-contact footprint already implemented by upstream main. It changes no material implementation, source-admission guard, fixture geometry, optical threshold, capture inventory, timeout, budget or lifecycle status. It preserves the failed native candidate and requires a subsequent exact-source native run.

## Native failure and source authority

Native run [44956263999, attempt 1](https://github.com/Proto-UI/Proto-UI/actions/runs/44956263999) executed `f0b502704b825b5b644639522555d13e3d64231e`, tree `68bb8b5eb129c819f1f652d6537f33c7614c207e`. All four Hover jobs completed their runner and reported four failed cases each; none of these jobs exhausted its outer deadline. Their setup completed, but their declared capture inventory did not complete.

| Runtime | Native job | Artifact | Completed captures | Failed captures | Not run |
| --- | --- | --- | --: | --: | --: |
| WC | [137005421681](https://github.com/Proto-UI/Proto-UI/actions/runs/44956263999/job/137005421681) | 14728375013 | 56 | 6 | 664 |
| React | [137005421557](https://github.com/Proto-UI/Proto-UI/actions/runs/44956263999/job/137005421557) | 14726894700 | 56 | 6 | 664 |
| Vue | [137005421563](https://github.com/Proto-UI/Proto-UI/actions/runs/44956263999/job/137005421563) | 14728116288 | 56 | 6 | 664 |
| Vue 2 | [137005421545](https://github.com/Proto-UI/Proto-UI/actions/runs/44956263999/job/137005421545) | 14728315968 | 56 | 6 | 664 |

The total remains 16 failed cases and 2,904 declared captures: 224 completed, 24 failed and 2,656 not run. A completed capture only means that the capture returned; it does not imply that its subsequent assertions passed. Each archive's API size and digest, ZIP integrity and safe paths were verified. The four source/plan/progress/result identities match the candidate, and all 624 PNG references present in the captured records match their actual bytes. Terminal case accounting and partial capture accounting are kept separate.

The light Button idle record already had `self-optical/rendered`, `contact=rest`, `phase=rest`, an owned decoded PNG and a 130.546875 by 38 CSS-pixel host. Its actual carrier was positioned at -13/-13 with dimensions approximately 154.547 by 62: the declared 12-pixel contact footprint plus the original border offset. The old observer instead expected -1/-1 and 130.546875 by 38, producing `geometryMatches=false` and `committed=false`. The positive case consequently failed its original committed-paint assertion before the later interaction sequence.

[Upstream commit a2a09d8173799388d8ccd687daec4c8429a9ff41](https://github.com/Proto-UI/Proto-UI/commit/a2a09d8173799388d8ccd687daec4c8429a9ff41), integrated through main `604231ff21b9efbe01a23609d13f4e37f2729b4b`, explicitly keeps the conservative contact footprint across idle, held and released states so geometry changes do not retire valid neutral-image leases. The current sink computes `contactPaintOutset(width, height)` whenever the authored candidate requests pointer contact; the formula is `ceil(max(width, height) * 0.08 + 1)`. The two observation helpers were byte-identical between e775 and f0 and still assumed that rest meant zero expansion. This is an observation premise that was not synchronized during the main integration.

The draft `C-MATERIAL-PAINT-FOOTPRINT-0001-FACT` likewise describes a bound covering the profile's complete supported interval and explicitly distinguishes static profiles. The draft `C-LIQUID-GLASS-COMMAND-INTERACTION-0001` retains source safety, real Base input and honest fallback. These draft definitions explain the finite correction; this record does not claim that the draft host reservation protocol or optical/visual acceptance is implemented or promoted.

## Finite correction and retained refusal behavior

Both helpers now require the actual `contact-v1` ownership marker and one of the two existing authored pointer profiles: `liquidgl-v2-contact-canvas-1` or `pui-regular-style-tint-contact-5`. For these profiles, expected geometry uses the complete independently calculated bound at rest, hover, focus, held contact, release and keyboard press. Known contact values and known motion phases are still required. Unknown profiles, static profiles presented as contact carriers, unknown contact/phase values, collapsed idle carriers and incorrectly scaled carriers remain rejected. The direct-host static-image path remains separate and unchanged. Actual carrier dimensions never supply the expected dimensions.

The snapshot helper uses this same expected outset to register host-content pixels and prominent-tint crops. The host-content window still excludes the expanded transparent margin. Ownership, atomic receipt, decode, source, alpha, content-region and contrast requirements remain intact.

The three tight layouts have the following exact expected behavior in all five existing stages. Their layouts are unchanged; a full footprint does not become safe merely because contact returns to rest.

| Fixture | f0 native `negative-idle` fact, both themes and all four runtimes | Required reason at idle, hover, actual press, release-rest and leave |
| --- | --- | --- |
| `source-edge` | `opaque-fallback`, `source-bounds-unavailable` | `source-bounds-unavailable` |
| `neighbor` | `opaque-fallback`, `source-overlapping-content` | `source-overlapping-content` |
| `accordion-tight` | `opaque-fallback`, `source-overlapping-content` | `source-overlapping-content` |

The old branch waited for zero-outset optical paint at idle, hover, release-rest and leave; its first idle wait exhausted the existing 8-second capture budget. These four readiness expectations now require the original opaque fallback, alongside the already-required fallback during a real native press. A finite predicate requires the exact fixture/reason pair at every stage. Its controls reject wrong quality, wrong reason, unknown parts and similar spellings. The fallback assertion still requires an absent material URI/carrier, fully opaque foreground/background and the original 4.5 contrast threshold.

All five stage names remain: `negative-idle`, `negative-hover`, `negative-press`, `negative-release-rest` and `negative-leave`. Actual mouse down/up and `pressed=true/false` assertions remain. The independent source-edge distance, neighbor 1-pixel gap, Accordion 1-pixel gap and visible 8-pixel overlap paint remain. Source/overlap guards, visible-paint opacity and bounds, geometry equality and same-state RGB assertions are unchanged. Positive idle still requires actual self-optical paint.

## Assertion audit and actual local controls

An AST audit compared the formatted browser test with f0. All **174 original `expect` chains** remain verbatim and in their original order; five exact-reason checks were added. The positive bodies and shared optical/fallback assertions are byte-identical, as are the remaining negative bodies and cleanup. The audit explicitly distinguishes the finite readiness/precondition change above from unchanged assertion text.

The actual capture-plan module still declares 16 cases and 2,904 captures. The readiness default and capture helper remain 8,000 milliseconds; both browser case limits remain 240,000 milliseconds. The product sink, contact and tint profiles, capture-plan module, capture helper and workflow are byte-identical to f0. The existing workflow has no Hover-only dispatch input; any subsequent native execution must use a supported workflow scope.

The isolated worktree installed the locked dependency graph with `corepack pnpm@10.32.1 install --offline --frozen-lockfile --ignore-scripts`, exit 0, 557 packages reused and none downloaded. With the corrected observer controls but both observer implementations still at f0, the actual two-file command failed with **16 failed and 68 passed**, exit 1. The observed terminal result is retained; an unrecorded UTC start/end is not invented.

After the finite repair and formatting, the following actual command ran at 2026-11-21 22:35:32.646254–22:35:36.382385 UTC and exited 0:

```sh
node node_modules/vitest/vitest.mjs run \
  apps/www/src/content/docs/zh-cn/material-paint-observation.test.ts \
  apps/www/src/content/docs/zh-cn/liquid-toggle-snapshot.test.ts \
  apps/www/src/content/docs/zh-cn/liquid-hover-fixture.test.ts \
  apps/www/src/content/docs/zh-cn/liquid-hover-plan.test.ts \
  apps/www/src/content/docs/zh-cn/liquid-hover-capture.test.ts \
  apps/www/src/content/docs/zh-cn/liquid-hover-source-layout.test.ts \
  --maxWorkers=1 --minWorkers=1 --reporter=default --reporter=json \
  --outputFile=/workspace/scratch/fbd6f62bb640/hover-footprint-correction/focused-controls-vitest.json
```

The result was **297 passed, 0 failed, 0 skipped across six files**: observation 39, snapshot 45, fixture 108, plan 13, capture 73 and source-layout 19. These controls exercise the real serialized helper functions, finite reason predicate, registered stages and unchanged fixture geometry. They do not execute native browser input or prove optical acceptance.

## Retained evidence and acceptance boundary

The source/control receipt is `hover-footprint-correction/frozen-correction-receipt.json`, 15,857 bytes, SHA-256 `b355e812fb843ae36808d1a5f4895de570152366284b9196df3f98d8b351c683`. It contains all eight before/after source hashes, the original helper equality check, native artifact/log/audit identities and the source-preservation checks. Supporting evidence is retained with these hashes:

| Evidence | Bytes | SHA-256 |
| --- | --: | --- |
| `observer-baseline-red.log` | 14,842 | `8b831682c5ae05d14a7d75d814d02355a04b46c7849875ba525d5c01a54b3b09` |
| `focused-controls.log` | 9,795 | `57bbb9595037dbe45b297ce1460cfbc0c266134f93ff0b83685cf0feba0ff913` |
| `focused-controls-vitest.json` | 115,732 | `f7d4f39fd3fd03a04d4372a645cf29533dc7edbebb12873402c5cb269903bc7e` |
| `assertion-preservation.json` | 28,660 | `ce7aeffd361a8a4812cad5cf0a01cc6c0e325116311af4ec68775fbdfb54a51d` |
| `footprint-correction.patch` | 22,824 | `7f22e84d1fe126ddc63fe72a83544c2d42a565c3a1f40b736624a4fd705c3f3e` |

The four native archives and their complete source-bound capture evidence are retained under `native-ready-44956263999-material`; they remain failed f0 evidence. The correction was prepared in an independent worktree and did not mutate the original f0 worktree during the native cycle. It does not turn the f0 captures into passes or claim that later release, optical, source, revocation or cleanup stages ran. The independent Select Trigger overlap observation is outside these helpers and is not resolved by this change. No source binding, coverage hash, strict budget, product admission guard or lifecycle state is changed here. The integrated repaired candidate still requires its own exact-source native evidence and review.
