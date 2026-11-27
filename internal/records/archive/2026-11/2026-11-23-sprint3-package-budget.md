# Sprint 3 integrated package cost — bounded numeric transaction

This standalone transaction records the actual integrated Axis Input, TextControl, Scroll, startup rollback and corrected Anatomy source cost. It changes four existing ceilings. All definition lifecycles remain draft or in their prior state; a budget pass is not feature or release acceptance.

## Canonical facts

The [6a2 CI report](https://github.com/Proto-UI/Proto-UI/actions/runs/45206446598/job/137806713547) built the full public graph and passed 28 measurement/provenance controls, then reported five strict passes and four numeric failures. Its original report and ZIP are retained. The independently installed, clean 2bdcad076ad93b727c1e0f775e0c136d588ad888 checkout reproduces every output hash, byte count, closure and diagnostic with the same Node/zlib/esbuild environment and measured-source fingerprint. The prerequisite commit changes no measured input.

| Entry                      | Old ceiling | Measured gzip | Proposed ceiling | Headroom |
| -------------------------- | ----------: | ------------: | ---------------: | -------: |
| runtime root               |      103100 |        103858 |           104000 |      142 |
| adapter-react root         |      170600 |        172018 |           172200 |      182 |
| adapter-vue root           |      169400 |        170832 |           171000 |      168 |
| adapter-web-component root |      204000 |        205444 |           205600 |      156 |

Each proposed value rounds the observed combined cost up to 100 bytes and retains one further fixed 100-byte margin, 0.076–0.137% of measured size. The other five ceilings stay unchanged, including Core with four bytes and Shadcn Button with 29 bytes of headroom. This does not pre-authorize later capability growth.

## Attribution and alternatives

The full per-input comparisons retain source hashes and retained bytes for both the historical shader combination and the current combination. The four failed entries add or remove no dependency inputs and retain no Compiler source. The observed growth corresponds to actual lease ownership, selection/IME/owner protection, explicit reader pause/arrival, and partial-allocation cleanup obligations. Source review did not identify a safe sufficient duplicate removal. Deleting those guards to meet the old ceilings would change semantics. Small prospective helper refactors were not counted as measured savings.

The concurrent Anatomy correction is explicitly included: it preserves live host reads and removes wrapper allocation. Compared with the 165 report it reduces each affected root by 91 minified bytes and by 37/37/38/33 gzip bytes. All old failures remain factual; retained byte contributions cannot be summed into gzip deltas.

## Candidate checks and limits

The prepared numeric source passed all nine strict comparisons and 28 policy/provenance controls. All minified artifacts, hashes, complete closures and diagnostic vectors match the before report exactly. That execution was a stable dirty source and is labeled as such. A clean committed-candidate check, final canonical exact-head CI and independent review remain separate.

Only four literals and explanatory/supporting evidence change. Entry points, minification, tree shaking, gzip, external dependencies, diagnostic profiles, Finf expiry, clean-source identity and strict failure behavior are preserved. Rollback of this commit restores the four old ceilings and their observed failures without reverting product code.

The [complete transaction record](../../2026-11-23-sprint3-package-budget.json) contains the exact revisions, tools, hashes, old and proposed values, source commits, original CI links and raw archives.
