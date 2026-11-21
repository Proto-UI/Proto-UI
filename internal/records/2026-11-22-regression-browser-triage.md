# Browser regression triage and retained acceptance boundaries

## Source and evidence

This record addresses browser observations in [complete CI run 44876125495](https://github.com/Proto-UI/Proto-UI/actions/runs/44876125495), whose source is `7a696228c31e6b77998c4e356a57dcebd08854a0`. The repair worktree starts at `d095fa0a811facff676b6f62929b177aa1dc7583`. Historical failures are not relabeled as current-head results. The companion [machine-readable record](2026-11-22-regression-browser-triage.json) binds the reviewed files, original job logs and local command reports by SHA-256. Current source fingerprints were checked again after repository formatting; only the Search test changed, by collapsing an existing `expect.poll` expression onto one line. The historical observations and local test receipts remain unchanged, and this fingerprint refresh does not imply a test rerun.

The changes repair demonstrated fixture assumptions and a build-input omission. They do not establish that the original native journeys now pass. No product source, native assertion deadline, clipping tolerance, focus requirement or Shadow ownership guard is relaxed by these browser changes.

## Demonstrated causes and repairs

| Scope and historical source | What actually failed | Repair and retained boundary |
| --- | --- | --- |
| Search Brutalist, 320/390 px, 200% text; [job 136761144947](https://github.com/Proto-UI/Proto-UI/actions/runs/44876125495/job/136761144947) | The compared status changed from `正在加载搜索…` to `搜索暂不可用，请重试` while the geometry test scrolled it. Development mode has no production Pagefind index. The reported failure was text equality, not a measured clipping or reachability failure. | Reuse the suite's existing successful-empty Pagefind fixture and wait for the real idle hint before the comparison. The full native geometry, hit-test, focus, dismissal and unchanged-text assertions remain. Separate loading, failed Pagefind and retained-Close-focus cases remain unchanged. |
| Homepage WC round trip, both families and widths; [job 136761144964](https://github.com/Proto-UI/Proto-UI/actions/runs/44876125495/job/136761144964) | All four cases stopped at the exact authored Text inventory: actual 52, stale expected 37. They had not reached the pairwise layout assertions. | Update the exact WC/framework inventory from 37/35 to 52/50. The real current author tree adds fifteen Text owners in the analytics rhythm card. All pairwise line-box/card geometry, font, overflow, return-trip and negative strut checks remain. |
| Drawer document/Shadow bounded scrollport; [job 136761144936](https://github.com/Proto-UI/Proto-UI/actions/runs/44876125495/job/136761144936) | The fixture supplied `maxExtent: 12.5 root-text` when selecting the left edge, while the unchanged native assertion requires 20 root-text (320 px at a 16 px root; 400 px at 20 px). The integrated extent model now honors an explicit horizontal maximum. | Give the left recipe its explicit 20 root-text maximum and retain 12.5 for the bottom recipe. Every bounded-slot, single-scrollport, clipping, root-font scaling and actual scrolling assertion remains. A repaired native result is still required. |
| Drawer cold public entry and missing-scope negative; [job 136761144936](https://github.com/Proto-UI/Proto-UI/actions/runs/44876125495/job/136761144936) | All three cases stopped in esbuild because the actual preview renderer now imports `preview-material-scene.css`, but the in-memory fixture build supplied no output path. No cold-entry animation result was reached. | Supply an in-memory output path, require both emitted JavaScript and CSS, and install both real outputs in the native fixture. The CSS dependency is not discarded. The original missing-scope rejection, intrinsic/fixed geometry and animation assertions remain. |

The Drawer premise follows the existing `C-DRAWER-EXTENT-MODEL-0001-LENGTH` rule: the 20 root-text horizontal default applies when no explicit maximum is supplied; a valid explicit maximum replaces it. The catalog's draft status is unchanged. The implementation and its existing 38-case model suite agree with this rule. This repair changes the fixture input to match its original asserted 20 root-text recipe.

The actual homepage author-tree inventory was evaluated for both shadcn and brutalist: controls 3, workspace-command 3, workspace-analytics 15, workspace-progress 3, preferences 7, workspace-help 5, editor 3, hover 7, overlays 3, choices 3, for **52** authored Text owners. WC retains two closed FAQ bodies; framework hosts withdraw them, giving **50**. The existing gallery projection tests exercise the real WC/React projection and FAQ reattachment. Those model observations do not establish browser geometry.

## Failures deliberately left visible

| Scope | Historical observation | Disposition |
| --- | --- | --- |
| Demo Matrix, four original cases; [job 136761144936](https://github.com/Proto-UI/Proto-UI/actions/runs/44876125495/job/136761144936) | Each original case exhausted the 60 s initialized-preview count wait. The committed-host, 320/390 px readability and Dialog focus checks had not run. Read-only diagnostics also could not obtain timely DOM state. | Keep all four original cases and deadlines. Startup work or event-loop saturation is a hypothesis; the available log does not distinguish scheduling pressure from a startup defect. Do not report four independently demonstrated layout/focus bugs. |
| WC Shadow closeout; [job 136761144961](https://github.com/Proto-UI/Proto-UI/actions/runs/44876125495/job/136761144961) | Ten failed cases were observed: one original 5 s case timeout and nine ownership/paint assertions, including unexpected `decoration physical blueprint changed`, a root-opacity mismatch and failed admitted-transition controls. | Keep the original guard and all positive and negative controls. These observations are not explained by a slow runner alone. Reproduce exact source on a native runner before changing the guard. |
| Liquid Select, four runtimes × two themes; [complete job 136761144905](https://github.com/Proto-UI/Proto-UI/actions/runs/44876125495/job/136761144905) | All eight cases reached an open popup, then failed the 20 s positive material assertion at `demo-select-draft-projections.browser.test.ts:318`: `data-material-quality` remained `null`, expected `self-optical`. Subsequent selection-flow checks were not reached. | Keep the source-bound optical positive assertion. Missing material submission/reporting remains an unresolved product-or-integration observation; neither an opaque fallback nor a longer timeout is accepted as a repair. |
| Liquid live-canvas trace; [complete job 136761144905](https://github.com/Proto-UI/Proto-UI/actions/runs/44876125495/job/136761144905) | The diagnostic rejected unavailable CDP trace categories: `devtools.timeline`, `blink.user_timing`, `v8`, `cc`, `gpu`. | Classify as a measurement-capability blocker. Retain the requirement and do not claim an optimization or performance acceptance. This and the eight Select cases account for that job's 9 failed / 89 passed / 4 skipped result. |
| Other observations in timeout shards | A Brutalist preference reconnect poll failed in [job 136761144936](https://github.com/Proto-UI/Proto-UI/actions/runs/44876125495/job/136761144936). Liquid portal fixed-point diagnostics expected `column` and observed `row`, and reverse-wheel propagation from a short PRE observed document scroll 785 instead of less than 285 in [job 136761144964](https://github.com/Proto-UI/Proto-UI/actions/runs/44876125495/job/136761144964). Documentation image-preview intermediate frames timed out at 390/1280 px in [job 136761144961](https://github.com/Proto-UI/Proto-UI/actions/runs/44876125495/job/136761144961). | Preserve these unresolved observations as well. A shard timeout is not a completed suite verdict, and an interrupted/unstarted case is not a product failure. |

The existing Demo Matrix startup diagnostic workflow can collect a native CDP profile for the original mount case. It is supplementary to the four original cases. The earlier `2026-10-08-demo-matrix-startup-diagnostic.md` record documents a rejected query-selector experiment; that change is not reintroduced here.

## Local validation and limits

The five non-native source/fixture controls completed with **61 passed, 0 failed, 0 pending**:

- Public Drawer entry bundle and real CSS dependency: 1.
- Existing Drawer extent model: 38.
- Existing Search data and Pagefind resource controls: 12 + 4.
- Existing homepage WC/React projection controls: 6.

The attempted original Drawer and Shadow suites failed in their unchanged `beforeAll` browser launch. Chromium reported `process_singleton_posix.cc:297`, `socket() failed: Operation not permitted (1)`. Their **197 cases were unrun**: 7 Drawer and 190 Shadow. Vitest represented them as pending after the two failed hooks; they are not skipped acceptance, 197 failing product assertions or a passing suite. The same invocation's one Drawer build control passed. The supported escalation request was rejected by the execution environment. No browser sandbox flag or access-control workaround was introduced.

The source/fixture controls and source inspection are development evidence. Native geometry, paint, trusted input, optical output and final-candidate full regression remain unverified by this local work. The working tree was dirty, and the local receipts are not a clean final-candidate receipt.

## Exact native reruns

Use a normal sandbox-capable native runner, with the checked-out candidate and its locked dependencies. The existing harness discovers Chrome/Chromium; set `CHROME_PATH` only if it is installed at a nonstandard location. Each invocation below runs serially. `PROTO_UI_BROWSER_BASE_URL` may point to the same candidate's already-running documentation server; otherwise the unchanged harness generates styles and starts its server.

First run the original Drawer and Shadow files without a name filter:

```sh
corepack pnpm@10.32.1 exec vitest run \
  packages/prototypes/shadcn/test/drawer-entry-diagnostic.test.ts \
  packages/prototypes/shadcn/test/drawer-presence.browser.test.ts \
  packages/adapters/web-component/test/shadow-closeout.browser.test.ts \
  --pool=forks --maxWorkers=1 --minWorkers=1 --no-file-parallelism \
  --reporter=default --reporter=json --outputFile=browser-drawer-shadow.json
```

Then run the corrected Search geometry controls and the complete layout-parity file. This explicit name filter selects four Search font cases and six layout cases; the other Search cases are intentionally outside this diagnostic invocation and must still run in the full suite:

```sh
PROTO_UI_RUNTIME_EVIDENCE_DIR=browser-evidence/search \
PUI_RUNTIME_LAYOUT_EVIDENCE_DIR=browser-evidence/runtime-layout \
corepack pnpm@10.32.1 exec vitest run \
  apps/www/src/content/docs/zh-cn/site-search-commands.browser.test.ts \
  apps/www/src/content/docs/zh-cn/runtime-layout-parity.browser.test.ts \
  --testNamePattern='Runtime-only vertical layout parity|keeps enlarged 200% text reachable without clipping' \
  --pool=forks --maxWorkers=1 --minWorkers=1 --no-file-parallelism \
  --reporter=default --reporter=json --outputFile=browser-search-layout.json
```

Run the full original Demo Matrix file, retaining all four cases:

```sh
PROTO_UI_RUNTIME_EVIDENCE_DIR=browser-evidence/demo-matrix \
corepack pnpm@10.32.1 exec vitest run \
  apps/www/src/content/docs/zh-cn/demo-matrix.browser.test.ts \
  --pool=forks --maxWorkers=1 --minWorkers=1 --no-file-parallelism \
  --reporter=default --reporter=json --outputFile=browser-demo-matrix.json
```

For the complete failed Liquid shard's two failed files, capture the existing Select material snapshots and preserve the original performance diagnostic:

```sh
PROTO_UI_SELECT_SCREENSHOT_DIR=browser-evidence/liquid-select \
PROTO_UI_MATERIAL_EVIDENCE_DIR=browser-evidence/liquid-material \
corepack pnpm@10.32.1 exec vitest run \
  apps/www/src/content/docs/zh-cn/demo-select-draft-projections.browser.test.ts \
  apps/www/src/content/docs/zh-cn/demo-liquid-glass-material.browser.test.ts \
  --pool=forks --maxWorkers=1 --minWorkers=1 --no-file-parallelism \
  --reporter=default --reporter=json --outputFile=browser-liquid.json
```

These diagnostic invocations do not replace the full canonical cycle on the final candidate. Preserve initial failures and interruption receipts, and regenerate the full source-bound result after all review changes.
