# Sprint 7: declarative Agent UI realization experiment (#757)

## Result

**The compared paths tie in this bounded experiment.** On the same A2UI Tabs description, React 18.3.1 and one reviewed behavioral oracle, ordinary Radix Tabs and actual Proto-UI Base Tabs plus React Adapter each passed six browser journeys: manual/automatic activation, repeated three times. Both paths exposed an unnamed tablist when given a schema-valid missing-name description; both failed when the catalog wrapper swallowed ArrowRight; both explicitly rejected the common mapper's unsupported dynamic-title input. A Proto-specific correctness or validation advantage was not demonstrated.

This weakens the claim that inserting Proto necessarily improves a mature single-host catalog. It supports only the narrower feasibility claim that an existing Proto semantic owner can realize this literal Tabs subset. Cross-host savings, maintenance savings, model cost, consumer demand and general Agent UI value remain inconclusive. The three repeats are deterministic replays, not three independently generated implementations.

Original issue: [#757](https://github.com/Proto-UI/Proto-UI/issues/757). Implementation and reproducible commands: [study directory](../../scripts/analysis/declarative-agent-ui/README.md). Original outputs: [attempt 1](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-s7-declarative/attempt-01/result.json), [attempt 2](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-s7-declarative/attempt-02/result.json). The second receipt is the completed comparison; the first is preserved with its oracle disagreement and storage failure.

## Pinned external model and common task

The inspected external format is [A2UI 1.0 at `5ff1b05f02d39f969b52a942e78e864ef3ac01fa`](https://github.com/a2ui-project/a2ui/tree/5ff1b05f02d39f969b52a942e78e864ef3ac01fa). Its component catalog supplies structural schemas; a renderer/catalog implementation supplies concrete UI behavior. The exact basic catalog, common types, agent-to-renderer envelope and Apache-2.0 license are vendored unchanged in the study. Each build records their hashes. This experiment adds no public compatibility package and adopts no external standard for Proto-UI.

The [literal fixture](../../scripts/analysis/declarative-agent-ui/fixtures/settings.json) creates one settings surface with General, Privacy and Notifications tabs, literal Text children and the accessibility label “Account settings.” Its byte hash is `d1e75981b398a7d2fa0339f338e12c4f317c3972d07be042cacf5015dc34c5ef`. Both paths use precisely that input and common `applyMessage`/`projectSurface` glue.

The shared task/catalog policy chooses horizontal orientation, looping, first-tab initial selection, component-owned selection, manual or automatic activation, Home/End, and identity preservation during title/content updates. These choices are stated as task policy, not universal A2UI or accessibility requirements. The mapper supports `createSurface`, literal `updateComponents`, `deleteSurface`, and recreation with a fresh surface identity. It rejects unsupported concepts explicitly and keeps retired IDs from silently becoming new owners.

| Layer | Ordinary path | Proto path | Duplication and information burden |
| --- | --- | --- | --- |
| Declarative producer | Same surface/catalog/component IDs, labels, titles and Text values | Same bytes | No framework names, DOM IDs, selectors, key handlers or lifecycle callbacks are required in either input. Input burden is equal here. |
| Envelope and mapping | Shared schema validation, literal graph resolution, update/delete ownership and unsupported-input checks | The identical mapper | These are external catalog responsibilities. Proto does not remove this glue. |
| Catalog task policy | Radix Root/List props select orientation, activation, looping and initial value | Base Root/List props select the same policies | Those choices are explicitly redeclared once in each path. Neither requires a handwritten focus/keyboard machine in the wrapper. |
| Primitive behavior | `@radix-ui/react-tabs` 1.1.13 supplies keyboard, selection and accessibility behavior | Existing Base Tabs through the actual React Adapter supplies behavior | The ordinary library already supplies the measured guarantees. Replacing its owner with Proto yields no measured correctness gain. |
| Application lifecycle | React keys preserve tab identity and replace deleted surface owners; common host action survives | Same application/key policy | Both need catalog-to-application lifetime glue. Stable tab IDs are data identity, not a hidden Proto instruction. |
| Validation | Official schema plus the reviewed black-box journey | The same checks, with applicable Proto criteria as an expectation source | Neither library prevents the two semantically broken catalog inputs. The external oracle diagnoses both equally. No unique Proto diagnostic is claimed. |
| Maintenance | One small React catalog renderer, common mapper, common oracle | One small Proto-backed React catalog renderer, common mapper, common oracle | No paired maintenance assignment was performed. Wrapper size is not a cost or correctness proxy; total runtime dependencies differ. |

## Independent oracle and real execution

The reviewed [protocol](../../scripts/analysis/declarative-agent-ui/protocol.json) draws on the [WAI-ARIA APG Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/), the pinned external specification and applicable Base Tabs criteria. A separate agent reviewed the task and negative controls before collection. After attempt 1, it reviewed the described semantics of the initial-tabstop correction before attempt 2; its exact-byte review of the final protocol/runner occurred after collection at `2026-11-22T11:29:32Z`. The [review record](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-s7-declarative/independent-protocol-review.md) distinguishes these events. The implementation author wrote the black-box runner; the expectation review is independent agent review, not a fabricated human approval or a blind general benchmark.

The completed protocol hash is `a3d8c6fa2866b8ca61833ca4dbc5461c4b1e323b75279809352a05e5c50282f2`. The browser was headless Chromium **145.0.7632.6**, Playwright **1.58.2**, Node **24.22.3**, at 960×680, scale 1, light theme. Browser keyboard and pointer routes produced recorded trusted events. Retained detached-node activation is explicitly synthetic. No OS input device or assistive technology was used.

Each journey checks initial selection and matching panel; native Tab entry; Arrow navigation; manual/automatic activation; Enter and Space; wrapping and Home/End; no page scroll on Space; pointer selection; live tab/panel labelling; Tab exit through the text panel to an ordinary host action; title/content update with selection and trigger identity retained; deletion and inert retained elements; host continuation; and a new surface owner.

| Path                            | Manual | Automatic | Browser terminal results |
| ------------------------------- | -----: | --------: | ------------------------ |
| Radix React Tabs 1.1.13         |    3/3 |       3/3 | 6 passed, 0 failed       |
| Proto Base Tabs + React Adapter |    3/3 |       3/3 | 6 passed, 0 failed       |

All 12 cells bind the actual served HTML and JavaScript hashes to the build manifest. Attempt 2 finished at `2026-11-22T10:47:15.318Z` with no setup failure. The served `app.js` hash was `81bf24ff8b65789fc020486e81e0c7125d34d99e0a1da119bc5cc02736b3713d`; HTML was `1d94ba803fdfa26ae8290881d0933388bdd118b732bf090ac09b657d5068c74f`. The receipt records `af70fbd99f57017aeee6b541c4ccbb04c348d68b` with `dirty: true` and the hashes of **404 actual source/build inputs**. That working-tree identity is preserved; it is not relabelled as a clean later integration commit.

The implementation author viewed all four captured updated states, and the independent final reviewer separately viewed the two manual-mode captures. They show the correct selected Privacy title/content and the focused host continuation control. Screenshots support the rendered-state claim; the event/state trace supports the interaction claim.

The [source reconstruction receipt](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-s7-declarative/attempt-02/source-binding.json) independently checks all 404 build inputs: 374 tracked inputs exactly match the recorded `af70fbd` revision, 28 are locked dependency inputs, and the only two tracked overrides are the corrected protocol and runner. Their exact bytes are retained as [a patch](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-s7-declarative/attempt-02/source-overrides.patch). Thus the dirty source is reproducible without substituting the later Scroll changes. The [independent protocol review](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-s7-declarative/independent-protocol-review.md), 22 original browser trace ZIPs and their [hash manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-s7-declarative/trace-manifest.json) are retained alongside the raw outputs.

## Negative, unsupported and redundant cases

| Input or mutation | Structural validity | Actual observation | Interpretation |
| --- | --- | --- | --- |
| Omit the optional catalog accessibility label | Official schema accepts | Both rendered unnamed tablists; the same behavioral name check detected the omission | Schema validity does not establish adequate contextual naming. Neither realization silently receives a better name from the underlying library. |
| Wrapper capture handler swallows ArrowRight | Valid input; intentionally broken host glue | Both recorded the handler firing and focus remaining on General instead of Privacy | A catalog wrapper can defeat either primitive's guarantee. The oracle is capable of detecting a real interaction divergence. |
| Dynamic title `{ "@path": "/title" }` | Official schema accepts | Both reject `Unsupported dynamic tab title` | The common literal-only mapper lacks data-model resolution. This is a mapper limitation, not evidence that Proto cannot render changing text. |
| Official `callRendererFunction` / `formatString` envelope | Official schema accepts in the schema suite | Common component mapper explicitly rejects this envelope | Renderer function evaluation/RPC is not honestly represented by a Tabs primitive. It requires a separate renderer/application capability; no function execution is claimed. |
| Ordinary catalog already implements keyboard/selection semantics | Valid common task | Both paths pass all repetitions | The measured Proto guarantees are redundant in this single-host catalog. This is the required null case, not an experimental failure to publish. |

The six rendered negative-control cells all reached their expected terminal outcome. Seven Node schema/mapping tests separately cover the original input, semantically insufficient naming, unsupported dynamic input and RPC, malformed envelopes, and lifecycle identity. Their scope is structural/mapping validation; they do not substitute for browser behavior.

Concepts not exercised include data bindings, arbitrary catalogs, multiple surfaces, renderer functions, business action delivery, controlled selection, non-Web presentation, and general external-protocol error recovery. Proto's own criteria/owner contracts likewise do not become properties of the external protocol merely because this mapping uses them.

## Preserved disagreement and failed first attempt

Attempt 1 used the original reviewed protocol hash `eac2b8e691278f93bc6655c8f705960cbe5659089f6638b1b54ba501305db09a`. Its first two Radix cells failed an **oracle premise**: the observer required a trigger with `tabIndex=0` before native focus entry. Radix initially puts the tabstop on a group that delegates focus to the selected trigger when Tab enters. The original premise wrongly equated an implementation detail with the user-facing entry contract.

After independent review, the correction permits group delegation before entry and requires the real Tab action to focus the selected trigger and establish the roving trigger tabstop. All selection, relationship, navigation and lifecycle assertions remain. Initial/recreated states still require a selected tab and matching panel. Both paths reran from the same revised protocol; no successful old cell was substituted for a rerun.

The first run also stopped while writing a trace because the remote `/tmp` filesystem was full. It has five completed cells (two premise failures and three passes), seven unrun cells, no completed negative-control set, and an explicit `ENOSPC` setup failure. Four completed traces and available screenshots remain. It is excluded from product-performance or win-rate claims. The second run used a separate directory on a filesystem with capacity, without deleting other work.

## Cost, reproducibility and conclusion boundaries

No independent model generation, token cost, financial cost, integration-time comparison or maintenance task was measured. Both paths were authored against a common inspected catalog and task. The combined browser bundle includes both realizations, so its byte size is not a per-path dependency-cost comparison. Build manifests retain exact source/dependency identities for reproduction, rather than presenting the combined bundle as an economic result.

The same fixture and deterministic mapper reproduce the selected UI state and journey across the recorded repeats. The Proto path is Runtime+Adapter, not a compiler projection; this study makes no compiler determinism claim. React is the only host measured. A second host would require the same task, inputs and controls before any cross-host advantage claim.

The supported conclusion is **feasible mapping, equal measured behavior, no demonstrated unique value** in this mature single-host Tabs catalog. Claims of reduced repeated interaction work, stronger validation or lower maintenance burden are **not supported by this comparison**. Broader cross-host and economic hypotheses are **inconclusive**, not disproved by a one-host study. No public integration package, new Base semantic, or adoption decision follows from these results.
