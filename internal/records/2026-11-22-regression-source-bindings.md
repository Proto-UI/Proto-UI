# Regression source-binding reconciliation

This is a source-ownership review at main `d095fa0a811facff676b6f62929b177aa1dc7583`, performed for the regression-baseline repair. It repairs the website inventory gate and retains the distinction between source admission, executable test results, lifecycle status and consumer acceptance.

## Historical failure remains evidence

[Run 44876125495](https://github.com/Proto-UI/Proto-UI/actions/runs/44876125495), [test-general job 136761154197](https://github.com/Proto-UI/Proto-UI/actions/runs/44876125495/job/136761154197), reported 101 website coverage findings before the general tests could complete. They classify as follows; several findings describe the same source from different gates.

| Finding | Count | Treatment |
| --- | --: | --- |
| Unreviewed raw Proto UI import edges | 34 | Review 33 exact edges in eight diagnostic importers; add the existing material program's missing tint-profile dependency to its finite edge policy |
| Unreviewed runtime code compilation | 1 | Move the Playwright-only Popover helper out of production source roots; retain the compilation guard |
| Stale source fingerprints | 40 | Recover each previously bound source, compare the full delta and retain both versions in the provenance record |
| Missing interactive source fingerprints | 10 | Classify eight actual interactive diagnostic sources and move two test-only helpers; also bind the two imported noninteractive optical reproducers |
| Missing interactive source owners | 10 | Same source inventory, with authored controllers kept separate from renderer/observation infrastructure |
| Unclassified Astro component sources | 6 | Add the six exact diagnostic routes to the source-binding inventory |

These are 101 coverage/source-admission findings, not 101 failed unit tests. The downloaded job log's SHA-256, exact old and new source hashes, Git revisions/blobs, owner sets and per-file review conclusions are retained in [the provenance record](./2026-11-22-regression-source-bindings.json). The original failed run and its browser failures remain historical evidence.

## Source comparison and ownership

All 40 stale fingerprints were matched to actual historical Git content before their replacements were written. Thirty-five were recovered from main history. Five older bodies required the preserved `archive/finf-200/pr872-8a2d8897` source closure at `8a2d8897d710ab4f1c47a564f4077920b5203bf4`, already identified by the repository's [Finf source-closure record](./2026-10-14-finf-source-closure.json). An archive locates prior bytes; it does not provide present-day acceptance. Every recovered body's normalized SHA-256 equals the old matrix value, and every new digest equals the reviewed source at the stated main revision.

The per-source review records the complete changes in ownership terms: public callback migration and Select anatomy; progressively acquired Tabs/Tree; Copy and passive surface preparation/cancellation; header and sidebar focus/scroll lifetimes; native typography inventory; static style entry points; and accessible whitepaper media. Existing owner sets are preserved except that the English and Chinese interaction-relations figures now also name the existing blocked diagram-viewer owner. Their preview buttons cannot be represented only by the research native-disclosure row.

The ten newly bound sources are finite Liquid diagnostic routes and their helpers. Hover, Portal, Prominent Tint, Toggle and the two Toggle probes retain the blocked `www.demo.authored-controllers` owner for fixture inputs, props, counters and source choices, alongside `www.demo.demo-matrix` for mounting and observations. The two historical tint/refraction reproducer modules and their two bare entry routes have no application command UI and belong only to diagnostic infrastructure. They preserve refused/rejected outcomes and explicit absence of current product validation. This classification does not certify optics or move Liquid Glass out of WIP / Experimental.

`scripts/coverage-matrices/diagnostic-imports.mjs` admits exactly eight importer paths, each bound to its raw source SHA-256 and literal imports. It admits no directory, wildcard, neighboring component, changed body or arbitrary Adapter import. The added `program.ts` → `style-tint-profile` edge connects the finite material program to the already source-bound Card material profile. That existing edge-only policy does not certify the material program's body or optics.

## Test-only helper boundary

`popover-nova-fixture.ts` and `liquid-prominent-tint-test-harness.ts` are imported only by Playwright or unit tests. They now live under `apps/www/test/fixtures`, rather than appearing to be product modules under `apps/www/src/content/docs`. Four test import paths and the Popover helper's type-only relative imports follow the relocation. Browser-evaluated module URLs, fixture operations and assertions are unchanged.

No production-scan exclusion was added. A negative regression imports a fixture back into a website entry and requires both the raw-import and runtime-compilation gates to reject it. Two further negative regressions require reviewed TypeScript and Astro diagnostics to reject foreign owners, changed bytes and adjacent unreviewed imports.

## Validation and limits

The source checker completed with exit code 0 and `[coverage-matrices] OK (2 matrices)` using `node scripts/coverage-matrices/check-coverage-matrices.mjs`. The original 101 admission findings no longer block this gate.

The targeted checker regressions passed: three new diagnostic/relocation boundary cases using `node --test --test-name-pattern='diagnostic import review rejects|relocated Playwright fixtures' scripts/coverage-matrices/test/check-coverage-matrices.test.mjs`, and all four existing finite material closure cases using the same command with `--test-name-pattern='Finf continuous optical closure'`.

The relocated Liquid harness passed its existing 17 unit tests using `corepack pnpm@10.32.1 exec vitest run apps/www/src/content/docs/zh-cn/liquid-prominent-tint-test-harness.test.ts --pool=threads --minWorkers=1 --maxWorkers=1`. The existing ES2024 esbuild warning remains. Canonical JavaScript emitted from both moved helpers matches their baseline runtime after type erasure and formatting; browser-evaluated operations and assertions were preserved.

The first full run of `node --test scripts/coverage-matrices/test/*.test.mjs` finished in 227.7 seconds: 4,475 tests, 4,405 passed, 69 failed and one skipped. Every failure was in `prototype-coverage.test.mjs`; the website checker and its regression cases passed. This exposed the next previously blocked gate rather than proving that the complete coverage lane was green.

The portfolio failures share three causes. Its cached consumer projection has 323 field differences from the current website/harness ledgers. The Base Menubar catalog cites its `menubar/` subject directory and the supporting `menu-primitives/family.ts`, which the candidate resolver incorrectly treats as two subject owners. The Shadcn retained-source reader also omits the manifest's `upstream/` storage root and consequently cannot find the real retained license. The resolver repair anchors a Base identity only to one explicit, populated family directory; file-only and multiple-directory ambiguity still fail closed. The retained-source repair reads the original inert upstream artifacts with their existing checksums. New negative cases retain both ambiguity failures; the existing ownership, tamper, source-object and acceptance assertions remain in place. Candidate/consumer source reconciliation must use a concrete Git checkpoint after the implementation edits are complete, while preserving the historical main snapshot, reference pins, carried criteria and unverified acceptance.

Source review and deterministic unit evidence are not passing browser results or completion of the entire `test-general` lane. All existing matrix states, draft lifecycle requirements, historical test failures and independent visual, keyboard, assistive-technology and runtime-parity evidence requirements remain in force. The other explicitly recorded source-body review debts are not cleared by this bounded reconciliation.
