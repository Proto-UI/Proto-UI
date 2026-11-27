# Sprint 4 browser preparation: original failed run retained

The exact candidate `282cbca2c375b371470eb75853750ba023f420b3` completed the selected 181-test public semantic/shader unit run recorded separately. Its remote **28-case real-browser attempt did not reach any product assertion**. The process exited 1 with a `beforeAll` hook timeout at the unchanged 120,000 ms limit: 0 passed, 0 failed assertions, 28 pending assertions, and one failed suite. This is an unsuccessful preparation run, not 28 product failures or browser acceptance.

The command ran from `2026-11-23T19:36:01.499642+00:00` to `2026-11-23T19:42:41.690461+00:00` using Node 24.22.3, the frozen workspace dependency lock, one Vitest fork, and Google Chrome for Testing 145.0.7632.6. The original harness retained `chromiumSandbox: true`. The separate sandbox smoke succeeded; it did not execute a shader journey.

## Observed preparation sequence

| Observation | Result and limit |
| --- | --- |
| Locked workspace installation | Completed; the dependency lock remained unchanged. |
| Initial Chromium download | Failed with ENOSPC. The original log and receipt remain retained. |
| Download using the task's writable temporary directory | Completed with the same selected browser revision. |
| First sandbox smoke | Failed with SIGTRAP. No browser sandbox flag or host policy was weakened. |
| Shorter writable project temporary directory | The sandbox smoke succeeded. An intervening denied directory creation remains recorded; its permissions were not changed. |
| Original shader fixture preparation | The first inline fixture completed source collection, all four native profile compilations, and the Runtime/native bundle. The second immutable-data fixture did not complete before the hook failure. |

A source-snapshot Git process was briefly observed in disk sleep during diagnosis. Its original command later returned normally. No file-descriptor observation established the blocked file or an optional-index-refresh cause. `GIT_OPTIONAL_LOCKS` was not used to bypass or replace the original source witness, no source snapshot was faked, and the candidate was not changed during the attempt.

The retained inline build binds the exact candidate and tree `91949a055947ce353e535570bc1430d0da368680`, `dirty: false`, empty status/diff SHA-256, four native target sources, the actual input and generator hashes, and bundle SHA-256 `aa826207429c975a75981b2000179c6cda3f4e8ad2f493e5b2268b9fc47762fb`. Every selected source hash and the dependency lock matched before and after execution. These facts prove the first fixture was built; they do not prove that any shader rendered.

## Retained originals and next execution

The [summary](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint4-browser-preparation/summary.json), [20-file manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint4-browser-preparation/manifest.json), and [lossless original archive](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint4-browser-preparation/originals.tar.gz) preserve the setup failures, later environment successes, exact failed command/report and inline build manifest. The archive SHA-256 is `94a4897c903c87ca643badca7e873912ed849590d86f2803998fa746eb0f0554`; every member was read back and checked against the manifest. No original IR10 source or credentials are contained in this browser evidence packet.

The manual shader evidence lane uses the same real-browser suite and original source witness on the supported isolated CI runner. It does not replace the complete scheduled runtime browser selection. Its reviewed selection retains the original 28 journey identities and adds nine scene-source journeys, requiring all 37 distinct results and all three actual four-target source builds. An unsuccessful, skipped, partial or substituted collection fails the evidence check. The workflow and its report controls are preparation, not an assertion that the later browser run has passed; that run needs its own exact revision and result.

The evidence check itself has eight persistent controls. Independent review found that merely counting distinct names could accept a substituted journey, and that a correct target label could hide a wrong emitted profile. Both checks now use the exact selected identities and target/profile pairs. The [earlier profile finding](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint4-browser-preparation/shader-ci-independent-review-before-profile-fix.json.gz), [11/11 corrected independent controls](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint4-browser-preparation/shader-ci-independent-review.json.gz), and [executed probe](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint4-browser-preparation/shader-ci-independent-review.mjs.gz) retain their actual source hashes and synthetic-control boundary. They are not rendered browser evidence or a GitHub approval.
