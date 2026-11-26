# Vue2 committed-authored / live-slot reproduction

This is failing evidence for [#1055](https://github.com/Proto-UI/Proto-UI/issues/1055#issuecomment-6569582240), not a new runtime, a compiler fix or a completed acceptance claim. It belongs to the same WIP change that will carry the subsequent native lowering / strict repair.

## Exact measured revision

- Executed base: `783ac833a77102365489d4050f7279c758114ec4`.
- Executed r2 tree: `0a2e97762970aef4416e92edbd973280aa261219`.
- Test SHA-256: `aa27faa0b485b5416a6f9bf83e6c115b9fcd5516cdd22de4db51b0bc32bb08e1`.
- 2026-11-02 05:01–05:02 UTC: exact 12 cases, 43 original expect sites, no skip; **11 behavior cases passed, 1 generated strict case failed with 167 diagnostics**. Unit exit 1 is intentional evidence, not expected-failure masking.
- The separate focused source-strict program (the actual test plus its imported compiler graph, real repository options with `strict:true` / `skipLibCheck:false`) exited 0 with no diagnostics. This is not a whole-workspace typecheck.
- A proposed publication base `d850c28a40bfbc31f10d244b075d6f27038f46fa` is eight commits later. A complete static comparison found only four website test changes; compiler, specs, config and lock files were unchanged. **No whole-new-main execution is claimed.**

The original `5ea14274` run remains history: its first collection failed in Vitest's console interception, then list-only `--disableConsoleIntercept` recovered collection. Its focused source-strict check found two own-test signature errors. r2 adds a real `CreateElement` annotation and forwards the native render context; no assertion, product or dependency changed. All 12 old/new authored inputs and complete emitted modules/files match byte-for-byte. The 167 old/new diagnostics match after only temporary-directory normalization.

## Reproduce through the actual compiler

Use Node 24 and the repository's pnpm 10.32.1 / frozen lockfile installation. The measured versions are TypeScript 5.9.3, Vue 2.6.14, Vitest 2.1.9 and happy-dom 15.11.7. The test resolves Vue2 through the real adapter package, not the root Vue3 package.

From an authorized, isolated repository checkout containing the additive test:

```sh
node node_modules/vitest/vitest.mjs list --config vitest.config.ts \
  packages/compiler/test/vue2-native-template-commit-contract.test.ts \
  --pool=threads --maxWorkers=1 --minWorkers=1 --disableConsoleIntercept

node node_modules/vitest/vitest.mjs run --config vitest.config.ts \
  packages/compiler/test/vue2-native-template-commit-contract.test.ts \
  --pool=threads --maxWorkers=1 --minWorkers=1
```

Set `PUI_VUE2_CONTRACT_EVIDENCE_DIR` to an absolute, empty, self-owned output directory to retain authored inputs, all actual GeneratedModule/support files, strict consumer/options/program and complete diagnostics before cleanup. This optional capture is bounded and fails closed. It does not read credentials or upload anything. The measured runner additionally cleared the environment, blocked socket networking, pinned 105 dependencies and checked all source/dependency bytes before and after execution; these shell commands alone do not provide that sandbox.

The strict test must remain red until the actual generated graph has zero diagnostics. Do not replace it with a diagnostic-count assertion, skip it, filter errors, disable `checkJs`, add a broad `any` facade or edit the captured generated source to make this record green.

## Recorded artifact layout

`graph/*.txt` and `authored.proto.ts.txt` preserve original source bytes without introducing executable `.ts`/`.js` files into the repository's default typecheck. `manifest.json` maps each recorded name to its original artifact and SHA-256. `module-metadata.json` retains provenance/dependencies/support metadata; code bytes are stored separately rather than duplicated.

The three `*.portable.json` files are explicitly derived: only absolute sandbox path prefixes become `<generated>`, `<repo>`, `<vue2-declaration-root>` or `<locked-dependencies>`. Every diagnostic, field, ordering, option and source-file hash is retained. Their original raw-artifact hashes are in the manifest. They are evidence, not directly executable configs; the test reconstructs actual root names and resolves the actual Vue2 declarations for each run.

All 167 diagnostics are in the actual `Component.js`: TS7006=106, TS7019=1, TS7005=13, TS7034=9, TS7022=1, TS7023=3, TS7024=1, TS2339=19, TS7053=9, TS2345=5. The source remains a runtime tag/children projection; these behavioral passes do not demonstrate direct native lowering. The different historical pointer fixture's 206 diagnostics are not a matched baseline, so 206→167 is not a measured improvement.

[#1120](https://github.com/Proto-UI/Proto-UI/issues/1120) remains the sole shared lexical template-shape implementation. Its declaration/caller-scope bug is not an established cause of these emitted-JS typing failures. Future Vue2 lowering must reuse that canonical analyzer, preserve authored evaluation/identity and atomic publication versus current native slots, and migrate internal SSR without retaining an interpreter as a completed fallback.

Real-browser/production consumer builds, SSR migration, retained bundle/init costs, full backend/operation coverage and independent review remain open. No product source change, formatting run, whole-workspace check or new-main acceptance is supplied by this evidence-only checkpoint.
