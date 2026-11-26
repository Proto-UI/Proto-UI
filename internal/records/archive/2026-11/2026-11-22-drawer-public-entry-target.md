# Drawer public cold-entry fixture reconciliation

This is a bounded Sprint 3 browser-fixture repair. Product prototypes, event routing and animation behavior are unchanged. The new DOM controls do not replace native animation acceptance.

## Original CI and the input boundary

Full CI [job 137199303881](https://github.com/Proto-UI/Proto-UI/actions/runs/45018250847/job/137199303881) ran `830287f95959a4a1a4fb797df68b0bd6889e0bae`. `drawer-presence.browser.test.ts` ended with five passed and two failed tests. Both public cold-entry cases, intrinsic geometry and fixed-size control, failed at `result.events.some` because the projector event array was undefined. The separate homepage failure in that shard is outside this repair.

The fixture and public demo were unchanged at repair parent `a49b0f343136f4eee8a2fcc75001703fbc1383e8`. The demo composes a real Shadcn Button, `data-demo-ref="trigger-action"`, directly inside the Drawer Trigger. Under draft `C-AS-TRIGGER-0001-D/F/J`, this inner Button is the physical interaction surface; the outer Drawer member remains a headless behavior/anchor participant. Clicking the outer host box is correctly rejected.

`createPublicDrawerEntryFixture().open()` still called `HTMLElement.click()` on that outer host. The projector probe creates its event array only when a real projector method records an observation. An undefined array is therefore compatible with no opening request; it is not evidence that an entering animation completed or that the projector itself failed.

The original browser-6 runtime artifact is retained at `/workspace/scratch/828b7e591003/s3-drawer-ci-diagnosis/runtime-browser6.zip`, SHA-256 `72e920c60740c4b1c896263a58155b373b501bf85aa8ce7bed721077713861d3`. It contains no Drawer diagnostic files: that suite used a separate temporary output directory. The cause isolation below uses the actual producer in a new DOM control; it does not invent missing original native frame data.

## Repair and retained assertions

The fixture now requires exactly one actual inner action within its own host and calls the same `HTMLElement.click()` method on it. No input event, Root value or expected outcome is injected. The browser test waits for that real action's visible/enabled state, then starts its original 750 ms sample window before calling `open()`. It does not wait for Root open before sampling.

The added browser observations preserve initial closed state, the original Root identity, actual click target and event type, final Root open state, and whether projector events were recorded. They separate the programmatic `MouseEvent` from the Button's outward `CustomEvent('click')`. Only the former supplies the input witness; the latter remains in the diagnostic journal. Missing observations fail explicitly, without substituting an empty event list.

Every original motion assertion remains: entering environment, entering completion, `finished` outcome, multiple entering frames with positive height, movement greater than one pixel, and final `entered` phase. The 750 ms window and 30-second case timeout are unchanged. This is a real-browser motion probe driven by a programmatic click, not a claim of trusted physical-pointer input.

When `PROTO_UI_RUNTIME_EVIDENCE_DIR` is supplied, the suite now writes beneath its own `shadcn-drawer-presence` directory. The explicit `PUI_FINF_FEATURE_EVIDENCE_DIR` override retains its priority, and the original temporary-directory fallback remains available.

## Executed controls and limitations

`drawer-public-entry.test.ts` renders the actual public demo and calls the actual fixture in both geometry modes. Within one unchanged Root, an outer-host click produces no open notification and leaves the Root closed; the fixed fixture's click reaches the inner action, opens that same Root once and updates the public status. Both sides use the same `HTMLElement.click()` mechanism. CSS support is the existing DOM fixture input; no CSS/paint result is inferred.

The local progression is retained rather than collapsed into a green result:

| Attempt | Result | What the attempt established |
| --- | --- | --- |
| Initial old-fixture control | 2 failed | Happy-dom 15 leaves `isTrusted` unavailable; the original `false` assertion was an invalid local observation premise. |
| Old fixture with raw trust observation | 2 failed | The second click still targeted `trigger`, while the required physical action is `trigger-action`. |
| Fixed target, initially combined click observations | 2 failed | The Button's valid outward CustomEvent was being counted as another physical input. |
| Explicit MouseEvent/CustomEvent observations | 2 passed, 0 failed, 0 skipped; exit 0 | Same-owner negative and positive controls, raw trust equality, one physical input and the distinct outward click all hold. |

The final run used Node `24.22.3`, happy-dom `15.11.7`, a 512 MiB heap, one worker and both shared locks. It completed in 6.01 seconds within the 90-second cap. The native test file also passed TypeScript transformation; this checks syntax only.

```sh
env NODE_OPTIONS=--max-old-space-size=512 node node_modules/vitest/vitest.mjs run packages/prototypes/shadcn/test/drawer-public-entry.test.ts --maxWorkers 1 --minWorkers 1 --fileParallelism false
```

The separate logs are preserved under `/workspace/scratch/828b7e591003/s3-tooltip-native-entry-evidence/`: `drawer-ci-job-137199303881.log`, `drawer-old-entry.log`, `drawer-old-entry-target.log`, `drawer-fixed-entry.log` and `drawer-fixed-classified-entry.log`. No original failure is overwritten by the final run. The seven-case browser suite, including both cold-entry cases and their real projector/frame assertions, still requires a same-source native rerun.
