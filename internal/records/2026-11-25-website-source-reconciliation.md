# Website source audit after reconciliation — 2026-11-25

## Disposition

This author source audit covers 22 formerly stale bindings and 24 newly inventoried interactive demos. Their synchronization has already landed in [PR #1844](https://github.com/Proto-UI/Proto-UI/pull/1844), merged as `59bbed9b38ed2426633e26e5c95687878348bca1`. All 46 current source blobs, fingerprints and owner sets are identical to the bodies reviewed at `078c6e91c6ffdc1a4e1508978f63f31289da2cf8`. This record preserves the actual source review and acceptance limits; it does not claim a second hash repair. All 79 upstream website rows retain their IDs, states, existing owners and acceptance criteria. The demo owner, homepage and Adapter selector remain blocked.

The [source manifest](2026-11-25-website-source-reconciliation.json) is the complete per-file record: previous and current normalized SHA-256, recoverable Git revision/blob, owner sets and source findings. Source fingerprints are reviewed ownership evidence. They are not generated fixtures, runtime evidence or an independent review approval.

## Review method

The previous source bytes were recovered from Git history for every retained digest, including history fetched without moving the working branch. Each recovered source reproduces the old matrix fingerprint. The complete historical-to-current deltas were read; each of the 24 previously unbound files was read in full. Every current file was then compared byte-for-byte with the review base before changing the ledger. Hashes use UTF-8 text with CRLF and bare CR normalized to LF, matching `sourceScanDigest`.

The final downstream change adds this audit and its evidence links. The source-binding table, including row order, is byte-identical to integrated main. All 24 duplicate rows introduced by applying the earlier local work over the upstream synchronization were removed. Product source, scanner, literal import allowlists and Harness issue rules retain the upstream implementation. Old browser receipts retain their original revisions and cannot be used as observations of newer bodies.

## Existing binding deltas

| Source or group | Files | Reviewed delta and retained limit |
| --- | --: | --- |
| Four `zh-cn` Virtual List heroes | 4 | Replace numeric labels with deterministic variable-height activity records. Public collection/host ownership and disposal remain; item geometry and current runtime behavior need their own evidence. |
| Accordion and four Collapsible family heroes | 5 | Replace diagnostic copy and presentation with shipping/settings/order examples while keeping public disclosure and controlled request/acceptance ownership. The former long unbroken Accordion text is no longer in this hero. |
| Async Region | 1 | Adds focus, selective-disable and Live Region compositions, with app-owned readouts and observer cleanup. Scheduled callback retirement is not established by reading source. |
| Bootstrap and Liquid Select heroes | 2 | Consolidate four diagnostic examples into one controlled produce selector plus Reset, using public accessibleLabel. Former disabled, RTL, long-label and delayed-acceptance cases require separate evidence. |
| Field | 1 | Reframes workspace settings, retains request identity/alive/timer retirement and changes the example delay to 400 ms. Former explicit-cancel and owner-rejected-validity cases are absent from this hero. |
| Transition | 1 | Adds phase/presence, completion, interruption, lifecycle and Liquid examples through public interfaces. Timing, reduced-motion, lifecycle and material results are unverified here. |
| Calendar caption and Tabs profile example | 2 | Changes family caption layout and example labels/status while retaining public caption/state/profile interfaces and application disposal ownership. |
| Homepage preview and loading mask | 2 | Adds an inert responsive skeleton and changes scrim/panel visibility. Combined cancellation visibility, live preview and layout still need current browser evidence. |
| Adapter selector | 1 | Limits explicit popper placement to Brutalist; other families use their defaults. Focus and enlarged-text behavior remain separate browser obligations. |
| Brutalist/Shadcn Select and Shadcn Radio Group heroes | 3 | Reworks selection copy and public labels and removes page-local observers. Former disabled, initially selected and empty-group examples are not accepted by rebinding. |

## Newly inventoried interactive sources

The exact 24 paths and current source identities are listed in the manifest and the matrix. Their source ownership is:

| Group | Files | Application responsibility and public semantic owner |
| --- | --: | --- |
| Calendar examples | 1 | Preset data/date calculation, controlled month/value props and listener retirement; Calendar retains selection and focus. |
| Controlled Checkbox | 3 | Accepted checked/indeterminate props, mixed-state action and status output; Checkbox retains activation and mixed-state semantics. |
| Controlled Combobox | 1 | Accepted value/inputValue/open props and Set/Clear actions; queued callback retirement still needs evidence. |
| Fieldset examples | 1 | Nested disabled input props and demo readouts; local expected-disabled text is not observation of effective descendant behavior. |
| Radio Group choice cards | 4 | Public value/ARIA observation and passive card paint; the public Radio/Label anatomy retains interaction and association semantics. |
| Toast position and rich color | 2 | Public viewport/type/richColors inputs and open/dismiss commands; Toast retains timers, announcements and stacking. Version text inside a demo is fixture copy. |
| Virtual List filtering | 4 | Logical keys, public itemKeys changes, explicit demo scroll reset and status/empty output; the public Web host retains physical materialization. |
| Virtual List jumping | 4 | Four ensureVisible commands and row highlighting; the live row-node map can retain previously rendered nodes, so the materialized-window cap does not establish bounded application retention. |
| Virtual List window telemetry | 4 | Overscan inputs and public collection snapshot readout; pending microtasks have no explicit active-owner guard and do not establish teardown acceptance. |

The twelve new Virtual List files each import the public collection type and `attachWebVirtualList` from exact Base package subpaths. PR #1844 separately binds those exact bodies and specifiers in the import registry. This audit supplies source-body findings; it does not broaden that registry or establish runtime acceptance.

## Verification and integration scope

The first pre-integration shared-tree command `node scripts/coverage-matrices/check-coverage-matrices.mjs` failed with 156 diagnostics: 22 stale fingerprints, 24 missing fingerprints, 24 missing owners, 78 raw source/import/edge admission failures, four virtual-module admission failures and four closed Harness issue references. This was an observed shared working tree while adapter experiments were in progress, not a reproducible clean-commit gate result.

The second pre-integration run completed with 49 diagnostics: 41 raw-import admission failures, four virtual-module admission failures and four closed Harness issue references. No stale fingerprint, missing fingerprint or missing owner remained. The additional disappearance of 37 raw-import diagnostics between those shared-tree runs is not attributed to this audit. The machine-readable record retains both observations and their log digests.

After the coordinator integrated PR #1844, the bounded source audit verified all 46 current Git blobs, digests and owner sets against the merged result. The final source-binding table is byte-identical to upstream, with no duplicate audited entry. All 79 row IDs/states/acceptance criteria are preserved; only three evidence cells and the audit paragraph differ. The full scanner was not run a third time by this audit because the integration owner already owns that gate. The old 49-diagnostic run is not a report of current main.

The historical Harness diagnostics concerned `harness.transcript.follow-tail` re-review issue #746, `harness.future.editor-chrome` dependency and re-review issue #745, and `harness.future.editor-engine` re-review issue #745. PR #1844 changed the Harness ledger and scanner along with the website synchronization. Their current disposition is retained, without a new claim from this downstream source audit.

Public prototype lifecycle, keyboard/announcement behavior, cross-runtime parity, current-source browser results, native/assistive-technology evidence and historical failures retain the existing matrix gates. This audit supplies only the source findings described above.
