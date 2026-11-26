# Restore runtime process ownership after concurrent integration

Date: 2026-11-24

Baseline: `4aaac6ac60348dc99896c34cd1186abcda98ff0d`

Candidate: formatted source hashes in the archived execution receipt.

Authorship: Codex, an OpenAI coding agent. Independent local review used a separate agent context.

## Request and scope

**Agent paraphrase:** verify and repair the reported runtime-test orphan cleanup problem. This continues the original request after concurrent integration changed the implementation. The `b736` merge resolution in [PR #1798](https://github.com/Proto-UI/Proto-UI/pull/1798), subsequently merged as `4aaac6ac`, replaced the previously tested process owner with `runtime-process-tree`.

The executable change touches four `scripts/test` files; this record and the compressed artifacts preserve its evidence. The existing Linux ownership helper interface is preserved. This is repository test orchestration, with no newly asserted active product spec or public package contract. The [authority map](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-runtime-merge-regression/audit/authority-map.json.gz) separates user-authorized restoration, implementation evidence and historical records.

## First divergence and consequence

The [original diagnostic](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-runtime-merge-regression/audit/original-probe.mjs.gz) imports the exact helper from `4aaac6ac`. `ownProcessTree.capture()` initially knows producer PID 3520481. That producer creates detached leaf 3520489 and exits before the next default 500 ms sample. After reparenting, neither the original group nor observed ancestry identifies the leaf.

| Observation point | Measured state | Consequence |
| --- | --- | --- |
| Initial capture | `initialOwned=[3520481]` | The producer is observed; the future leaf is absent. |
| After producer exit | At 389 ms, leaf 3520489 remains live, PPID 2451, PGID 3520489 | Sampling has missed the detached ownership transition. |
| `stop()` receipt | No signals, errors or remaining entries; `verified:true` | `trackChild()` accepts cleanup while the broader invocation-owned descendant survives. |

The receipt explicitly limits verification to continuously anchored groups and observed identities. The regression is loss of the earlier broader ownership guarantee, not a contradiction within that narrower declaration. Diagnostic exit 0 means execution succeeded, not cleanup passed. The [raw result](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-runtime-merge-regression/audit/original-probe-result.json.gz) also confirms the fixture subsequently removed its own survivor.

## Repair and review corrections

`spawnOwnedProcess` attaches a fresh inherited Linux marker before execution. Discovery uses the existing marker, UID and PID/start-time identity machinery, allowing marked descendants to be recovered after parent exit while retaining process-identity fences and cleanup receipts.

Independent review rejected the first draft's missing-marker path: a live producer could remain unbound while the new branch returned success. V2 retains an explicit identity-gap error and refuses unverified signals; genuine marker/UID/start-time binding clears that gap. The [negative probe](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-runtime-merge-regression/audit/marker-refusal-probe.stdout.log.gz) preserves the rejected result.

Review also found signal-path output truncation. Under identical SIGTERM and a 500 ms delayed reader, the pre-merge `fa86ccb4` wrapper delivered all 4,194,304 bytes, whereas `4aaac6ac` delivered 255,808 and draft v1 delivered 219,264. See the [source-bound comparison](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-runtime-merge-regression/audit/output-drain-probe-results.json.gz).

V2 coalesces active Vitest completion and uses one memoized finalizer for normal and interrupted shutdown. It coordinates owned cleanup, actual exit/close observation, forwarded output and the final receipt within bounded drain deadlines. Unknown child exit remains unknown. SIGHUP maps to 129; SIGINT and SIGTERM retain 130 and 143.

## Evidence and remaining acceptance

The implementation owner ran [three focused controls](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-runtime-merge-regression/audit/v2-focused-result.json.gz): unsampled marked descendant recovery, missing-marker failure reporting, and signal-path output drain; all three passed on unformatted v2.

The independent reviewer separately executed [three real-wrapper controls with fixture producers](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-runtime-merge-regression/audit/output-drain-probe-v2-results.json.gz). The 500 ms reader recovered every payload byte with matching SHA256 and a final drain receipt. A reader blocked for 3,500 ms exceeded the two-second bound and correctly retained output loss with `verified:false`. Injected `ps` failure retained an unknown live producer and `childExitObserved:false`, without claiming successful cleanup; fixture teardown removed the survivor.

The [local review](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-runtime-merge-regression/audit/independent-v2-review.json.gz) resolved its two blocking findings on unformatted v2. It is not GitHub approval or verification of later formatted bytes. The [formatted candidate manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-runtime-merge-regression/audit/candidate-v2.json.gz) records those distinct file hashes and patch application. The formatted candidate then passed the complete current runner suite: **149 tests, 9 suites, 149 passed, zero failed or skipped**, exit 0 in 44.734 seconds on Linux/Node 24.22.3. The command was `node --test --test-reporter=tap scripts/test/run-runtime-tests.test.mjs`; source hashes before and after execution matched the candidate manifest. See the [execution receipt](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-runtime-merge-regression/validation/receipt.json.gz) and [TAP output](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-runtime-merge-regression/validation/runtime-tests.stdout.log.gz).

| Criterion | Implementation and local evidence | Integration / native CI at record creation |
| --- | --- | --- |
| PM-OWNER-1 | Marker recovery implemented; focused orphan control passed | Pending |
| PM-OWNER-2 | Unbound producer fails closed; negative control passed | Pending |
| PM-OWNER-3 | Identity boundaries retained; complete formatted suite passed | Pending |
| PM-OWNER-4 | Shared finalizer and SIGHUP mapping implemented; focused and full-suite validation passed | Pending |

Native evidence is Linux/Node 24.22.3 only. Blocked consumers can still lose output, and unavailable observation can leave unknown processes alive; both remain explicit failures. Windows/macOS execution, whole-repository CI and platform review are unestablished. Header and budget code is unaffected; their older evidence, focus/Typography failures and remaining graph findings retain their original historical scope. No Issue checkbox or integration completion is asserted by this record.
