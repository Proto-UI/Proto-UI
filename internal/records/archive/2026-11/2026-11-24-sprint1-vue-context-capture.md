# Sprint 1: Vue Context capture producer regression

This record addresses #1178's actual Compiler failure in `packages/compiler/test/sprint2-native.browser.test.ts`, observed in [run 45238253018, browser shard 12](https://github.com/Proto-UI/Proto-UI/actions/runs/45238253018/job/137916322153). The fixture producer failed before Chromium startup, at target `vue`, kind `shadcn`, with `PUI1999` and “Checked Context subscription requires a key declaration.” This is separate from browser execution and Sprint 2's wider acceptance conditions.

## Cause and repair

The Context declaration was present and validated. The general authored-Hook capture lowering evaluates operation arguments once and retains temporary references for both the effect and its capture receipt. Vue's subscription emitter then incorrectly required the lowered key expression to remain a literal `context-key` node, even when no callback was supplied. A valid key carried by the capture temporary therefore caused an internal compiler error.

The repair is confined to `packages/compiler/src/vue-source.ts`. For an inline subscription callback, its already checked parameter types provide the `next` and `prev` argument casts. A callback reference continues through the existing `Reflect.apply` path. Key evaluation, callback evaluation, capture receipts, subscription mode and disposer ownership are unchanged. No component name, family name or debug name is used for admission. The parser, portable IR validator and Context declaration authority are unchanged.

The added source tests compile both required and optional subscriptions, with and without callbacks, through authored capture. They retain ordinary inline callback controls and imported alias/re-export identity. Counterfeit source keys, forged IR declaration identities and forged callback types remain rejected by the existing checks before target emission.

The separate generated-consumer tests compile and execute ordinary Vue 3 components using their generated native modules. They check both subscription modes, actual `next`/`prev` values, distinct declarations with the same debug name, disposal, fresh replacement and retained old handle invalidation. They use Happy DOM and the real Vue framework, without a Proto Runtime bridge.

## Actual evidence

| Execution | Observed outcome |
| --- | --- |
| Original unmodified `buildSprint2NativeFixture()` on HEAD `5073c21ae8a9f9e78822842c918fbe2395ef1ae8` | The exact original Vue/Shadcn `PUI1999` reproduced in 2.856 seconds. The Vue emitter SHA-256 was `027a1b65e497e7c0ce82cebc251413071bf15f726acba9f37decea2bb9a325b1`. Chromium was not started. |
| Corrected reduced regression cases before the source fix | 5 pass / 4 fail / 0 pending. All four authored-capture positive cases reach the same internal key-shape assertion. The ordinary controls and all negative controls pass. |
| Source fix and adjacent Context suites | 4 files, 33/33, zero failed/pending: 9 new source controls, 12 declaration tests, 9 disposer frontend tests and 3 existing generated Vue Context journeys. |
| New generated Vue capture consumers | 2/2, zero failed/pending; required and optional subscriptions preserve values, key identity and terminal replacement. |
| Original full producer after the fix | 16/16 products assembled: React, Vue 3, Vue 2 and WC × unchanged Base/Shadcn/Brutalist Buttons and the independent TextControl fixture. Actual esbuild bundling and the existing no-hidden-Runtime/geometry-input guard pass. |

The final producer ran from `2026-11-23T19:14:47.332Z` to `2026-11-23T19:14:53.287Z` under the original 120-second setup ceiling. HEAD was `5073c21ae8a9f9e78822842c918fbe2395ef1ae8` before and after, with the reviewed working-tree Vue emitter SHA-256 `e9df01761bd50b7e76197f4dce8f993cc6f9c5c186bf214e06e0b759a616c359` unchanged during assembly. The original fixture independently hashes its Compiler and replay sources before and after assembly. Its build manifest SHA-256 is `1034d0f7975db562bc4b11fa0edeb65e0d5af8fc6780e184512d26d514bb3a69`; bundle SHA-256 is `87ddf3551a54cdd02f825688751b4d99fc3754bae5f45f7551494cf91c64684b`.

The first reduced test-fixture calibration incorrectly assumed unused imported Context declarations were omitted and expected diagnostic category `invalid-input` instead of the existing `invalid-ir`. That original 3-pass / 6-fail report is preserved and explicitly classified as fixture calibration, not six product failures. Correcting those expectations exposed the four real emitter failures before changing product source.

## Scope and retained originals

The [manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint1-vue-context-capture/manifest.json) and archive retain original logs/reports, source hashes, the actual full build manifest, all generated artifacts and the bundled consumer. The successful producer does not establish Chromium behavior, physical input, assistive technology, strict generated-code type checks or full Sprint 2 acceptance. The browser tests must still execute the final integrated candidate in CI; their original runtime assertions and budgets were not modified here.
