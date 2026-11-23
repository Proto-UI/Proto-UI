# Historical generator source-binding repair

This bounded follow-up to restoration commit `d8da090538873fefd555753f60d3fce69f3cbee9` addresses `HIST-GEN-001` and `HIST-GEN-002` found by independent source review. It preserves the frozen snapshot, all 1,697 decisions, the original first-50 reading record and the complete original Git bundle. It does not add independent decision acceptance or change #1147's 0.4 bookkeeping scope.

## What failed and what changes

| Boundary | Original failure | Repair |
| --- | --- | --- |
| Prior manual reading | Matching an object number and review-method text could carry a previous reading onto a changed body or discussion. | Bind the original `bodySha256` and `discussionSha256` to the new frozen object and cutoff-filtered, ID-sorted discussion before inheriting a reading. Missing objects, missing proof and duplicate manual records fail. |
| RAW captures and archive | The snapshot generator loaded one RAW population, then substituted a separately indexed archive without proving they were the same sources. | Read each native RAW capture once; compare the complete key set and every parsed source-value digest with the decoded archive before writing a snapshot. |
| Archive index reads | Checking or decoding index A, then independently reading replacement B could bind or load a different source. | The decoder returns hashes of the exact index buffers used for its verified values. Both the generator and snapshot reader use that same result; the reader requires the complete unique index set and exact hashes. |

All checks happen before the generator's output write. A rejected source is not silently downgraded into a new manual-reading claim, an accepted decision or a different source population.

## Executed evidence

The Node.js `v24.22.1` suite passed **21/21**, with no failures, skips or cancellations: the original nine history tests plus twelve source-binding and archive tests. The archive test actually replaces on-disk index A with B after A's read completes and requires the returned source to remain `source-a`. Applying that same behavioral test to the unchanged original reader at `d8da090...` produced an actual failure, `source-b` versus `source-a`; [the red result](original-index-race.json) and complete logs remain preserved.

The complete generator CLIs were exercised in a fresh output directory using all **1,740 original native captures** and the exact [original 50 manual-reading records](original-manual-decisions.json). The output snapshot and decisions reproduce both original gzip files byte-for-byte. This is a replay of the preserved sources, not a fresh GitHub capture or a new manual review.

| Original / replayed file | SHA-256 |
| --- | --- |
| Snapshot | `e27a20141287b63ff39334b44111ee322831d12083f405eac400c3607ba1544d` |
| Decisions | `b09eaa9cc7e5635af8486f4d2e2f0e85ec1587370c842041cc32dcb52342c532` |
| Original 50-record manual input | `fab8b955ef2596aa3b1fbcab60865dcaef861d9b369c1329a658eba65b4d59b0` |

Two further real CLI invocations supplied a changed manual source hash and a changed native RAW capture. Each exited 1 and left its requested output path absent. The complete replay's integrity check remains 1,697 objects / 50 original manual readings / **0 independent acceptances**. Its `ready` command still exits 1 because all 1,697 decisions await independent acceptance.

[validation.json](validation.json) records the exact tested file hashes, unchanged source before/after the commands, runtime, source identities, positive replays, negative controls and limitations. [commands.json](commands.json) binds the full commands and stdout/stderr hashes. The earlier successful static-source repair remains in [pre-index-fix](pre-index-fix/) as historical evidence; it is not substituted for the final index-consistency validation.

Repository public-doc and Agent-document checks also passed. The initial full Agent-operations suite passed 1,549/1,549 against its unchanged source. Its first Agent-document invocation failed because the isolated worktree lacked the installed `zod` dependency link; the original failure is retained under the initial continuation record, and the successful retry uses the existing pinned dependencies. No assertion or dependency version was weakened.

## Run the focused suite

```sh
node --test scripts/governance/history-audit.test.mjs scripts/governance/history-source-bindings.test.mjs scripts/governance/history-archive-binding.test.mjs
```

The real replay commands are recorded with their original input paths. The source archive decoder can reconstruct the native RAW values; Issue/comment pages are retained in the frozen snapshot, and the original manual input is preserved beside this record. Replaying these inputs confirms source preservation. Independent decision review and current product acceptance remain separate work, with all original conditions and owner boundaries retained.
