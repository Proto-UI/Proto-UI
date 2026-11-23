# Website markup study: integrated source reconciliation

## Observed failure and preserved baseline

[CI run 45146424504, browser job 137596891751](https://github.com/Proto-UI/Proto-UI/actions/runs/45146424504/job/137596891751) ran integrated source `d0392fb31513b12f55b9e99b1fcf26a6338569c9`. The unchanged #834 study rejected five changed source files before its browser started. Its 17 study cases did not execute. The complete original job log is retained in `evidence/2026-11-23-markup-reference-integration/original-browser1.log.gz`.

The previous reference identifies `4adb6076a6d9e93ddfd6eb02d07ce06c319eb2d2`. Its exact Git object was recovered from the preserved Sprint 3 checkout; all 29 hashes match the blobs at that revision. The reference is copied byte-for-byte to `scripts/coverage-matrices/test/fixtures/website-markup-provenance-4adb607.json`. Neither this baseline nor the older references receive new execution claims.

## Reviewed source changes

The new reference is bound to actual Git source `9a49049da3c55cd5fc8969b56fa6d49ac7b5e1fd`. All 31 hashes match both that commit's blobs and the corresponding current product files. The review covers the five previous members below and adds the optional panel's two direct owners.

| Source | Reviewed responsibility and change |
| --- | --- |
| `PrototypePreviewer.astro` | Adds an optional `compiledPrototypeId`/`compiledItems` input and a separate compiler panel. The sampled Base Transition, Shadcn Button and Shadcn Dialog pages do not supply this optional input. Existing highlighted/raw-code ownership remains intact. |
| `CodePanel.astro` | Retains the progressive code surface, title scrolling and focus paint. The integration's multiline title introduced visible whitespace; `9a49049d` uses Astro's escaped `set:text={title}` to preserve the exact filename. The original precise filename checks remain unchanged. |
| `previewer-client.ts` | Excludes native selects belonging to `.host` or `pui-browser-compiler` from the legacy runtime-selector fallback. Those independent consumers do not become the previewer's runtime control. |
| `astro.config.mjs` | Assigns the two exact public WC WebGL provider files to their reviewed site-control bridge. Excludes three specific QuickJS modules from development dependency optimization so opening the compiler panel does not reload its owner. This is not a general package or dynamic-import allowance. |
| `pnpm-lock.yaml` | Records the integrated compiler's QuickJS/hash/browser-path dependencies, Vue SFC and Vue 2 server-renderer dependencies, and the Bootstrap hooks workspace edge, with their locked transitive entries. This repair does not edit the lockfile. |
| `BrowserCompilerPanel.astro` (added) | Owns the optional panel's explicit markup, controls and client import. It has no sampled-route activation without the optional prototype ID. |
| `browser-compiler-panel.ts` (added) | Registers the panel element and owns its control listeners, per-session fetch/compile lifecycle, generated text rendering and disposal. Fetch/compile activation is scoped to an open, connected panel. Its imported implementation closure is outside this bounded reference. |

The exact prior/current hashes and source revisions are in `evidence/2026-11-23-markup-reference-integration/source-ledger.json`. The broader compiler/importer integration review remains in `2026-11-23-seven-sprint-website-source-inventory.md`; neither record certifies a served build.

## Validation and remaining execution

The existing 36 `website-markup-provenance.test.mjs` discriminator tests pass, with no skips. `sourceBindingIssues`, the browser study and all source/HTML/Copy/teardown assertions are unchanged. The maintained reference contains fixed reviewed digests; it does not automatically accept current files at test time. Missing, changed, duplicated, unknown and opaque members still fail.

`sourceAdmission` remains `unverified`. Updating this prerequisite supplies no new browser result, transitive closure, served-source proof or completion of #834. The next integrated candidate must execute the original 17-case study and retain its results under its actual source identity.
