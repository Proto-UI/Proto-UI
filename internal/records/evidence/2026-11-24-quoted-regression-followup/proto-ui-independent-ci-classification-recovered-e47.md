# Recovered narrative of independent CI classification

## Provenance and limits

This file preserves the reviewer’s previously completed read-only classification of run `45383599762`, candidate `e47c69754d983d95dc356521b1fc02094aa590b1`, against source baseline `952722e5b619c60ddf797543fba11eea6c06d812`. It was reconstructed from retained review context after the known /workspace task tree and /tmp repo disappeared around 11:47 UTC on 2026-11-24. It is **not a byte-for-byte recovery of the original report or raw source-comparison JSON**, and performs no new source verification. Root reported that it had not deleted or moved the lost trees.

The original files were under `/workspace/scratch/5e512bf106bf/evidence/ci-45383599762/`:

- `independent-review-addendum.md`, previously computed SHA256 `8bee877160a902fca0b0f4ce0e032fc552e11f2ba09337ae842472ae61e8c62b`.
- `independent-ci-source-comparison.json`, previously computed SHA256 `e0891b26c281352e2e6f9f7b46efe61ec5c51c0f3a1eec6181d8cbb6275f8fc2`, approximately1.06MB.

Those are historical digests reported before loss, not hashes of this reconstructed document. The original JSON contained all per-input and source-closure comparisons. GitHub e47 and original CI artifacts can supply durable source/evidence for re-verification. No baseline execution, new tests, source fixes, external approval, merge decision, platform messages, or CI dispatch was performed by this reviewer during classification.

## Classification result

All four reviewed red jobs remain real failures. Source evidence tied their diagnostic/input closures to unchanged baseline inputs. This supported classifying them as failures outside the candidate’s changed implementation paths. It did **not** establish a passing gate, waive their failures, measure baseline byte deltas, or demonstrate baseline execution/reproduction.

### Type checking — job138408702874

Original log: `job-138408702874.log`, previously computed SHA256 `a0574aec2053a04ccce446860f907eb815530384e88c08154f803b230d048f13`.

Hosted job exited2 with18 diagnostics:

- WC test `packages/adapters/web-component/test/portal-presence-preparation.test.ts`: line135 TS2367 compares generic `<T extends Node>` argument to the host HTMLDivElement; lines137,138,140 TS2339 arise after the impossible comparison narrows the host to never. Host was declared at59; relevant appendChild mock129–143.
- CLI tests `lowered-helper-call-context.test.ts:7` and `lowered-rule-site-inventory.test.ts:9` import missing `scanRuleStateReadsWithSites`: two TS2724 diagnostics plus12 TS7006 cascades (2 helper context,10 inventory). `packages/cli/src/services/lowered-hook-coverage.ts` exports `scanRuleStateReadInventory` at115 and `scanRuleStateReads` at610, not the requested WithSites export.

The completed read-only analysis used TypeScript preprocess/resolveModuleName with actual root tsconfig to follow workspace imports and re-exports: WC diagnostic closure366 files; each CLI test closure6 files. Every resolved working file matched candidate Git bytes and the baseline blob. No unresolved imports or compiler file intersection were found. External imports were WC vitest/@floating-ui/dom and CLI typescript/vitest; pnpm lock was unchanged.

`tsconfig.workspace.json` excludes apps/www. The **whole** TypeScript program was not claimed unchanged because the candidate added compiler tests. The bounded claim was that the diagnostic source closures and pinned dependency configuration were unchanged. No baseline tsc execution occurred in this classification.

### Rust Linux color parsing — job138408703273

Original log: `job-138408703273.log`, previously computed SHA256 `a6e7b02714f0788beb26c38b066cf0965f2ccf9bf7bd175193de92ef021c3531`.

Job exited101 after12 pass/1 fail in `native/gpui/crates/proto-ui-style/tests/color.rs:228`, `parses_every_colour_a_theme_can_produce`.

The fixture input `bootstrap-2-3-2/Light` uses token `bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]`, resolving to `color-mix(in oklch, #f5f5f5, #333333 5%)`. `native/gpui/fixtures/style-tokens.json` contains the declaration; theme-tokens.json supplies Light secondary#f5f5f5 and foreground#333333. Include points were lib.rs:50 and theme.rs:18. The color parser at color.rs:255–261 accepts its narrower in-oklab/transparent form, so the observed in-oklch input is unsupported by that branch.

The complete native tree, fixtures, Cargo configuration/lock and job input path were unchanged from9527; CI invokes Cargo without a candidate TypeScript regeneration step. This was an unchanged-input/rejecting-branch source classification, **not baseline-run reproduction**.

### Rust macOS function-key inventory — job138408702872

Job exited101 with10 pass/1 fail in key_names tests. `native/gpui/crates/proto-ui-gpui/tests/key_names.rs:322–328` reverse lookup searches NAMED_KEYS or a single character. The unchanged event-types.json `comparedKeys` fixture includes F10. The panic occurs before `harness.press` at333.

Production translation `src/key.rs:96–103` already handles f1..f35→F1..F35 algorithmically; NAMED_KEYS documentation at54–56 says function keys are handled separately. A separate function-key range test passed in this hosted job. Therefore the bounded classification was **test reverse-enumeration gap for formula-handled function keys**, not proof that production F10 dispatch is unsupported, and not proof the failing fixture’s native F10 scenario passed.

The test, translation, fixture, Cargo lock and toolchain inputs were baseline-identical. No baseline Cargo execution was performed by this reviewer.

### Whole-entry package budgets — job138408927407

Original local report/terminal: `package-budget-report.json`, `package-budget-terminal.json`; archive `package-budgets.zip` previously verified digest `dd9679080dd14ae2678d43efb396ae7f0db74e2736b4462a31a2bd23daeebc47`, matching hosted artifact14915053375. Both extracted JSON files were compared byte-for-byte with the archive before loss.

Report bound clean source e47, measured head matching expected head, stable=true. Dependency/build controls succeeded; budgets failed with report withinBudgets=false and exit1/terminal failed. Environment: Node24.22.3, zlib1.3.2.1-motley-285e94b, esbuild0.25.12 Linuxx64, browser ESM ES2020, minification/tree shaking, gzip level9.

| Package | Measured gzip bytes | Budget | Excess | Closure inputs | Retained inputs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Core |12967|12800|167|49|27|
| Runtime |106822|104300|2522|298|180|
| React |179944|173380|6564|353|249|
| Vue |178760|172180|6580|352|248|
| WC |216252|208740|7512|381|277|

Across these five failed closures,1433 input occurrences /401 unique files were checked against each report SHA256/sourceBytes and exact candidate Git blobs, including zero-retained-byte inputs. Every baseline blob matched. Each failed closure had changedInputCount0 and compilerInputs empty. Budget policy/scripts/evidence machinery, root package, lock/workspace/tsconfig/workflow configuration also matched baseline.

These five excess numbers are excess over configured ceilings, **not candidate growth over a measured baseline**. No baseline package measurement was run. The strict failures remain failures.

## Previously verified unchanged source objects

These Git object IDs were recorded from the completed comparison before environment loss; this reconstructed file does not independently rerun them.

| Path | Identical9527/e47 object |
| --- | --- |
| packages/cli |7644c406dacba580befdc9b68d654f5984c9337c|
| packages/adapters/web-component |117c1957667b58c366a0360f60ef0cb6ba141e89|
| native |668cb7ff4141cd1b1a7dfabd64dcd1f67f3e07b3|
| packages/core |6cf1c10fb9e64d9199e83bb85355809bb11ae66e|
| packages/types |77db749e23cd368f4833a8b633796dad65ef3570|
| Adapter base subtree (exact path requires restored checkout) |ea0b26988c84d9660ecfcb0dbd202e9cbea9b075|
| packages/modules |0e91bb7d1d55d8d419378664ed4564888c54e9f1|
| pnpm-lock.yaml |cedbb8fde664399668dba0550cd1a8eda5bdad74|
| package.json |471ed66d1cfd3d471fd159813c14d94aeafcedb3|
| tsconfig.json |8cd0366aac84e42f91513c5103e263248a777384|
| tsconfig.workspace.json |7301e6ad941b04b61c44c18d322a16f652c948bc|
| .github/workflows/ci.yml |2826da6a2770fb57286f7b0b59c2f1b721079b40|

## Later native failure is separate

The subsequently downloaded browser6 public Contents receipt really reproduced zero movement on e47 despite ready geometry and a trusted uncancelled wheel. That is a relevant unresolved native product failure, separate from the four unchanged-closure classifications above. The later read-only scroll-chain investigation is preserved in `/tmp/proto-ui-independent-contents-scroll-chain-e47.md`. Its diagnosis did not identify a proven cause or fix, and did not claim a native control result that had not been observed.
