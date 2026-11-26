# Sprint 6: admitted resident-motion environment ownership

This is a bounded development repair for PR #1712. It does not claim final native acceptance, a GitHub approval, main integration of this PR, physical input-to-photon performance or promotion of a draft definition.

## Source and authority

The candidate preserves the original `84ef7893e732a316388aeb730af1758b96f703e8` merge (parents `24e553961e7a898b74b959792d35f49364f35efc` and `0adde15d1e5dacb112cdad4d8d7811e015cc4456`) and incorporates main `0fbb52ef832cc27c78e24c28c59a55a16f51d7fe` through an ordinary merge. Its four CLI changes are identical to their upstream blobs. The editor ownership/composition matrix and exact held-image decode cache remain intact. The sole earlier Control Label conflict retains main's complete two-criterion GPUI definition.

The applicable direction remains draft: `C-FEEDBACK-RESIDENT-MOTION-0001-A/E/H` and `HC-FEEDBACK-RESIDENT-MOTION-0001-EPOCH/OWNER`. Older views/revisions cannot affect current presentation, declaration metadata is snapshotted, and only the current projection owner can advance an acknowledged sample. No definition or lifecycle changes are needed for this repair.

## Reproduction and correction

Independent finding `S6-REVIEW-001` was reproduced in the original device worktree at HEAD `34cbf089c3e5ff638a27372ab973b54fd364b54b`, staged main `0adde15d`, tree `17dffc9a216214798c05fd4c873764599ea2b4ff`. The two original cases executed unchanged: the same-declaration stale-revision control passed; an older view carrying translate instead of width failed. At 50 ms an active 100-to-300 px width transition lost its inline lease (`''` instead of `200px`). All 81 actually loaded source modules and the primary/config/lock bindings were unchanged after execution. This is a deterministic CSSOM/clock harness, not a physical browser timing measurement.

The Web wrapper previously changed `widthRequested` before the shared projector could reject a frame. The projector now passes an independent frozen property array derived once from its admitted, snapshotted declarations. The Web environment reads that array, and the wrapper returns the existing sink directly. Rejected commits have no separate Web-side admission state to mutate.

Environment and clock callbacks can synchronously reenter. The projector now rechecks its frame identity and generation after each callback, before changing shared samplers or visibility state. Two added controls observed the old sampler produce about 200 px where the newer 100-to-400 px animation required 250 px; both pass after the repair. The accepted frame owns the metadata and sampler state together.

## Executed evidence and limits

| Check | Actual result on the uncommitted combination |
| --- | --- |
| Two focused width files, original implementation plus seven added cases | 20 cases: 14 passed, 6 failed, no skipped/todo |
| Same two test-file bytes after the implementation repair | 20/20 passed, no skipped/todo |
| Motion source selection | Nine files, 123/123 passed |
| Existing shared motion suites | Seven files, 87/87 passed |
| Updated main hook accessor suite | 8/8 passed |
| Existing material/cache selection | Seven files, 325/325 passed, including seven independent controls |
| Editor support | Four files, 52/52 passed |
| Source/receipt Node controls | 105/105 passed, exit 0 |
| Public type contracts | Initial exit 137; serial 1 GiB heap rerun passed, exit 0 |
| Full workspace types and preset source checks | Externally killed with exit 137 in both local attempts; final CI remains required |
| Brutalist reference-token suite | One passed, one pending after worker interruption in both attempts; no complete suite pass is claimed |

Both validation attempts retain their original logs and failed aggregate results. The first preserved 12,086 source-file hashes unchanged before and after execution. The second also checks the same complete source mapping. No assertion or test deadline was relaxed to obtain a pass. The lower-heap attempt is an environment diagnostic, not a replacement for canonical repository CI.

The strict Bootstrap Motion inventory grows from 129 to 136: 123 source/DOM-model cases and the same 13 browser cases (six Modal Document, three Progress Document, three direct Shadow positives, and one expected experimental-split rejection). All eleven selected files and every original browser assertion remain required. Updating the inventory is not evidence that the new 136-case native job has already run.

Independent review has inspected the repair, original failures, green focused results, unchanged upstream CLI blobs and the exact gate increase. Its finding is resolved in the reviewed working copy, pending the final committed source and CI. This is local independent review, not a submitted GitHub APPROVE.

## Durable evidence

The adjacent [manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint6-integration/resident-motion-admission-manifest.json) binds every original member of the [raw evidence archive](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint6-integration/resident-motion-admission-evidence.tar.gz), including the actual device reproduction, original red/green reports, both validation attempts, before/after source snapshots, and independent readback. Older records and failures remain historical; none are rewritten as a final-combination pass.

Next: publish the normally signed candidate, measure its canonical package cost, make any justified numeric budget transaction separately reviewable, execute the final Bootstrap/Liquid/matched-frame/Select workflows, inspect the actual captures, refresh independent review, and reconcile the seven Issue criteria plus PR body. Existing platform approval/DCO/rules remain applicable. The current instruction authorizes this development continuation; no merge or acceptance bypass is implied.
