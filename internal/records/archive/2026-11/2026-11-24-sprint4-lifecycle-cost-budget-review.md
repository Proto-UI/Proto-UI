# Sprint 4 lifecycle cost: independent numerical review

The scene cleanup fixes at a1246a78c6bb98beafd619e1e25342bead02635b passed the 54 lifecycle controls, complete workspace types, and the original 37-case hosted browser lane. Its clean canonical strict budget run [45285226888](https://github.com/Proto-UI/Proto-UI/actions/runs/45285226888) failed 3 of 9 entries. This transaction preserves that failure and changes only three numerical ceilings.

| Entry         | Measured gzip bytes | Previous ceiling | Reviewed ceiling | Remaining bytes |
| ------------- | ------------------: | ---------------: | ---------------: | --------------: |
| React         |              172879 |           172800 |           172900 |              21 |
| Vue           |              171658 |           171600 |           171700 |              42 |
| Web Component |              207444 |           207400 |           207500 |              56 |

The independent numerical reviewer image_diagnostic_wiring proposed the next existing 100-byte bands after comparing all 9 entries, both original diagnostics, the complete source closure, and the toolchain. Root performed a second technical review. sprint3_remote_validation executes the transaction with the actual Codex identity. These agent reviews are not a maintainer's GitHub approval.

## Cost and source boundary

The old raw measurement belongs to 9fff88cf23d4e55375979bc5c68c033e3deaed38; it is not relabeled as a c18 measurement. The later c18 numerical-only run already established the same 9+2 output. Compared with those product bytes, a124 grows React by 130 gzip bytes, Vue by 122, and Web Component by 141. The other six entries retain their minified/gzip byte counts and minified hashes.

Both reports use Node v24.22.3, esbuild 0.25.12, zlib 1.3.2.1-motley-285e94b, Linux x64, ESM/browser/es2020, minification, tree shaking, and gzip level 9. The complete environment and measurement objects match. No entry or retained-input count expands. Only shader-scene-host.ts and shader-webgl2.ts have changed source hashes: the scene host remains zero retained bytes in all three default adapter entries; the sink increases from 1370 to 1739 attributed minified bytes. Other React/Vue attribution shifts have unchanged source hashes. Per-source retained bytes are not additive gzip costs.

Both existing diagnostic buttons grow by 369 minified bytes and 152 gzip bytes, retaining 406 inputs and 299 retained inputs. They remain diagnostics, not newly added budget entries. The full independent review, both original reports and ZIPs, the closure comparison, and the distinct 9+2 projection are in the archive.

## Verification and remaining acceptance

The original two package-budget policy test files pass all 28 controls after these three literal changes. All six other ceilings, source entries, measurement rules, policy controls, product code, and tests are unchanged. The actual a124 shader artifact independently matches all 106 generated support files and 16 active paint captures; the smaller Web Component paint area remains an explicit visual limitation.

A new clean exact-head run of the original strict workflow is still required. Its 9 entries and 2 diagnostics must retain a124 minified/gzip byte counts, minified hashes, and complete input closures. Only these three caps, derived pass values, and source metadata may differ. This record does not claim that pending run passed, and does not replace required formal approval.

Evidence: [manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint4-lifecycle-cost-budget-review/manifest.json) and [original receipts and review](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint4-lifecycle-cost-budget-review/execution.tar.gz). Normal hooks and signed-off commit are preserved in the publication execution receipt.

The first local policy execution retained 22 passes and 6 setup failures caused by /tmp ENOSPC. It is archived unchanged. The same 28 controls were then run with an isolated /var/tmp task directory and the original deadlines; no policy assertion, source entry, or test was changed.
