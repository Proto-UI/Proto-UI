# WC Demo props: one explicit commit per consumer update

Date: 2026-11-16. This is an implementation and evidence record, not a new public guarantee.

## Attribution and authority

The website's WC `DemoRuntimeApi.setProps` called the instance convenience `setProps`, then called `update` again. In the current real WC Adapter, the convenience setter itself calls `setElementProps` and `controller.update`. The mounted WC host completes ordinary updates synchronously, so these were two completed render/commit cycles, not two intents coalesced by a scheduler.

This is a website consumer defect. The public props helper and explicit update entry already provide the required operation; no compiler, definition or public package change is needed. `spec/adapters/A-WEB-COMPONENT-0001.yaml` describes the helper's direct props delivery and explicit render boundary. `spec/tests/T-PROPS-0005.yaml` is active; `T-PROPS-0001` and `C-LIFECYCLE-0003` remain draft and are not promoted here. The existing actual Adapter regression in `packages/adapters/web-component/test/props-reprovide.test.ts` separately demonstrates props delivery without rendering and the convenience setter's explicit rendering. `WebComponentAdapterHandle` exposes `update` and `getExposes`; no supported Demo extension point requires invoking a replaced instance convenience setter.

## Repair

`apps/www/src/components/PrototypePreviewer/demo-renderer.ts` now uses its existing public `setElementProps` import for the complete raw props/surface snapshot, followed by the existing ownership check and one `update` call. This is the same channel already used for initial and keyed-child projection. Raw patch preservation, callback binding, surface ownership, explicit repeated updates and exception propagation are unchanged.

The ownership check also now lies between real props watcher execution and the only update intent. A watcher can synchronously retire the render lease. The previous convenience setter submitted an update inside that retired lease before the website could reach its guard. The new regression reproduces that additional old render and verifies its absence after the repair.

## Executed evidence

The new `demo-renderer.wc-props-commit.test.ts` uses the actual WC Adapter, runtime and registered probe prototypes. Its render and `onUpdated` observations count completed work; it does not infer commits by spying only on the instance's `update` method, which would miss the internal controller call in the old convenience setter.

On published base `02bb0d7fe92f7991f25883efba56c959f6ac917d`, the **same final nine fixtures** produced **6 failed / 3 passed**, exit 1, in **4.216 s**:

- props, surface changes and prop withdrawal each committed twice;
- two accepted nested consumer updates committed four times;
- omitting the convenience method prevented props delivery;
- a real props watcher retiring its owner still allowed one stale render.

The three controls for a retiring caller getter, a throwing caller getter and a throwing real props watcher passed on the old source. The initial six-case fixture attempt also incorrectly expected terminal disconnect disposal to be synchronous. That separate failed attempt remains archived. The final fixture waits for the Adapter's existing deferred disposal while asserting immediately that no stale projection occurs; it does not change the product lifecycle.

The repaired complete six-file run passed **150/150**, zero pending/todo, exit 0, in **40.871 s** on Node **24.22.1** and pnpm **10.32.1**:

| Suite                                        | Cases |
| -------------------------------------------- | ----: |
| WC props commit regressions                  |     9 |
| Existing dynamic children                    |    55 |
| Existing public instance lifecycle           |    32 |
| Existing hover/reenable and withdrawal       |    29 |
| Existing callback consumers                  |    17 |
| Existing optional props across four adapters |     8 |

All **13,195** bound source files, including the new fixture, were identical before and after both the final baseline and candidate runs. These are local HappyDOM host tests, not native browser acceptance. Raw logs retain their existing ES2024 warning and framework diagnostics.

Selected strict TypeScript checking of the renderer, the new fixture and the existing website environment declaration passed, exit 0, in **6.454 s**. This supplements the prior whole-workspace type run on `02bb`; it is not represented as another complete `check:types` execution.

Archived evidence directory: `release03-wc-demo-single-commit-20261116`. Receipts bind commands, timestamps, source hashes, complete JSON test results and raw logs:

| Receipt | SHA-256 |
| --- | --- |
| `baseline-final-receipt.json` | `e90bf17d523f350bae6402c7a52bb89d7cb9e40837a5baaad0ba7021c5ac395d` |
| `candidate-related-receipt.json` | `98ab67bfc72e5b5252862c9abbf2b788f68e881b4e62e696b1b41164c91bab97` |
| `candidate-types-receipt.json` | `9a765f7317ad766f5cfb80edbe2fb1683caa15c91bd1d29e734a7e4f0a0a6489` |

## Native acceptance boundary

The original production v15 run on `02bb` remains **2 passed / 2 failed**. Both Brutalist journeys passed; Shadcn runtime replacement and IME Escape focus return failed their original one-second gates. The independent diagnostic of those failures uses the unchanged `02bb` source. This repair has a demonstrated lifecycle/cost defect and independent regression evidence; it does not yet establish which native delay it removes or that either timing failure is solved. No timeout, getter, readiness marker, original native action or result count was weakened. Public packages remain `0.3.0-alpha.2`.
