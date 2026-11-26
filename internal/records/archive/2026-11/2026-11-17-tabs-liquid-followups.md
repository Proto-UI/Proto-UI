# Tabs underline and public Liquid evidence follow-ups — 2026-11-17

This is a bounded repair record on `bf8b1f55f93a89f3c689276d6e339d83891f4dba`. The current user asked to continue the unfinished 0.3 work. The source fixes were prepared with AI assistance and reviewed locally against the existing draft definitions. This record is evidence, not a lifecycle admission or native acceptance.

## Why these changes belong in their owning layers

The compatibility Tabs underline is drawn by the host border. The permanently owned line decoration is only used by the default appearance, but previously remained an empty in-flow flex child under `underline`. The host's gap still counted that child, yielding the current native failure of 4 px against the unchanged 2 px label-width tolerance. A six-line conditional style contribution makes that unused leaf absolute and transparent. It retains the same decoration, caller text node, state handles, focus, Base selection and event owners. Returning to the default appearance restores its existing paint.

The runtime-tabs browser journey begins with a real pointer click. The original native captures did not record hover, so its contribution to the old color failure remains a source-derived explanation. Before comparing resting inactive ink with selected ink, it now moves the pointer away and observes both native `:hover` and the public `hovered` state becoming false. The original color difference, width, selection, focus, keyboard, publication order and disposal assertions remain intact.

The public Liquid Button page legitimately contains several panels for the same runtime: the main interactive demo, installation instructions and usage examples. Both optical journeys now require a descendant with the exact demo ID and `data-projection-toolbar="true"`. Each locale/runtime pair has one such target. The same demo ID alone would also match usage examples. Both original 30,000 ms optical waits, 150,000 ms journey limits, click/activation checks, canvas/resource checks and source guards are preserved.

## Applicable direction

- `P-SHADCN-TABS-TRIGGER` appearance and source-bound text rules, `C-FEEDBACK-STYLE-OWNED-TARGET-0001`, and `T-RUNTIME-TABS-APPEARANCE-0001` remain draft.
- `C-FEEDBACK-MATERIAL-0001` geometry, safety and quality criteria remain draft; `T-WEB-LIQUID-OPTICAL-0001#web-optical-browser` remains planned.
- No definition, lifecycle, public API, Adapter behavior or acceptance threshold changes in this repair.

## Executed local evidence

| Scope | Result | Boundary |
| --- | --- | --- |
| New four Tabs cases on original product | 4 failed | Intended out-of-flow regression, not startup failure |
| Same four cases after product repair | 4 passed | Horizontal/vertical, underline/default entry and roundtrip |
| Nine related Tabs/previewer/code-example files | 85 passed | Existing tests, one worker |
| Three-file scoped TypeScript | Passed | Includes transitive dependencies; not the full repository check |
| Final formatting and diff whitespace | Passed | An earlier fixture formatting failure was retained and corrected |
| Liquid exact target inventory | Eight unique locale/runtime targets | Source-based identity proof, not rendered optics |
| Liquid TypeScript syntax/emission | No errors | Not semantic type checking |

The [structured evidence](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-17-tabs-liquid-followups.json) preserves the actual Vitest results, command receipts, source hashes, earlier formatting failure and correction, locator inventory, and independent Liquid source review. The combined branch preserves the tested Tabs product/unit bytes and final fixture hashes; adding the unrelated Liquid locator does not turn earlier execution into a new combined native run.

## Remaining acceptance

No candidate native page ran in this session. Ordinary sandbox Chromium failed at process launch with `socket() failed: Operation not permitted`; the previously used Box environment reported an empty wallet. These are environment observations, not passing or failing page assertions.

The current-main [original four-case Tabs job](https://github.com/Proto-UI/Proto-UI/actions/runs/44038705347/job/133893072353) remains baseline failure evidence. Run those same four cases and the two affected public Button optical journeys on the exact published candidate, inspect the resulting captures, and retain any remaining material source-admission or runtime failures. No screenshot was fabricated or inherited as candidate evidence. Full 0.3 acceptance, Search, CodeExample and unrelated CI failures remain separate unfinished work.
