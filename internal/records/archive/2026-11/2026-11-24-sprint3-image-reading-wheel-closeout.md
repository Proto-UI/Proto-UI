# Sprint 3 Image reading viewport: source and native wheel evidence

The Image implementation is byte-identical to the Image file from upstream commit cc5d24a44c09da2e7f27d4532deecb5e42fa3f5d (Git blob a35c35209d398e12c6b79d14bb92166147a54a8c). Root independently verified all three unique hunks. Only Image is integrated; that upstream commit's unrelated Search and Header files are outside this change. The new commit uses the actual Codex identity and normal Signed-off-by and credits this existing contribution.

The change makes width/height writes idempotent and ignores the reading viewport's own scroll in the document geometry listener. Other document scrolling, resize, visual viewport notifications, and AbortSignal cleanup retain their original handling.

## Actual original-case results

The original case is “migrates the actual en whitepaper viewer at 1280px dark”. Both runs retain the viewport hover, native horizontal wheel, 1000 ms poll, 90 s test, 240 s setup, and 420 s diagnostic resource limit. Each selects 1 of the original 32 cases; 31 are filtered.

On 81e6b1b2cd516feb276207a6ac3afbebd70fc4a6 plus only passive diagnostics, the actual horizontal assertion fails: x remains 618 after trusted deltaX=1368, while y changes 448 to 914. The event is not default-prevented after the poll; the same viewport is connected. Raw logs, JSON, screenshots, source bindings, and the passive event journal are archived.

After applying the exact existing upstream Image source, the same original case passes: 1 passed, 0 failed, 31 filtered. The child ran 2026-11-23 23:30:30–23:32:48 UTC using Node v24.22.3 and Chrome for Testing 145.0.7632.6, sandbox enabled, and the owned source server. No input, assertion, or deadline changed.

An earlier preparation driver failed before any source patch or test execution because its Python time import was absent. Its original steps=[] and sourcePatched=false receipt is preserved. It is not a product or test failure.

## Observation and remaining gate

IMAGE_PREVIEW_WHEEL_DIAGNOSTICS=1 enables at most 96 passive wheel/scroll observations. Geometry is read after the original poll, and diagnostic errors cannot replace the primary assertion. All original 32 test cases remain intact.

The complete original 32-case followup runner is pending on the new clean commit with passive diagnostics off. Its fixed 3300 s suite budget, source checks, 12 last-observed JSON/PNG pairs, matrix evidence, and two video requirements remain unchanged. A single-case pass is not full Image acceptance. The local font package is recorded separately and is not represented as the hosted Ubuntu font environment.

Evidence: [manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint3-image-reading-wheel-closeout/manifest.json) and [original red, preparation failure, and green evidence](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint3-image-reading-wheel-closeout/execution.tar.gz).
