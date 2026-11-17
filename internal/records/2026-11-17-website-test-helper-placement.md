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

## Remaining validation

Eight Homepage test files need the source-generated `proto-ui-tokens.generated.css` and CLI build before execution. Their assertions and helper contents are preserved, but those eight files have not yet run on this candidate. Three importing browser test files have path-only changes and have not run here. Whole types, build, the whole scanner fixture suite and full CI are not represented by the bounded checks above.

The accompanying JSON records source and log hashes, complete commands, the exact six-diagnostic difference, and the source-preservation audit. A separate local agent reviewed the file placement and import resolution; this is local engineering review and is not a formal GitHub approval.
