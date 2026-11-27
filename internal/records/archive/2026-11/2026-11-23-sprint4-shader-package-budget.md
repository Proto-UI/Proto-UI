# Sprint 4 shader package-budget transaction

## Why this transaction is needed

PR #1714 adds the already reviewed, draft owned-pixels shader declaration, Feedback owner/sink lifetime and a shared WebGL2 host in the Web adapters. The exact candidate `9ecfeef2bfc418c4246ad4bb2f9adc669afa0049` exceeds five whole-entry ceilings. Its original strict failure remains preserved. This standalone change accounts for that measured capability cost; it does not change implementation, a spec lifecycle, the gate policy or CI scheduling.

The [machine-readable transaction](../../2026-11-23-sprint4-shader-package-budget.json) contains the full source identities, old ceilings, output hashes, toolchain, closure attribution and hashes for the retained raw reports.

## Canonical comparison and bounded ceilings

The baseline is [run 45017955280, job 137196250853](https://github.com/Proto-UI/Proto-UI/actions/runs/45017955280/job/137196250853) at `dc3b184ba10b0de53e40359c52d012b204b2cd01` (nine strict passes). The candidate is [run 45027817094, job 137224601142](https://github.com/Proto-UI/Proto-UI/actions/runs/45027817094/job/137224601142) at `9ecfeef2bfc418c4246ad4bb2f9adc669afa0049` (four passes, five strict failures). Both use Node 24.22.3, esbuild 0.25.12, Linux x64 and zlib 1.3.2.1-motley-285e94b, with unchanged browser/ESM/ES2020 bundling, tree-shaking, external dependencies and level-9 gzip.

| Whole entry | Baseline gzip bytes | Candidate gzip bytes | Old ceiling | New ceiling | Headroom |
| --- | --: | --: | --: | --: | --: |
| Core | 11,378 | 12,486 | 11,500 | 12,600 | 114 |
| Runtime | 101,437 | 102,972 | 101,500 | 103,100 | 128 |
| React adapter | 165,288 | 170,364 | 165,500 | 170,600 | 236 |
| Vue adapter | 164,063 | 169,119 | 164,300 | 169,400 | 281 |
| Web Component adapter | 198,760 | 203,745 | 199,000 | 204,000 | 255 |

The four passing control entries keep their original ceilings. Their artifact bytes did change: Lucide X is 2,879 → 2,941 gzip bytes, Lucide root 637,306 → 637,384, Base Button 5,274 → 5,337, and Shadcn Button 7,812 → 7,871. All four remain within their original ceilings. The small 114–281-byte margins are 0.12–0.92% of the measured affected entries, allowing bounded symbol/compression variation around this source. They do not reserve room for a later capability or the combination of the other Sprint branches. Any such combination requires its own measured comparison.

## Attribution and retained evidence

The added Core declaration retains 3,370 minified bytes. Runtime retains the declaration plus 2,167 bytes of Feedback owner/sink lifecycle and 149 bytes of handle mapping. Each affected adapter retains one shared WebGL2 host (9,595–9,598 minified bytes) and its 518-byte factory. These are pre-gzip attributions and cannot be added as gzip costs.

The actual input graphs contain no compiler inputs or duplicate input paths. The equal hashes of unchanged empty Core barrels are not duplicate Runtime or shader implementations. The statically registered host is retained once per adapter entry; allocation still requires a reached shader presentation. The separately measured entries are not summed as one consumer bundle.

The original [baseline](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint4-package-budget/baseline.json.gz), [failed candidate](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint4-package-budget/candidate-before.json.gz) and [per-input attribution](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint4-package-budget/attribution.json.gz) are retained without changing their bytes after decompression. The downloaded candidate ZIP hash was rechecked against GitHub artifact `14755904646`: `3bf1b0d33c94eb3d64806de38cec08eff6be98aad2d99331b8da56e52c14fed3`.

## Validation and remaining acceptance

Before editing, a clean local execution on `9ecfeef` reproduced all nine canonical entry vectors, including minified hashes and the five failures, with the identical source receipt and toolchain. After the numeric edit, the same local producer passed nine of nine entries; all artifact bytes stayed identical. The existing policy/evidence controls passed 28 of 28, with no skips. This local result is separate from the required final canonical run.

Fresh independent review and exact published-head strict CI remain required. The four original production Search cases remain a separate Ready condition; old 1,025 ms failure and incomplete cycles are not reclassified by this transaction. Historical private IR10 rights/DCO, governing decisions, public dependency layers and migration acceptance remain separately tracked.

Reverting this standalone transaction restores the five old ceilings and their original strict failures, without changing product source or history.
