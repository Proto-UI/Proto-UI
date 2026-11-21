# Integrated geometry and overlay package-budget continuation

## Actual strict failure

The clean source checkpoint `f245fd339e481e682a381ab5c84ef9ccfacf1c10`, tree `30ff0a0324af56dfad1b41e202f5ff9418b38a4c`, integrates reviewed main `604231ff21b9efbe01a23609d13f4e37f2729b4b`. Its actual strict measurement with `--json --require-clean --expected-sha` completed with **exit 1: seven strict probes passed and two failed**, alongside two diagnostic profiles. The source remained clean and unchanged throughout measurement.

| Entry | e775 gzip | f245 gzip | Actual growth | Old ceiling | Old excess | New ceiling | New headroom |
| --- | --: | --: | --: | --: | --: | --: | --: |
| React root | 164,349 | 164,569 | 220 | 164,500 | 69 | 164,750 | 181 |
| Web Components root | 197,465 | 197,732 | 267 | 197,500 | 232 | 197,800 | 68 |

The raw f245 report has SHA-256 `3707a0ca50cebcc3820d562ce99fb8d408a58d4371d22eecbcb60674c447a7e8` and 1,539,215 bytes. Its failed exit code, original ceilings and complete eleven vectors remain retained in the companion JSON record and evidence bundle. They are not rewritten as passing evidence.

The e775 baseline report, SHA-256 `fce7efbf8a5ed1e1ff4d52c34944dff6de8977dc83d73f946dfe746c01430a9a`, was byte-identical to the strict budget artifact in native run 44945602403, job 136972171580. **The f245 measurement is clean local evidence, not a GitHub-native f245 run.** The final integrated native gate remains required.

## Source and cost attribution

All eleven dependency input sets remain unchanged. Independent reads of all **3,824 unique input files** from both immutable f245 and main6042 Git objects match their measured lengths and SHA-256 hashes, with zero mismatches. The full proof has SHA-256 `753d43a21c6c9ae79a30c457f2cc3a8d356d3f3841ef42b11b4468c77a841609`.

Only two existing input files changed:

- `packages/adapters/base/src/gestures/web-axis-input-host.ts` adds **746 retained minified bytes** per affected adapter. Upstream commits `c3345e82`, `9a86fcfa` and `258a922b` derive contact-basis extents from untransformed layout and preserve the composition of target, border/padding, handle and summed displacement parts. Their stated purpose is to avoid cancellation from translated repaint noise while retaining real extent-change handling. The existing draft anchors `C-AXIS-INPUT-CONTACT-BASIS-0001`, `C-AXIS-INPUT-DELTA-BASIS-0001` and `C-AXIS-INPUT-DIRECTIONAL-0001` keep their lifecycle and all conformance obligations. This numeric review does not establish additional geometry conformance.
- `packages/modules/overlay/src/web/z-index-layer-scheduler.ts` adds **90 retained minified bytes**. Upstream `7a1a95f4` assigns Drawer and AlertDialog mask/content roles the existing Dialog 1000/1010 offsets. Its author-reported native observation was a mask painting above the Drawer panel and intercepting handle pointer input. Numeric accounting does not replace native verification of that repair.

The adapter increase is exactly **746 + 90 = 836 minified bytes**. Runtime increases by only the 90-byte role table and measures 24 additional gzip bytes. React, Vue and WC measure 220, 230 and 267 additional gzip bytes; each diagnostic profile measures 234. Gzip contributions are not additive. The other five complete vectors are identical.

No input path was added or removed. All other package contributions, including the `packages/runtime` contribution, are unchanged. There is no added Runtime copy, generated token set, font/icon/binary asset, sink or Homepage input. Node 24.22.3, esbuild 0.25.12, zlib `1.3.2.1-motley-285e94b`, Linux x64, external dependencies, ES2020 target, minification and gzip level 9 match the baseline.

Removing these upstream source behaviors would discard integrated correctness work. The closure comparison found no accidental inclusion to remove. Further factoring has no demonstrated safe gzip reduction and would require a separate source/conformance transaction; no such optimization or impossibility claim is made here.

## Numeric decision and validation boundary

This independently reviewable transaction changes exactly two ceiling literals. Its rule preserves the previous absolute headroom and rounds the old ceiling plus measured integrated growth upward to the next 50 bytes. React retains its previous 151 bytes plus 30 bytes of rounding; WC retains 35 plus 33. A WC ceiling of 198,000 would add unnecessary reserve. The other seven ceilings and all strict failure, measurement, source-binding and diagnostic rules remain unchanged. This is no future-capability allocation.

The current user authorized package-budget governance; root coordination and an independent local data/code review support these bounded engineering numbers. This is not a claim that the user accepted these exact numbers or that GitHub approved the transaction. Existing draft lifecycle and acceptance obligations remain unchanged.

After the numeric edit, the existing policy/evidence controls completed once with **15 passed, zero failed, zero skipped, exit 0**, using:

```sh
node --test scripts/analysis/test/package-budget-policy.test.mjs scripts/analysis/test/package-budget-evidence.test.mjs
```

Their actual log SHA-256 is `c008464f6b8e4a1d8cb74e336b2ec0695145771410706d00ad4dc192258b859b`. These controls retain nonzero exits for strict overflow, build errors and missing output, as well as dirty/wrong-head and malformed evidence rejection. They are working-tree controls, not a post-edit clean package measurement.

After the separate numeric commit, the clean candidate must be measured again. All eleven minified bytes, output hashes, gzip bytes and full dependency closures must match f245, with only the two reviewed ceiling comparisons and candidate source metadata changing. Final native strict validation remains pending. Reverting this transaction restores the original ceilings and their real failures without reverting upstream behavior or regression governance.

See [the complete transaction record](2026-11-22-upstream-geometry-package-budget-transaction.json) for all eleven vectors, exact receipts, alternatives, independent review boundaries and retained evidence digests.
