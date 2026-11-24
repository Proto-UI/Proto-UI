# Sprint 1 native follow-up — 2026-11-24

This development checkpoint continues PR #1745 from `f419483e78403817fbe5aa6146caec30ab90352a`. It preserves the concurrent main integration, Calendar repair, Vue compiler repair, host-capability criterion identity repair and CLI helper work. The fourteen independently reviewed source files are bound by byte hash in the [manifest](evidence/2026-11-24-sprint1-verified-native-repairs/manifest.json). No issue, umbrella criterion, Draft status or acceptance gate is closed by this record.

## Search ownership and failure recovery

The composition now observes the current query owner's public `focused` fact. A late focus-entry notification schedules one coalesced microtask so the existing focus epoch has completed before the composition considers another paint. The paint request is admitted only for the same current owner, opening, action and eligible failure state. Actual focus still goes through the existing author commit/publication path and is recorded as complete only after the Retry action's public focused state confirms it.

Replacement, terminal disconnect, close, dispose and a newer focus intention invalidate the pending request. A synchronous subscription or unsubscription callback cannot make an older identity callback replace a newer InputShell binding. When the query disconnects during subscription, the composition clears and disposes its old InputShell pair before returning; it does not read the terminal control again. A new query that is already focused before the actual microtask-batched identity publication uses that publication's existing paint. No timer, animation-frame wait, DOM focus listener, public option or timing budget is added.

The final complete 54-case file passed. The exact prior `0b0b861` implementation with the 50-case file passed 41 and failed nine. The intermediate candidate with all 54 cases passed 53 and failed the Shadcn terminal-owner control. The final repair passes all 54 with source unchanged. Two ordering controls use the real `createDemoPublicInstances` publisher; the remaining deterministic public-fact controls retain their disclosed harness ordering. These are composition ownership proofs, not a claim that the remaining original native HEAD 503 failure has already been resolved.

The production evidence owner also rejects an output directory whose physical ancestor aliases the protected build or repository output. File, directory and ancestor-alias controls preserve ordinary safe output and the original owner/cleanup behavior.

## Geometry, compiler fixtures and source bindings

The neutral native fixture records the existing positioning repair on real DOM geometry, text ranges and hit tests. Flat and nested content run visible, cold, reopened and collision-disabled cases. The original host passed four of eight; the repaired host passes all eight under the same 1,000 ms oracle. The final formatted fixture is registered in the runtime plan and again passed eight of eight. The inspected cold and reopened captures keep all four labelled rows above the anchor in the 320 by 1000 viewport, without clipped text. This controlled host fixture does not substitute for website, Select, framework or complete family acceptance.

The Bootstrap draft projection check now uses the authored `3xl` font value of 1.875 rem. All four original runtime cases and their paint assertions remain. The fallback pagination title inherits the existing title font and uses the corresponding unitless line-height, removing the mismatched 11.9 px override. Original native font and seven-height comparisons remain to be rerun on the published candidate.

The GPUI fixture producer restores the actual `external_scroll` dependency and module while retaining the concurrent duplicate-module removal. The full generated Cargo graph has 38 unique modules, 37 dependencies and six test targets, with the original lockfile retained. The complete producer-to-Cargo metadata controls pass 20 of 20; the deletion-only baseline passes 19 and fails the missing `external_scroll` inventory assertion.

The concurrent Vue `context-key-binding` implementation is preserved. Additional source controls cover captured required and optional keys, lifecycle/remount use, the actual Shadcn Button compile path, and a missing-key negative. The union of the three complete related files passes 18 of 18.

The browser compiler registry retains the existing reviewed closure and explicitly binds the owned blueprint, template and SVG-tag helpers. Its 31 source files and 65 import edges remain finite and fingerprinted. The same 58 host-source and compiler-closure controls pass on the integrated source. The existing markup provenance fixture remains source-admission-unverified: its 31 actual digests match and its 36 controls pass, without promoting browser provenance to accepted evidence. The concurrent full spec catalog loads 1,319 files with zero reported issues.

## Executed evidence and limitations

The [raw archive](evidence/2026-11-24-sprint1-verified-native-repairs/raw-evidence.zip) retains original outputs, failed attempts, source bindings, native captures and command receipts. Overlapping selections are not added together.

| Selection | Actual result |
| --- | --- |
| Final Search composition file | 54/54 passed, zero skipped |
| Original seven Sprint 1 Node files | 232/232 passed within the original 90-second owner |
| Compiler host-source and closure selection | 58/58 passed; exact name pattern retained in the receipt |
| GPUI producer and Cargo graph file | 20/20 passed |
| Vue context/compiler union | 18/18 passed |
| Markup provenance controls | 36/36 passed; actual 31-source binding matched |
| Complete spec loader | 1,319 files, zero issues |
| Final neutral positioning browser fixture | 8/8 passed; original baseline 4/8 |

The additional unfiltered coverage-checker test-file acquisition reached its 120-second outer bound before reporting completed individual cases. It remains an incomplete result, separate from the successful 58-case selection and from the final whole-repository checker. A combined local website attempt reached the 1.5 GiB resource limit after server startup and completed no website cases. Its existing bounded owner reported no surviving processes. Neither failed acquisition is counted as acceptance.

Chrome's first startup attempt with the long task temporary path failed. Using a short task-owned temporary directory let the same installed Chrome, sandbox setting and neutral fixture execute. The evidence supports this controlled difference, not an unobserved operating-system root cause. All subsequent native fixture receipts retain that explicit environment.

A prior formatting change had altered a protected train-budget raw JSON payload. This checkpoint restores its exact original bytes: Git blob `97e8b120877c261d267fa5c0510785e79bc0c2ae`, SHA-256 `effc8565d3402699a5e487f4020e6ec265833b830822e49675fe6b094d97fdd9`. The original formatting protection and other seven protected payloads remain in place; no evidence is regenerated to make a historical result appear different.

## Current original native results and remaining work

The exact `0b0b861` [Sprint 1 run](https://github.com/Proto-UI/Proto-UI/actions/runs/45249497810) completed 10 of 12 producers successfully. Its focused and integration units, both Number Field owners, Dialog, ownership, Search props A/B and the full 84-case native Search file passed. Matrix still failed its original 60,000 ms initialization phase, and production Search passed three of four: the Shadcn HEAD 503 recovery still failed Retry focus at the original 1,000 ms assertion. These are observations of that old head, not of this checkpoint.

The exact `333f2b19` [Matrix diagnostic](https://github.com/Proto-UI/Proto-UI/actions/runs/45248740693) acknowledged profiler start but its first 20-second checkpoint could not stop the profiler within the existing two-second bound. No CPU sample was retained. Its final page snapshot was unavailable. The raw network counts and truncated pending list cannot locate the blocking work; a further bounded progress diagnostic remains to be implemented.

CLI analysis work is separate from this checkpoint. In the concurrent `f419483e` closed-helper path, three added definition-mutation/escape controls actually fail their first subject-gap assertion: 42 of 45 pass. Later assertions in those failed cases are not claimed as executed. A different finite certificate candidate passed 439 controls but does not cover that new scanner path. Both the whole lowered inventory and the independent producer-lifetime repair remain open.

The original seven commitments in #1178, #848, #1488 (H/F), #1098, #1453, #1156 and #1457 retain their bounded development and acceptance distinctions. The checkpoint does not supply scheduled recovery, real downstream application adoption, physical IME/assistive-technology evidence, complete native CI, an independent platform approval or a Ready decision. The next executable work is published-source native recovery, Matrix diagnosis, the complete CLI gate and final current-head validation/review.
