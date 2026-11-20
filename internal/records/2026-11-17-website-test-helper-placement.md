# Website test helper placement

Three Node test helpers were placed beneath the production `apps/www/src` root. The coverage scanner correctly treats ordinary files in that root as production seeds, so their test-only DOM and instrumentation bodies generated six misleading coverage diagnostics. Every executable consumer of these helpers is a test or another relocated test helper.

The repair moves the exact helper bytes and modes to the new `apps/www/test/helpers/` directory. Thirteen test files receive fourteen import, mock, or source-read path substitutions. All behavioral assertions are unchanged. The scanner, allowlists, matrix owners and fingerprints are unchanged. Historical migration records remain bound to their historical input source.

## Observed validation

Both complete checker executions use `node scripts/coverage-matrices/check-coverage-matrices.mjs`, the same environment, Node 24.22.1 and pnpm 10.32.1, on the source based on `bf8b1f55f93a89f3c689276d6e339d83891f4dba`.

- Baseline: 1,419 diagnostics; exit 1; 206.987 seconds.
- Candidate: 1,413 diagnostics; exit 1; 191.328 seconds.
- Exact diagnostic multiset comparison: the six attributed diagnostics disappeared, zero were added, and all remaining identities and multiplicities are unchanged.
- Two affected Node helper test files: 21 passed, zero failed or skipped.
- Three existing production-reachability controls: 3 passed, zero failed or skipped. These cover production imports of test-named raw imports and interaction, plus source-root tracking through an external shared helper.
- All fourteen adjusted references resolve to the intended files; the accordion observer mock resolves to the same helper imported by the relocated observer.

The candidate checker still fails with 1,413 retained diagnostics. This change does not establish complete coverage acceptance or authorize mass fingerprint regeneration.

## Source-bound Homepage follow-up

At `2e4f8f19713e3626ccf0492bbadaf8a4fcb1d889`, the integration worktree built its own CLI with `corepack pnpm@10.32.1 --filter @proto.ui/cli build` (exit 0, 3.934 seconds), then ran `node apps/www/scripts/generate-website-prototype-tokens.mjs` (exit 0, 71.506 seconds). The generator produced the actual website token stylesheet and Shadow companions from 1,433 package and website tokens. No generated stylesheet or dependency tree was borrowed from another checkout.

The eight affected Homepage files then passed **59/59 tests, zero failed or skipped, exit 0**, in a single-worker run lasting 136.087 seconds: composition, dialog focus, gallery props, gallery projection, showcase, React 19 showcase, text layout, and typography state. The adjacent evidence JSON retains all three commands, generated-file SHA-256 hashes, log/JSON hashes, and individual case results. This new consumer result belongs to that integration head; it does not rebind the earlier checker comparison to a different source.

## Remaining validation

Three importing browser test files have path-only changes and have not run here. Whole types, the full website/public-package build, the whole scanner fixture suite and full CI are not represented by the bounded checks above. The CLI build alone is not a complete website or release build.

The accompanying JSON records source and log hashes, complete commands, the exact six-diagnostic difference, and the source-preservation audit. A separate local agent reviewed the file placement and import resolution; this is local engineering review and is not a formal GitHub approval.

## Liquid hover evidence helper placement follow-up

The follow-up based on `af43d613171fe18a8acf61fe3fbffec5610f67a1` moves the Node-only evidence helper `apps/www/src/content/docs/zh-cn/liquid-hover-plan.ts` to `apps/www/test/helpers/liquid-hover-plan.ts`. Its browser-harness type and hover-fixture imports retain their original targets, and its two test consumers use the new path. The helper's behavior and all test assertions are unchanged. Historical migration inventories retain their original paths and hashes. Scanner and server-readiness sources are unchanged.

The validation results above describe the earlier placement repair only; they do not establish validation of this follow-up.

## Liquid toggle failure diagnostics helper placement follow-up

The source-only follow-up based on `da83ef2008f0289cdecc3e77cd37698131c43861` moves `apps/www/src/content/docs/zh-cn/liquid-toggle-failure-diagnostics.ts` to `apps/www/test/helpers/liquid-toggle-failure-diagnostics.ts`. The helper was an ordinary Website source seed whose import of `apps/www/scripts/diagnose-select-click.ts` led through `browser-harness.ts` to `scripts/test/server-readiness.mjs`. Its new relative import retains the exact diagnostic script target. Both live consumers, `demo-liquid-glass-toggle.browser.test.ts` and `liquid-toggle-failure-diagnostics.test.ts`, now import the relocated helper. The helper implementation and test assertions are unchanged; the diagnostic script, scanner, and historical artifacts are unchanged.

Source-only review identified the import chain and the two live consumers. Parent validation is pending for the complete `liquid-hover-plan.test.ts` and `liquid-toggle-failure-diagnostics.test.ts` modules under Node 24. No test, build, or scanner result is claimed for this follow-up; the earlier validation results above do not establish that the remaining readiness diagnostics have cleared.
