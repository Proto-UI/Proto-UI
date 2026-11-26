# Sprint 5: concurrent callable and native integration

This normal merge joins `cde582a260a8a3d646fe4dbd38ac22bb1f71d273` and public PR #1738 head `2df421b1fc55cc0649be6675c0ee46a69ad9316f`. Both contribution histories, original controls and failure records remain. The exact source and raw evidence are indexed in [the manifest](evidence/2026-11-24-sprint5-concurrent-merge/manifest.json).

## Semantic conflict resolution

`packages/compiler/src/callable-effects.ts` is the only textual conflict. The resolved source SHA-256 is `f151a48fd13b23e2111c8072ad1ca6b2dbbc8bb7f271085c719685aec15c2b5c` (Git blob `610b32ae9cf90286c2ffef721b0c9b07eb424e7a`). It retains both independently developed behaviors:

- Actual JSON backing record/array provenance, hidden and opaque fields, alias stores, scalar extraction and cold-IR sink validation.
- Reached capture getter binding, actual facade presence, absent versus own-undefined keys, getter execution order and pre/post operation failure snapshots.

The shared copy path executes only present getters, retains preceding keys on absent branches, and propagates backing shape and effects. Optional typed host members preserve value, own undefined and absent alternatives in both analysis modes. Unknown authority remains refused. No public profile, IR version or draft specification lifecycle changed.

| Actual run | Result | Boundaries |
| --- | --- | --- |
| Merged source, nine original suites | 126 passed, 0 failed/skipped | JSON 35; capture/facade/lookup/presence 53; record-getter 38. |
| Exact first-parent analyzer substituted into the same seven-suite selection | 69 passed, 19 failed | JSON remained green; original capture/presence controls exposed missing incoming behavior. |
| Exact second-parent analyzer substituted into the same seven-suite selection | 71 passed, 17 failed | Capture controls remained green; original JSON and cold-IR controls exposed missing existing behavior. |
| Incoming presence controls with JSON tracking also enabled | 15 passed, 0 failed/skipped | The initial driver loaded only 12 controls and failed to load one suite; that harness failure is retained separately. |
| Strict TypeScript dependency closure | 479 source files, 0 diagnostics | This is a bounded analyzer/test check, not the whole workspace. |
| Independent unchanged source and cold-IR probes | 17 source + 4 cold-IR controls passed | A separate agent read both diffs, ten unchanged controls/contracts and the author raw results; source hash stayed identical. |
| Merged production-bundle checker controls | 2,150 passed, 0 failed/skipped | These controls do not substitute for a fresh production build. |

The single-module parent substitutions are counterfactual controls on the merged tree, not whole-parent test runs. The independent review is a technical review and is not GitHub `APPROVED`.

## Native and workflow merge checks

Automatic merging also needed two bounded corrections. The ordinary-values producer retains one `external_scroll` registration through the existing exact source-path `compileFile` / `retainModule` route; a second incoming registration was removed. `NativeScrollLease::is_current` retains both `!disposed` and `!disposing`: disposal marks `disposing` before Move cleanup can invoke author code, so a closing Scroll owner cannot be considered current during that callback.

The incoming retained physical-view/ControlLabel mechanisms and source controls remain. The GPUI profile contains exactly one `scroll.sync` declaration. The source workflow keeps both the prior explicit selections and the incoming capture/presence files and real-main-merge-base spec-authoring check. Existing deadlines, sandboxing and public admission stay unchanged.

## Remaining execution boundaries

The local whole-workspace type attempt on the preceding prepared tree `952fd4a2ea86cc58505b063711cb02907eef4443` was terminated by SIGKILL after 6.76 seconds (child maximum resident set reported as 826,816 KiB); it emitted no TypeScript diagnostics and is not counted as a pass or attributed to a proven cause. The earlier missing `/usr/bin/time` setup failure also does not count as a typecheck.

Hosted receipts belonging to public `2df421b1` and previous `0b7b212d` keep their original source bindings. This merge still requires execution of its affected consumer paths. Neither source review nor the preceding public browser success is relabeled as execution of this new merge. SSR/owner specifications remain draft and Sprint closure is not asserted by this record.
