# Bootstrap Dialog Close recipe ownership repair

## Scope and authority

The current user requested continued Proto-UI 0.3 repairs. The integrating owner delegated review finding `IR-F002`: correct the Bootstrap Dialog example's command ownership, preserve its existing Button appearance, and retain real four-host regression evidence. This is a bounded repair of an existing experimental consumer. Bootstrap 2.3.2 remains private, source-only and outside the committed stable 0.3 family set.

The published starting head was `eb2a023499c520933ea1b33499be2d0f4e73b26a`. The candidate below is identified by file hashes; this record does not claim that a later integration, native acceptance or independent review has happened.

Applicable draft authority fixes the responsibility without a new semantic decision:

- `P-BASE-DIALOG-CLOSE-COMMAND` makes Close the button-semantic command, including its content name, focus, keyboard/pointer activation and public interaction states. `P-BASE-DIALOG-CLOSE-NO-BUTTON-DEPENDENCY` requires direct command capabilities rather than `asButton`.
- `P-BASE-DIALOG-CLOSE-REQUEST` and `P-BASE-DIALOG-CLOSE-DISABLED` retain Root-controlled dismissal and own/Root disabled suppression.
- `P-BOOTSTRAP-2-3-2-DIALOG-CLOSE-BASE` preserves that owner. Its old VISUAL wording, “command wrapper for an authored family Button,” misleadingly encouraged a second command protocol.
- `P-BOOTSTRAP-2-3-2-SURFACE-PASSIVE`, INPUTS and PROJECTION already define passive `actionProfile: button` appearance and the exported `bootstrap232ActionAppearance` composition. Surface and Text do not acquire role, focus or activation ownership.

The issue belongs to the family explanation and real demo composition. Base, Trigger grouping, the adapters and the compiler are not changed. The VISUAL clarification reconciles its prose with the existing BASE criterion and inherited Close protocol. All lifecycle statuses remain draft.

## Actual failing behavior

The old `createFamilyDialogDemo('bootstrap-2-3-2')` authored a real `bootstrap-2-3-2-button` under `bootstrap-2-3-2-dialog-close`. Both prototypes installed their own command/focus protocol and public interaction facts.

An initial static hypothesis described two DOM buttons or Tab stops. The actual four-host runs disproved that stronger claim. Continuous Trigger grouping moved the physical role and tab surface to the inner Button: Close itself had no role, the inner Button was the one physical button/tab carrier, and Close's own public `focused` state remained false after its `focusSelf` request. These are two logical protocols with an incorrectly selected physical owner for this recipe, not proof of two simultaneously exposed DOM buttons.

The corrected pre-change assertion required Close itself to retain the button role, the sole tab surface and its own focused fact. All four hosts failed for the same governed reason. The old shared recipe SHA-256 was `e839585bb7ad5a3db641c508203229770c8afa2f34180f40991958694bb4b948`.

| Retained run | Actual result | Interpretation |
| --- | --- | --- |
| `owner-red` | 4 failed / 4, exit 1 | Close role was null in WC, React, Vue 3 and Vue 2. The unproved two-DOM-owner hypothesis was discarded. |
| `owner-red-attribution` | 4 failed / 4, exit 1 | Physical role/tab ownership belonged to the inner Button, and Close's own focused fact did not become true. |
| `owner-candidate-1` | 4 passed / 16, exit 1 | Single-owner repair passed; the new harness incorrectly read CSS classes instead of the actual Previewer feedback attribute and included the setup open request in activation counts. |
| `owner-candidate-2` | 14 passed / 16, exit 1 | Actual feedback assertions passed. React still warned about synchronous appearance writes during a framework commit; React reopen used a retired native carrier, and Vue input preceded its requested commit. |
| `owner-candidate-3` | 15 passed / 16, exit 1 | Guarded microtask projection removed the React warning; reacquiring the reopened carrier fixed its fixture. Vue's commit-boundary case remained red. |
| `vue-key-commit-boundary` | 1 passed, 15 deliberately unselected, exit 0 | Waiting for the real installed Vue `nextTick` after `api.call('close', 'focusSelf')` retained the original keyboard/controlled assertions. This diagnostic is not the final full-matrix result. |

The paint and Vue diagnostic logs are retained alongside these reports. A focused passing probe does not replace the failed full candidate; the final complete run below does.

## Repair

The real shared demo now composes the existing passive Bootstrap Surface and Text inside Close. `bootstrap232ActionAppearance({ emphasis: 'secondary' })` supplies the ordinary default Button shell, typography and slot geometry. Close uses an inline-flex envelope; the passive surface has no pointer hit ownership. There is no nested Button, hidden second tab stop, extra click bridge or new interaction state.

The composition subscribes to the actual Close public `disabled`, `hovered`, `pressed` and `focusVisible` state handles. It projects the latest observed hover/press/focus values into the passive Surface. A guarded microtask coalesces state notifications after framework commits; it neither interprets input nor requests dismissal. Instance identity, generation and liveness checks prevent retired callbacks and queued work from reading disposed state or writing to a replacement. Cleanup unsubscribes all four facts and the public instance subscription.

Own or Root disabled state suppresses all three observed interaction-feedback inputs. Re-enabling re-reads the actual Close facts. This uses the existing Surface API; it does not add a disabled Surface prop or claim the Button's separate disabled opacity/flat-fill/shadow recipe. Close retains disabled semantics, focus suppression and activation suppression.

The old family projection test's native button child is now passive span content. Its opacity and dismissal assertions remain, with added checks that Close owns the button role and its content introduces no role or tab stop.

## Validation and binding

Node `v24.22.1`, Corepack pnpm `10.32.1`, one Vitest worker and no file parallelism were used. The final focused command selected all three files explicitly:

```sh
corepack pnpm@10.32.1 exec vitest run \
  apps/www/src/components/PrototypePreviewer/dialog-close-recipe.test.ts \
  packages/prototypes/bootstrap-2-3-2/test/draft-overlay-projections.test.ts \
  packages/prototypes/bootstrap-2-3-2/test/action-appearance.test.ts \
  --maxWorkers=1 --no-file-parallelism --reporter=verbose --reporter=json \
  --outputFile=<evidence-directory>/owner-focused-final.json
```

**All 3 files and 31 tests passed, with zero failures or skips; exit 0, 20.4727 seconds.** The new shared-recipe suite contributes 16 tests, the existing overlay suite 11, and passive action appearance 4. The source hashes stayed unchanged across the run.

The 16 new cases run the actual shared recipe, actual prototypes and adapters, and installed React, Vue 3 and Vue 2 frameworks. Only network runtime loaders are replaced with installed modules. Public state subscriptions are observed without substituting state values or delivery. Saved actual callbacks are invoked after retirement as an explicitly artificial late-delivery control.

For each host, the cases verify:

- one physical button/tab owner on Close itself, passive child exposes, and Close's own programmatic keyboard-focus request;
- real hover, press, cancellation and keyboard-focus facts reaching the rendered `data-pui-style` feedback attributes;
- own/Root disabled suppression and restoration, controlled refusal, one pointer/Enter/Space request, keyboard follow-up-click deduplication and Space default prevention;
- controlled acceptance, reopening, subsequent uncontrolled dismissal, replacement cleanup, late callbacks, and queued appearance cancellation;
- no appearance-driven React `flushSync` call during a lifecycle commit.

Vue's fixture waits for the actual installed framework's `nextTick` after a public focus call requests a Vue update. A public focused value can become true before that requested commit reopens event admission. Real keyboard input arrives in a later input task; the original fixture dispatched its simulated key while still in the earlier microtask sequence. This is explicit commit synchronization before the next synthetic input, not a longer assertion deadline or sleep. Controlled refusal, disabled suppression and one-request assertions remain intact. React's reopen fixture obtains the current native carrier from the maintained refs rather than dispatching input on the retired carrier.

Selected strict TypeScript also passed, exit 0 in 11.5831 seconds, using the repository compiler options, the four changed TypeScript files, their imported closure, app environment declarations and the existing app path alias. The run used `NODE_OPTIONS=--max-old-space-size=2048`. Its configuration SHA-256 is `ea77b92059268a9f374c032a18ed08349c47228047ea09c4784f13292231d5cb`.

| File | Validated SHA-256 |
| --- | --- |
| `apps/www/src/content/docs/overlay-control-recipes-r94.shared.ts` | `1475828f565594000e52edce6ab3ee4196519645f43f8f6ada0be0584d42b37f` |
| `apps/www/src/components/PrototypePreviewer/dialog-close-recipe.test.ts` | `1500543417e774f46a7cebed8387dd6b87ae51c7a9dec8dcc4c33bffdf37cdbe` |
| `packages/prototypes/bootstrap-2-3-2/src/dialog/close.proto.ts` | `b57c01ffba8eaf433cf7c9ebd00be5784e29a0d87d6112aa96bdea390985a3d5` |
| `packages/prototypes/bootstrap-2-3-2/test/draft-overlay-projections.test.ts` | `b15bf7822a99e738aef21cd719c9354520ce2d1537737e0482a16a280b834136` |

The raw JSON, full logs, command receipts, selected type configuration, earlier failures and final source snapshots are retained in the integrating owner's `release03-dialog-demo-owner-20261115` evidence packet. Existing Vite/esbuild ES2024-target warnings remain in the raw output; they were not converted into source failures or removed from the receipts.

## Remaining acceptance

HappyDOM synthetic input, programmatic focus and feedback-token attributes do not establish native Tab traversal, browser hit testing, focus-ring pixels, CSS cascade, assistive-technology behavior or compiler conformance. No Box/native run, screenshot upload, Git/index change or GitHub mutation was performed by this bounded implementation owner.

The integrating owner will run the spec authoring, catalog and generated-projection checks after the new test is genuinely tracked, collect independent review on the frozen candidate, and bind subsequent publication/native evidence to its actual source. The draft `T-BOOTSTRAP-2-3-2-DRAFT-OVERLAY-0001` mapping records these executed cases without promoting either the Test or its family entities. This repair does not count Bootstrap as stable 0.3 coverage.
