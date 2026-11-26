# Sprint 5: preserve the exact WC percentage source boundary

Date: 2026-11-23 UTC. Agent: ChatGPT / Codex. Parent public source: `db747e1b81cbbfaf2b37dd8af3de48108f036a04`, PR #1738.

## Observed production failure

Formal workflow [45228171867](https://github.com/Proto-UI/Proto-UI/actions/runs/45228171867), production job [137880234678](https://github.com/Proto-UI/Proto-UI/actions/runs/45228171867/job/137880234678), built all 684 pages and then rejected 49 paths to the newly introduced `packages/adapters/web-component/src/shadow-percentage-source.ts`. The previous four material tint-source failures no longer occurred.

Original artifact `14844803475` is 425,066 bytes, ZIP SHA-256 `73994168da9781a6809c7ceb8358148a708c38a091369f54e28752c3b8ad13d6`. The unmodified production graph is 5,055,846 bytes, SHA-256 `08aa327638f6f19eb6cef4721ede8b4508ce928ff79e334fd262946a59b89881`. The archive below retains the actual emitted graph, complete original build log, source binding, and both replay outcomes. Neither the graph nor original failures were edited.

## Source and emitted ownership

The graph has one emitted placement of this helper: `_astro/site-shadcn-controls.SAde5moC.js`, with rendered length 1,866 and `captureShadowPercentageSource` as its rendered export. Its sole value importer is the existing public WC `adapt.ts`. The actual static source path is:

`site-shadcn-controls.ts → web-component/src/index.ts → adapt.ts → shadow-percentage-source.ts`.

The helper imports the existing expose-state module. It captures the current owner's exposed percentage handle and verifies the live map, actual CSS projection, collision absence, and owner currency before authorizing a publication. It introduces no framework or optical renderer import.

Both exact material diagnostics statically import this existing bridge chunk. Their own source closures do not import the helper. A chunk's dynamic-entry flag does not erase the observed static importer path.

## Bounded change

The checker adds only this exact helper to its existing finite `REVIEWED_WEBSITE_CONTROL_ADAPTER_MODULES` set. The material module set remains unchanged; no WC module becomes a material producer dependency. The runtime helper, WC public entry, and `adapt.ts` are unchanged.

The helper joins the existing reviewed-helper test matrix, adding 40 controls for exact placement, lookalikes, and importer bypasses. The existing static TypeScript source traversal also verifies its actual public-entry ownership. Sixteen additional controls cover the same helper on both material diagnostic routes: a legal static API-owned bridge, direct and dynamic route/producer imports, lost API ownership, delivery in another chunk, and dynamic-only bridge delivery. Each new negative starts with the accepted legal graph, then requires the complete exact expected diagnostic list. All prior 2,082 tests remain.

## Actual red and green validation

| Execution | Actual result |
| --- | --- |
| Expanded tests with original checker | 2,138 total: 2,085 pass, 53 fail, 0 skipped, 0 cancelled |
| Original checker on the original production graph | 49 issues, every issue names this exact new helper |
| Expanded tests with candidate checker | 2,138 / 2,138 pass, 0 failed, 0 skipped, 0 cancelled |
| Candidate checker on the same production graph | 0 issues |
| Prettier check and git diff check | Both exit 0 |

The 53 original failures are valid gate rejections of the newly introduced legal baseline; they are not runtime acceptance results. Every failing test name is specific to this percentage helper. The original test run contains no import, syntax, or setup error. Candidate and original test runs use the same expanded test bytes.

Candidate checker SHA-256: `5a496e0a985ad486481c3be8ee392af74a725bea19d47d097ee94c56d95fa2b8`.

Expanded test SHA-256: `12a1bc5b6c29422c38c19900ff90c0cbf8329b6b79e96cc37556a979f1930c32`.

Before/after hashes of the graph, checker, tests, helper, public WC entry, and `adapt.ts` were verified unchanged during the candidate run. Full commands, timestamps, and hashes are retained in the raw status files.

## Review and remaining boundaries

Root independently read the complete two-file patch and original/green records. No blocking source issue was found. This is source peer review, not GitHub `APPROVED`.

The exact public parent head's source-regression lane succeeded, including its complete workspace/docs check (1,330 files, 0 errors, 0 warnings). Flutter and the four executed lightweight CI jobs also succeeded; DCO was read back as success. These results remain bound to that parent head.

Other formal lanes remain distinct. Ubuntu default SDK compilation exposed 99 Rust errors beginning with duplicate generated ControlLabel definitions. The browser lane passed 35 receipt controls but timed out downloading Chinese fonts at its original three-minute limit; the actual production browser journey did not run. The earlier d995 250ms cleanup failure therefore remains unresolved. At this record's preparation, macOS native and Adapter were still queued.

This patch does not relax browser deadlines, actual cleanup acknowledgements, sandboxing, source ownership, required reviews, or native validation. PR #1738 remains Draft pending actual remaining repair and acceptance.

## Reproducible archive

[`manifest.json`](./2026-11-23-sprint5-shadow-percentage-boundary/manifest.json) records the SHA-256 and byte size of each raw file and its gzip container. Every container was decompressed and compared byte-for-byte before staging.
