# Sprint 5 Qt evidence inventory and independent request review

This record supports the bounded Qt consumer work under #1144. It records a checker repair and an independent review of the author's Scroll request changes. It does not activate a public Qt profile or promote the draft Scroll contracts.

## Checker failure and repair

The original checker accepted three deliberately invalid, synthetic evidence directories: an empty source and artifact inventory, omitted generated artifacts, and a foreign case list repeated consistently in the source receipt and consumer result. None contained the generated Qt source or cold IR. Each nevertheless produced `acceptance.json`. These are evidence-checker negative controls, not native execution results.

The original checker SHA-256 was `718cd589ee447827f495b3e8de22238c9d1f723c99f46a0459ee8e806edd1383`. The original eight-case inputs and false acceptances remain in the author archive. The consumer subsequently acquired four additional real cases; its current denominator is twelve.

The checked-in fixture `evidence-contract.json` now owns the exact twelve case identities, 82 repository input paths, 27 artifact paths, and five original-input copies. Both the actual producer and the checker read this file. The producer checks its complete output inventory before writing. Its receipt includes byte counts and SHA-256 hashes for every declared source input and artifact.

The checker requires the trusted inventories and case identities, then verifies the source head, bytes, hashes, original prototype/Consumer copies, wrapper result, SDK version, native process outcomes, and absence of generated drift. Empty, omitted, duplicate, unexpected, absolute, traversal, and symlink paths reject. It resolves repository source paths relative to its own checkout, independent of the caller's working directory. Existing acceptance files remain protected by `wx`.

The 82 paths cover the producer's static runtime repository import closure, the actual four prototypes and Consumer, the producer and wrapper, the checker and trusted manifest, and the package/lock/compiler configuration inputs. A separate test walks the producer's TypeScript import graph and rejects an undeclared local runtime dependency. Node built-ins and the lockfile-pinned TypeScript dependency remain external toolchain inputs; the manifest does not claim to archive a Qt SDK.

## Author verification

| Check | Actual result | Boundary |
| --- | --- | --- |
| Checker report and on-disk controls | 39 passed, 0 failed, 0 skipped | Synthetic report validation; no native execution claim |
| Actual parser → cold JSON IR → Qt producer | 12 cases, 82 inputs, 27 artifacts | Source generation only |
| Producer artifact comparison | All 27 artifact paths and hashes equal the prior twelve-case producer | The repair changes evidence binding, not emitted Qt code |
| Strict TypeScript, producer and native wrapper dependency closure | 410 files, 0 diagnostics | The selected closure, not the full workspace gate |

The tests include the three original failure classes, omitted and duplicated entries, foreign case names, skipped wrappers, nonzero or killed native processes, missing or duplicate native output, changed SDK versions, generated drift, source and artifact hash/byte drift, replacement original inputs with matching forged receipt hashes, artifact and parent-directory symlinks, wrong source heads, and execution from an unrelated working directory.

The source-only repair is frozen against baseline snapshot `fa4e2343aca9601ca2cf3023a0f48a7896b691d4` at tree `69670848cc0205119690509ff81be2979b4e70c1`. The underlying checkout commit was `b8800d4cef9302718d4514b1ba28508860059929`. Its four-file binary patch has SHA-256 `25559d25a409542ae33a85bacbddff32b3d4e2d65c5954a9f8d30f6d6c94783b`.

The expanded source receipt has a new explicit schema. Existing actual Qt runs retain their original source and receipt boundaries. A final native wrapper run with the current producer and checker is still needed; old receipts must not be filled in retrospectively and represented as such a run.

## Independent Scroll request review

The applicable direction remains draft `C-SCROLL-0001`, `C-SCROLL-END-FOLLOW-0001`, and `C-SCROLL-AXIS-SYNC-0001`. The review exercised the actual emitted QtControls JavaScript against bounded host witnesses. It did not execute the Qt SDK or claim native geometry, hardware input, GPU, or AT acceptance.

The initial author source, SHA-256 `96b624725ce01de4d8cb5dece1adda7ef9b6d94b037dfe4643cd171c2b104dbd`, passed two independent controls and failed three. An end request stopped before delivery could leave its observed status `pending` after an axes change, a newer ordinary position request, or a throwing pending observer. The original current-request success and preservation of a first `undefined` host error both passed.

The intermediate repair, SHA-256 `d971636f1986221fbf8005918744cdafdedd4fe6240a70ecec89b03f25d6427b`, passed eight of nine independent controls. The remaining failure occurred after actual host delivery: a throwing `following` state observer interrupted publication of the separate request-status fact. The snapshot recorded `applied`, while the observed request status still reported `pending`.

The final reviewed source, SHA-256 `19622fe938caa54cbbb1593ffeb906faa4e94e9770eadb1de1bbb7268e6f9670`, passed all ten independent controls. The original failures remain in the archive. The final controls also distinguish errors before delivery from errors in applied-state or applied-status observers, preserve first falsy errors, and prevent old error cleanup or the second fact publication from overwriting a newer request's outcome. No additional confirmed defect remained in this bounded source delta. An actual Qt SDK run for this final source is a separate acceptance item.

## Evidence

- [Author manifest](evidence/2026-11-24-sprint5-qt-evidence-checker/manifest.json) binds 161 files, including all 82 producer inputs, real generated artifacts, original invalid reports, source patch, and full check logs. The author archive is 491,832 bytes with SHA-256 `226869a5d3ba70c6576bc3d3487d0e08876a569614261d78b7f99198ec1d3c88`.
- [Independent request-review manifest](evidence/2026-11-24-sprint5-qt-evidence-checker/independent-request-review-manifest.json) binds the unchanged original probes, their subsequent extensions, all three source versions, and each result. The 7,172-byte archive has SHA-256 `16135f67b4fd4f06f7d81777ed248d425a6fb5dd1f02bdd04ade07aee1898525`.

Independent review of the checker repair, integration, the final source-bound native run, and Issue tracking remain with the coordinating owner. This record does not attest that those later actions have already occurred.

### Original reproduction input preservation

The original false-green receipts bind the eight-case producer at SHA-256 `6c468f0df74e90ea401d2c5ee6e1417ccf3e566a3332dbc20daa650ca6cbd55d`. The author archive's `before` directory contains the later twelve-case snapshot. The additive [original input manifest](evidence/2026-11-24-sprint5-qt-evidence-checker/original-checker-inputs-manifest.json) preserves the original eleven-file snapshot, including that exact producer and the unchanged original checker. It pairs with the original synthetic report directories already in `author.tar.gz`. The previous archive and source-patch hashes remain unchanged.
