# Sprint 3 website reading and current-source inventory

## Request and boundary

Agent paraphrase of the current Sprint 3 request: advance the 0.3 website portions of [#1042](https://github.com/Proto-UI/Proto-UI/issues/1042), [#1141](https://github.com/Proto-UI/Proto-UI/issues/1141) and [#1175](https://github.com/Proto-UI/Proto-UI/issues/1175), retaining each original condition and historical receipt. This slice owns public documentation reading and its shared controls; the integration owner handles release installation, the real shenko/OpenGreendam/verdant consumers and publication.

The four website hosts are Web Components, React, Vue 3 and Vue 2. The release family inventory is Base, Shadcn, Brutalist and the Lucide icon protocol. Bootstrap and Liquid acceptance is outside this bounded release slice.

## Repairs and their evidence

| Owning surface | Observed defect and change | Focused evidence | Native acceptance |
| --- | --- | --- | --- |
| `CodePanel.astro` | Collapsible SSR source used the small clipped window with a visible control that could not expand without JavaScript. SSR now presents readable source and hides that control; the existing client owns progressive collapse and keyboard focus after expansion. Default names follow the route locale. | Source guards and the existing nine client tests pass; three changed Astro components compile without diagnostics. | New public-route no-JavaScript and keyboard cells are pending execution and capture review. |
| `InstallCommandCard.astro` and client | Its one-shot initializer did not register a fresh card after the supported Astro page-load lifecycle, and old card listeners retained ownership. The extracted owner initializes idempotently, observes removal, releases on before-swap and ignores disconnected/retired input. All authored command alternatives remain readable without JavaScript. | The actual baseline inline script passed first-card activation then failed fresh-card activation (`npm`, expected `pnpm`). Seven focused owner/event tests now pass. | New native keyboard, document-navigation and explicitly synthetic Astro-lifecycle cells are pending. |
| Actual Base/Shadcn Button pages | npm and pnpm commands were separate presentations. Both bilingual pages now exercise one real two-manager card with the existing pinned stable `0.2.0` commands. Workspace and stable delivery remain distinguished. | `check:public-docs` passes. | Current-source browser reading does not prove installation; clean fixed-source and registry installation remain separate. |
| `CodeExample.astro` | Shared Usage/host/file/copy defaults were English on Chinese routes. Defaults now use the route locale while explicit authored labels retain authority. | Astro compilation and current public documentation checks pass. | Bilingual four-host reading cells are pending. |

The baseline is `dc3b184`. The extracted original InstallCommandCard inline script had SHA-256 `549885c121d579a41e0a5d28aa3a6bfc9032f73f004fc94d7431648e96f3e23d`. The baseline probe used Happy DOM, the original inline script and a no-op style-props publisher: it proves command-selection/registration state, not Adapter rendering or native-browser acceptance. Normal first-card outward activation was its positive control. After replacing the card and emitting `astro:page-load`, the replacement remained on npm. The new native lifecycle probe uses fresh SSR card bytes and labels its synthetic lifecycle events explicitly; normal website navigation remains document navigation.

## Current inventory

`scripts/docs/release-website-inventory.mjs` derives the inventory from declared package exports, the public documentation policy, the actual runtime identity list and parsed bilingual MDX. It ignores example markup inside code fences/comments, follows imported Preview aliases, rejects dynamic or unsupported host/identity expressions and retains source-byte hashes. It records each export associated with a shared overview.

The current snapshot contains **170 protocol families, 340 bilingual routes, 450 authored Previews and 1,578 declared Preview/host cells**. This is a source inventory, with every execution-evidence field initially `not-run`. The 170 includes 169 component families across Base/Shadcn/Brutalist plus the shared Lucide icon protocol. A permitted `codePanel` flag is not proof that an automatic code map exists or that Usage is complete.

Historical scopes retain their original identities:

- #1042's 518 routes/5,784 cells do not become accepted through this smaller release snapshot or a current static checker pass.
- #1141's original catalog closure and retained Dropdown owner/generation/portal/lease/part/orphan anatomy evidence remain separate. This slice does not substitute a new source count for those browser frames.
- #1175's original 19 conditions, 78 consumer rows and 11 + 72 + 72 subject matrix remain separate. The recorded Camoufox R5 failures remain historical failures; the private fixed runner/archive bytes were not recovered from current Git refs/public discussion. The new Chromium suite is named current-source and cannot replace that driver or its receipt.

### Public CLI target wording correction

Further source reconciliation found **84 bilingual guides / 42 families** claiming that no public `proto-ui add` target exists even though the actual `COMPONENT_REGISTRY` includes the target. These are Base and Brutalist guides, including Accordion, Select and Spinner. Only the inaccurate sentence changes: it names this workspace's actual target and requires matching CLI/package versions with release availability checked separately. Existing unavailable published-export notices and draft lifecycle text remain intact.

This correction explicitly distinguishes `COMPONENT_REGISTRY` from `WORKSPACE_COMPONENT_REGISTRY`. `runAddCommand` rejects `sourceOnly: true` entries; source metadata discoverable through `getComponentEntry` does not make those installed-consumer targets. Their existing no-public-add statements remain intact. No CLI/compiler code changes are part of this correction.

`node --test scripts/docs/test/public-cli-delivery.test.mjs` loads the actual CLI registry and release route inventory. At `4e3406b9c8f594875fe5f272caa56501c2e2a226`, it failed on the 84 current claims; after correcting those sentences it passes with zero contradictions. The test is included automatically by `test:public-docs`. This proves the bounded registry/prose consistency, not clean installation or complete Usage.

## Executed local checks

Node `24.22.3`, pnpm `10.32.1`, Linux; dependencies installed with the frozen lockfile in this worktree.

```sh
corepack pnpm@10.32.1 exec vitest run \
  apps/www/src/components/install-command-card-client.test.ts \
  apps/www/src/components/code-example-nojs.test.ts \
  apps/www/src/components/PrototypePreviewer/code-panel-client.test.ts \
  --maxWorkers=1 --minWorkers=1 --no-file-parallelism
node --test scripts/docs/test/release-website-inventory.test.mjs
node scripts/docs/release-website-inventory.mjs --check --out /tmp/s3-website-inventory.json
corepack pnpm@10.32.1 check:public-docs
corepack pnpm@10.32.1 exec vitest list apps/www/test/release-docs-reading.browser.test.ts --json
```

Results: **19/19 focused runtime tests**, **14/14 inventory tests**, current inventory **zero parsing/missing-route errors**, public docs **305 bilingual primary slugs/four library inventories**, and **24 browser cases collected**. The three changed Astro components passed `@astrojs/compiler.transform` with no diagnostics. Browser suite registration matches discovery. Vitest's inherited esbuild `ES2024` warning remains visible; it did not fail these tests. Browser collection and source compilation do not execute browser assertions.

## Native command and remaining work

```sh
PROTO_UI_RUNTIME_EVIDENCE_DIR=/tmp/sprint3-website-native \
corepack pnpm@10.32.1 exec vitest run apps/www/test/release-docs-reading.browser.test.ts \
  --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

Run on the integration machine's serialized heavy queue with its sandbox-capable Chromium. The shared harness generates styles and starts the actual source website unless a server is explicitly supplied. An externally supplied URL alone does not authenticate its served revision. `results.json`, source hashes and per-case screenshots remain on both success and failure; source hashes and expected candidate identity are checked before execution.

The local environment's native Chromium startup restriction is already established by the integration owner; this slice does not disable its sandbox or replace native assertions with Happy DOM. Browser results and visual inspection are **pending**, as are clean current-source installation, complete route/Usage acceptance, original historical acceptance and applicable real assistive-technology/device conditions. The 200% CSS text scenario is explicitly not browser zoom; narrow viewports are not physical mobile devices.

## Agent evidence disposition

**Partial** for the bounded reading repairs and inventory. The original defect, affected source and executable commands are recorded above. No UI captures have yet been uploaded by this slice, and no issue checkbox or state was changed. Next Agent action: the integration owner executes the native suite at the assembled candidate, inspects actual screenshots, repairs any findings, retains source-bound receipts and publishes the concrete progress with the PR. Independent review remains required. Missing publication evidence is not represented as completed verification.

## Native follow-up: preserve the first failure and repair observation ownership

The integration owner's first full run at `94e934f11310a9d9c2f7304b4990dcce333af2a4`, clean source and Chromium `145.0.7632.6`, finished **22 passed / 2 failed**. The retained originals are `proto-ui-sprint3-website-round1.log`, its Vitest JSON and `proto-ui-sprint3-evidence/94e934f/release-docs-reading/{results.json,source.json,*.png}` on the integration host. These results remain the first run; they are not replaced by the following diagnostic.

- `zh-cn-source-react`: the broad host-tab locator resolved an SSR anchor while the idle Tabs enhancement retired that strip. The failed click retained the original 10-second limit. An independently committed, clean diagnostic (`3e17a57974e83739edbfc5cfe307f74025d52469`) observed the source anchors at zero width/height and the actual family Tabs visible. The test now waits for and clicks the visible projected host tab and still compares every displayed source file and keeps the overflow assertion.
- `zh-cn-astro-owner-probe`: the original asynchronous `evaluateHandle` returned the removed card after synthetic lifecycle dispatch and reported a destroyed execution context. The two-case diagnostic reproduced that error after logging fetch, before-swap and page-load. Its main-frame log contained only the initial navigation and its final `performance.timeOrigin` was unchanged. The error wording therefore does **not** establish a reload, HMR defect or product navigation failure. The probe now retains the original element handle while its owner is live, obtains real SSR bytes from the initial navigation response, performs synchronous replacement without returning a retired DOM node, and directly exercises the retained old reference afterward. Same-document time-origin comparison and retained navigation/dev-server logs keep unexpected navigation observable; no retry, forced hidden click or exception suppression was added.

The diagnostic selected two cases (**1 passed / 1 failed**, 22 intentionally unselected) and is not full-suite acceptance. The corrected suite still declares 24 cases and requires a fresh complete run and capture review at the integration candidate. The original two failed screenshots were visually inspected; the post-swap uninitialized chrome alone was insufficient to infer a page reload.
