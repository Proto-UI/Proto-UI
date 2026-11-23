# Contrast fixture type closure — 2026-11-23

The sequential full documentation check exposed four remaining errors in the contrast projection regression fixture. Its eager Vite glob defaulted to `unknown`, and the extracted diagnostic harness returned an untyped value from `evaluate`. The fixture now declares the actual `DemoSpec` module shape and retained `HTMLElement` observation. Before reading either newly selected production recipe, it also runs the existing recursive `assertDemoSpec` validator.

The complete Astro check over 1,327 files passes with zero errors, zero warnings and 47 existing hints. The earlier full-command failure and the intermediate incorrect assumption that `assertDemoSpec` narrowed `unknown` are both retained. No exclusion, ambient type stub or `any` cast was introduced.

The complete projection fixture ran all 677 cases successfully with the two runtime validators in place. The final change to its erased glob type was made during that run, so this is retained as intermediate functional evidence, not a frozen final-source receipt. The exact final file is queued for a fresh complete replay; the next integrated CI remains required. This record makes no native-browser or physical accessibility claim.

The fresh replay subsequently completed at `502693304fc8d7509402fdfb586b283681915231`: **677 passed, zero failed, zero skipped**. Both source hashes are `ea6c47ed37f060a673759399608354017008dcf7303cba90c463ba79accfeda9`; the working tree was clean before and after. The full final log and receipt are retained as `contrast-projection-final-frozen.log.gz` and `contrast-projection-final-frozen.json`, without replacing the intermediate evidence. This closes the local frozen-source replay, not the next integrated CI or native accessibility gates.
