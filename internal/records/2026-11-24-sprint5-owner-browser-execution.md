# Sprint 5 actual Chromium owner matrix and independent initial-graph review

## Result and exact candidate

The nine private generated-owner journeys executed in actual sandboxed Chromium and passed: **9 passed, 0 failed, 0 skipped, exit 0**. Execution ran from `2026-11-23T22:33:31.011571+00:00` to `2026-11-23T22:34:05.529346+00:00` on Linux x64, Node `v24.22.3`, Chromium `145.0.7632.6`, with `chromiumSandbox: true`.

This is the successor to the physical-pending author freeze in `2026-11-24-sprint5-owner-browser-matrix.md`. It also records the final independent review successor. The earlier archive and its failures remain unchanged. Both owner specifications and the browser test entity remain draft; these receipts do not activate a canonical SSR target.

The producer used the exact reviewed source delta represented by tree `543ea376db64388814ba4a02cd968236c69747a7`, with author evidence tree `f18a29ead00664ee50e806863900cc7a379d0ad0`, over reviewed base tree `95576086dfad30c721b95dff5e97d4d103ba6be8`. Those are Git tree identities, not claims of an executed public commit or merge. Its checkout HEAD was `c99a224ad2221d886422cda2335b4a24b09619c0` plus the recorded prior reviewed owner patches and current source delta. The raw producer provenance, complete emitted artifacts and source hashes are retained.

The two repaired production sources were unchanged between source validation, independent review and the physical producer:

| Source | SHA-256 |
| --- | --- |
| `packages/compiler/src/vue-source.ts` | `e5ace099ed1d0a1b5998535d72e0a3dbfb0e2c9b98e8f2b493ee17fe24889fba` |
| `packages/compiler/src/vue-ssr-support.ts` | `3d21b7af644bcf281c674175d80403b76e60bd099666b0fbcdbb93492fc3f74a` |

## Real producer, portable execution and unchanged oracle

The local final compiler emitted 15 actual source/support artifacts. Native React, Vue 3 and Vue 2 server renderers generated the nine HTML/carrier fixtures. The unchanged matrix builder bundled those artifacts and their actual framework consumers into a 2,925,730-byte browser program. No authored runtime, State/Context mock or native-renderer substitute ran in the browser.

The prepared artifact bundle was transferred to an isolated task directory on the existing test device. Every payload file was checked against its SHA-256 before execution. A small portable Vitest driver supplied the prepared artifacts over an actual HTTP server on an automatically assigned loopback port and launched the existing Chromium installation. It retained the canonical suite's case loop, page evaluation, viewport, screenshots, page-error handling and disposal sequence. Its test assertions were the **byte-identical repository file** `owner-hydration-matrix-assertions.ts`; neither its expected values nor the consumer's readiness conditions changed for remote execution.

This portable run avoids requiring another repository installation on the device. It is actual browser evidence for these frozen producer artifacts. It does not claim that the canonical runtime shard or a later integrated checkout has already executed. The repository suite remains registered with its unique runtime-plan owner, and final integration CI owns the later exact-checkout run.

| Bound artifact             | SHA-256                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| Prepared payload archive   | `da76f6e486884ceb8bb6eb74e96f1b7734ae45c7470ed7cac3f6afff78680f94` |
| Actual browser program     | `12c5461e71862940ccfa79a7c08acc8f2a3e77ce9d0ce226e4e45c0fff83c6bf` |
| Unchanged assertion source | `03cc4e2f93adf163ac05885a00a53d965475300b2cf7d00deabc230c1191cf4c` |

The payload also retains the original canonical browser test source, producer/export program, actual artifact contents, source/module/framework provenance, fixture data, portable runner and configuration. The physical archive retains the exact command, process/exit records, Vitest JSON and logs. None of the standalone runner changes alters production code or admits a wider target profile.

## Accepted observations

| Target | Journey | Actual result |
| --- | --- | --- |
| React | Identity, current updates, withdrawal/re-entry and fresh recovery | Pass |
| React | Native hydration rejection, real effect/listener retirement and fresh recovery | Pass |
| Vue 3 | Identity, current updates, withdrawal/re-entry and fresh recovery | Pass |
| Vue 3 | Native hydration rejection, real watcher/listener retirement and fresh recovery | Pass |
| Vue 3 | Initially absent server owner, current visible input and fresh child graph | Pass |
| Vue 3 | Falsy partial-startup failure, complete retirement and explicit input 9 recovery | Pass |
| Vue 3 | Parent mounted/updated Context writes after complete initial validation | Pass |
| Vue 2 | Identity, current updates, withdrawal/re-entry and fresh recovery | Pass |
| Vue 2 | Native hydration rejection, real watcher/listener retirement and fresh recovery | Pass |

All nine cases retained `failure: null` and an empty unhandled page-error array. Expected mismatch warnings and console output remain in the raw per-case JSON rather than being erased.

The common identity journeys compare four actual State handles and the shared/distinct Context objects for a native wrapper and nested provider. Updates preserve the surviving owner's State. Withdrawal retires old child owners; re-entry creates distinct children. A held callback from a retired child refuses after release. Terminal disposal invalidates State and exposed callbacks. Explicit recovery from the original carrier accepts current seed 9 in a new owner graph while old handles remain terminal.

The failure journeys verify real native work, not just a closed bookkeeping flag: rejected effects, watchers and event listeners stop; old signals/events no longer execute them; explicit fresh input recovers. The Vue partial-startup journey also observes the parent still at initial server value 3 when the child failure occurs, preserving the first falsy value `false` through cleanup.

The Vue commit journey validates all initial Context descendants before the parent's authored mounted and updated effects change Context from 3 to 7 to 8. The original adopted DOM and State identities survive. A subsequent ordinary controlled update still propagates 9. Its final screenshot therefore shows values `9, 9, 11, 11`; the earlier `8, 8, 11, 11` checkpoint is retained in the structured observation. The screenshot was visually inspected for this final paint, without claiming general visual, hardware-input or assistive-technology conformance.

The separate pending-async-descendant, cancellation and secondary-cleanup controls remain actual emitted/native Vue source tests in simulated DOM. They are not relabeled as physical cases by this nine-case result.

## Independent review successor

The independent reviewer `/root/browser` inspected the final two production modules and their guard/retirement changes and reported no new defect in the reviewed delta. The reviewer reran its original mounted Context controls without changing the probe bytes: **2 passed, 0 failed**, using the same two final production source hashes above. This preserves the valid no-mutation control and the original parent-mounted Context counterexample that failed against the props-only candidate.

The original failing probe, exact earlier source copies and diagnostic finding remain alongside the final independent JSON/log. This is an agent source review and actual source-consumer replay; it is not a fabricated GitHub review event or an acceptance of all #895/#896 conditions.

## Evidence custody and execution limits

Evidence is additive under `evidence/2026-11-24-sprint5-owner-browser-matrix/`:

| Archive | Contents | SHA-256 |
| --- | --- | --- |
| `author.tar.gz` | Previously frozen author successes, failures, source controls and intermediate archive | `3fe7eb64e466fb61e89d3b45ce93c93d8901cb3550ce5c22b26e8bc6ab4a92b5` |
| `physical.tar.gz` | 25 entries: exact prepared payload, command/process/exit records, Vitest/log output, nine per-case JSON files, nine screenshots and execution provenance | `6e75de549320717af44a34d440bc38a414c1cce9ccf01c680d30c3fedea69876` |
| `independent-review.tar.gz` | 11 entries: preserved original finding/probe/source and final unchanged-probe success | `f45878a8b88881c3fd639b1b49b137364220eed1669add3d8007db496f1085ee` |

Each archive has an adjacent manifest with per-entry hashes. The downloaded physical archive was checked byte-for-byte against the device's SHA-256, then decoded to verify its result, payload identity, nine case outcomes and nine images. The local original prepared payload exactly matches the payload retained inside the physical archive.

The initial lightweight device query experienced a queued timeout before browser startup. Later evidence transfer encountered a connection/rate-limit error and resumed from individually verified chunks after a pause. These were transport events; the browser command executed once and completed with the exit/result above. No browser retry, sandbox relaxation, oracle change or deadline relaxation was used to obtain the result.

This establishes the listed bounded private consumers. Application provenance/authentication, complete compiler/helper/request compatibility governance, every target capability, arbitrary State migration, platform input/AT and the independent shared-definition acceptance conditions remain separate. The earlier killed broad source-typecheck also remains an incomplete gate; successful production/artifact/source and browser checks do not turn it into a pass.
