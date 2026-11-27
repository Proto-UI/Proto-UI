# Sprint 5: replay the unchanged production graph and preserve the existing static bridge

This non-normative continuation of [PR #1715](https://github.com/Proto-UI/Proto-UI/pull/1715) corrects the production validator introduced at `03c5b45c07a225f2a80d42034bd7a4b619b63d5b`. The previous [ownership record](2026-11-23-sprint5-material-diagnostic-ownership.md), its passing synthetic controls and its remaining production requirement are preserved. No diagnostic route, compiler runtime, preview lifecycle, graph generator, generated graph or permission list changes in this correction.

## What the actual production build established

The [03c5 production job](https://github.com/Proto-UI/Proto-UI/actions/runs/45204696433/job/137797437237) passed all 1,915 bundle controls and completed the real documentation build. Its validator then failed. The new always-run retention step successfully copied the original 5,003,636-byte production graph, retained its runner-side SHA-256 and bound it to the source commit and tree.

The actual graph includes the expected exact diagnostic route-to-producer edges and the six material modules. It also places existing site-control dependencies in a shared static bridge chunk. The original ordinary-shell validator already permits that exact bridge chunk and its finite reviewed Adapter list. The first diagnostic validator accidentally removed that existing static permission while applying its stricter material-only source boundary to every shared chunk member. The extra Web Component modules in this particular graph have emitted code; they are not all zero-length or tree-shaken records.

The correction reuses the same existing bridge-chunk identity and finite Adapter list. Emitted modules are checked separately for each chunk, so copying an otherwise permitted module into another chunk cannot inherit permission. A bridge module is admitted only when the bridge is unique, lies in the diagnostic's static chunk closure, and is genuinely reachable from the exact `site-shadcn-controls.ts` source API. A dynamic-only bridge remains forbidden. React, Vue and unreviewed Adapter members remain forbidden even in the bridge chunk.

The diagnostic's own module closure is checked independently. Every route-originating static or dynamic path still rejects Web Component, React, Vue and unreviewed Base imports, including imports targeting the existing bridge. All six material modules must still belong to the exact producer, and a separate traversal stops at that producer to detect every alternate route path into those same modules. Complete, unique module records, dangling-edge rejection, exact route identity and the global server-only wall remain in force.

## Real-graph replay and controls

The [manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint5-material-diagnostic-replay/manifest.json) binds the exact corrected source/test hashes, local and hosted Node versions, original production identity, compressed graph, raw failing/passing logs and replay script. The graph SHA-256 is `be5da61fbdfefb64c4aff7e76cc865e28201ef74d01d86b8db567852e8f9cad1`. It matches the runner-side hash and is identical before and after independent replay.

| Checker applied to the same original graph | Actual result |
| --- | --- |
| Original d985 checker | Exactly two failures: the two diagnostic entries statically reach the same six material modules |
| First 03c5 checker | 292 issues from the removed existing static bridge permission; this failed candidate remains retained |
| Corrected candidate, exact hash in manifest | Zero issues |

Node 24.22.3 ran the complete corrected bundle suite: **1,945 passed, zero failed, cancelled, skipped or todo**. Thirty new controls cover the existing static bridge's placement and actual API ownership, direct route and producer Web Component imports through both edge kinds, dynamic-only bridge delivery, the same module emitted in an unrelated chunk, React/Vue/unreviewed material in a bridge, and duplicate, missing or dangling provenance. The preceding 1,915 controls remain intact. Formatting and `git diff --check` also passed.

The compressed graph contains the actual original bytes from hosted production. The graph generator, its emitted metadata and the original build log were not edited to obtain the passing replay. This result verifies the corrected checker against that retained 03c5 build; final published-head hosted checks remain separate results.

## Browser boundary

Both the d985 and 03c5 hosted browser jobs still failed the edit/reject/recover and subsequent cancel/reopen paths. An independent unmodified 03c5 canonical run using local Chromium 145 reproduced those same two failures; hosted Chromium was 157. Both retain the real 250-millisecond cleanup-acknowledgement requirement. The local source/asset stability checks passed and its checkout remained clean. Browser diagnosis and its eventual product correction are separate from this production-validator change.

The gate implementation received an independent source review of its actual diff and unchanged graph replay. It does not claim GitHub APPROVED status, a whole-PR browser pass, release admission or completion of the broader Sprint 5 issue inventory.
