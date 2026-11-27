# Anatomy order notification: reuse a current domain's sorted projection

## Executed failure and source

The original combined candidate is `d0392fb31513b12f55b9e99b1fcf26a6338569c9`. The existing Matrix diagnostic workflow ran that exact source in [run 45151772158](https://github.com/Proto-UI/Proto-UI/actions/runs/45151772158), job `137614684589`. Its selected case failed the original **60000 ms activation/initialization phase**. The snapshot at phase entry contains 341 demos across four Web adapters, or 1364 previewers. The three other Matrix cases were not selected by this diagnostic workflow. Neither this selection nor its sampling is a complete Matrix acceptance run.

The complete original artifact `14807416070` is preserved byte-for-byte as [matrix-d039-original.zip](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-anatomy-notification-order/matrix-d039-original.zip). Its SHA-256 is `7b9945940a57c00c21d8a140941bac5a366d0975c40015e880cf6c4784bf4b3e`. The archive includes the original CPU profile, phase snapshots, network status, browser output, Vitest report and source/environment receipts. The profile member `demo-matrix/startup-profile/profile.json` has SHA-256 `a1c0104ef85c48ed20476d007bb87d822ec18e7976495c1ac6d13f46f4ee558c`.

The requested profile window was 45000 ms. Its actual V8 interval was 45823.521 ms, with 4987 samples and 8169 nodes. Weighting each sample by its recorded `timeDelta` gives these inclusive observations:

| Frame                   | Inclusive sampled milliseconds |
| ----------------------- | -----------------------------: |
| Anatomy `syncStructure` |                      16784.090 |
| `computeOrderSignature` |                      14487.876 |
| `sortClaims`            |                      12703.744 |
| `compareClaims`         |                       8844.297 |

Inclusive frames overlap and cannot be added. `compareClaims` accounts for 5100.075 ms of self samples, `sortClaims` 3111.540 ms, and native `compareDocumentPosition` 2016.199 ms. These observations identify repeated sorting and target reads as concrete work to remove; they do not establish that this is the sole remaining startup cost. The original status reports 1068 requests, 1062 HTTP 200 responses, six pending requests and no recorded request failures. No network or device diagnosis replaces the failed acceptance result.

The adjacent [manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-anatomy-notification-order/manifest.json) binds archive members, local commands and changed source hashes. The retained `summarize_cpu_profile.py` and `cpu-summary.json.gz` make the aggregation reproducible without changing the original profile.

## Bounded implementation change

Existing notification code already reuses logical domain discovery and individual host comparison results, but each recipient still decorates, sorts and undecorates the same claims and reacquires both targets for every comparison. This revision adds a sorted projection scoped to the existing synchronous notification.

Each recipient reacquires every current host target once before using that projection. Comparator identities are read after target acquisition, including replacement of a method on the same target object. The order is reusable only when both vectors match. A different current target, different comparator or different domain claim array produces a new sorted projection. Claims are keyed by their existing domain array, which is isolated by family, root and exact logical parent bridge; no other domain is skipped.

Existing callback and host observer registration/disposal boundaries invalidate all shared notification reads. Public order queries continue to read current claims and targets directly. Stable registration-order fallback, owner notification order, version-change semantics, portal membership, independent bridges, nested root boundaries and terminal retirement remain governed by their existing contracts. No public capability, lifecycle phase or source-admission status changes.

Relevant draft authority remains `C-ANATOMY-ORDER-0001`, `C-ANATOMY-ORDER-0002`, `C-ANATOMY-ORDER-0003`, `HC-ANATOMY-ORDER-0001` and `HC-ANATOMY-STRUCTURE-0001`; this repair does not promote those authorities.

## Discriminating validation

The new real Runtime regression uses 64 items plus their root and 16 subscribed owners. It shuffles actual DOM order, primes the current signatures, then observes an unchanged structural notification or host observer notification. It requires fresh target acquisition for every recipient, bounds aggregate host reads to a linear allowance of 2080, verifies silence/version stability, and subsequently reverses the DOM to require the newly ordered public callback results.

On the unchanged implementation, both notification paths fail with **9856 target reads**. The original implementation passes the other 29 tests in that initial selection, including the added replacement-target control. After the repair, both cost tests pass within the same allowance. This is a host-operation count, not a wall-clock performance estimate.

Actual local execution on Node 24.22.3 and pnpm 10.32.1:

| Selection | Result |
| --- | --- |
| All Anatomy module tests and Runtime order/domain contracts | 10 files; 92 passed, 0 failed, 0 skipped |
| Four Web-adapter Anatomy integrations, logical parent authority, Runtime catalog lifecycle, reparent rollback and retained Table membership | 11 files; 29 passed, 0 failed, 0 skipped |
| Three changed TypeScript files and their imported closure, extending the repository's unchanged strict configuration | exit 0 |

The retained tests cover replacement targets and comparator methods, nested synchronous notifications, immediate public queries after callbacks, callback reparenting, observer acquisition that moves a later recipient, separate logical bridges, portal-mounted members and retired domain boundaries. The complete commands, baseline failures, stdout, Vitest reports, strict configuration and before/after source digests are in [local-validation.tar.gz](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-anatomy-notification-order/local-validation.tar.gz). The local base commit is `a7652aa0dc9ed7dedc87c79751dd50ba7b204608`; its Anatomy implementation is identical to the profiled `d0392fb` source, and the candidate source hashes are recorded explicitly.

## Remaining acceptance

The local checks establish bounded operation counts and semantic controls. They do not clear the original Matrix failure or the separate 1000 ms preference-switch failure. The full original unprofiled Matrix suite must execute on the integrated candidate with all 1364 current previewers, real scrolling, original 60000 ms phase budgets and original case deadlines. Search's four original enlarged-text cases, the original preference reconnect case, official Sprint 1/Sprint 2 selections and complete CI remain subject to their own exact-candidate results.
