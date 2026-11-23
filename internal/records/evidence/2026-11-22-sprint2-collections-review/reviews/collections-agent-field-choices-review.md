# Independent local review: explicit choice Fields and reset ownership

Reviewer: `/root/collections`, independent of the shared-input implementation owner. Mode: human-assisted / current-user. This is a definition/source and bounded executable review. No reviewed implementation file was edited by the reviewer, and no native browser or assistive-technology result is inferred.

## Bound sources and applicability

The original slice is `e16e820afd4df769cee36ab132f79f754a8c23fc`; its corrections are `ebbfc57`, `369362235af5028b1bff5e4355461dbaf4b1f930` and `42ee3b9c35f227622e6f2914f83f7dcc55938700`. The public recipe/native-runner additions were first read while uncommitted, then their final complete delta was reviewed at `095ecbdde4902941a13032386765dac59ebd7e6b`. Its new ordinary Tailwind stylesheet helper was also independently executed; the implementation sources are unchanged from the reviewed predecessor fixes. These source revisions are distinct from the final integrated PR head.

Definitions inspected include `form-input-applicability.v0.md`, `P-BASE-FIELD-CHOICES`, its Shadcn/Brutalist projections, `C-FIELD-SWITCH-0001`, the ordinary Checkbox/Radio contracts and the existing Field/Fieldset contracts. The explicit Field entries reuse the existing Base semantic setup with definition-time binding; ordinary Checkbox, Radio and Switch do not silently register with Form through ancestor discovery. Styling remains passive and shared with ordinary family entries.

Canonical checked is a boolean, including false; mixed display is independently owned. Radio serializes its canonical string. The existing Field required oracle treats false and empty as missing. Controlled refusal must preserve canonical value and dirty and cannot masquerade as an accepted onChange. Creation-time canonical state is the reset baseline; later default props do not replace it. Field readOnly blocks editing while retaining focus, including Radio roving; Fieldset remains disabled-only and never gains readOnly through this slice. The corrected definition and public recipe now preserve that existing boundary.

## Findings and exact independent replays

### FIELD-CHOICE-REVIEW-001 — corrected: controlled Radio reconnect

With ordinary or explicit Field Radio, mount controlled `value: 'a'`, unmount, update provided value to `'b'`, and remount. The original watcher discarded detached updates and onMounted never reconciled them, so canonical value remained `'a'`. Checkbox's equivalent false-to-true path passed. `ebbfc57` adds onMounted controlled-value reconciliation without replaying defaults or replacing the creation reset baseline.

The original Runtime probe remains in `field-choice-owner-review-red.json/.log`; the refined owner/payload probe retains the same reconnect cases. The latter was rerun against `3693622` unchanged except for its output filename: all four Radio/Checkbox reconnect controls and both mixed-owner cases pass, six total. This uses actual Runtime sessions and the real roots with a portable synthetic host.

### FIELD-CHOICE-REVIEW-002 — corrected: mixed-clear callback reverses a new checked owner

Start controlled `checked=false, indeterminate=true`. During `indeterminateChange(false)`, the application sets `checked=true, indeterminate=false`. The old implementation then computes its toggle from the newly changed checked value and emits `checkedChange(false)`, reversing the application's newer decision. Both ordinary Checkbox and FieldCheckbox reproduce it when the owner accepts emitted checked proposals.

The correction captures the activation-start value and a monotonic checked-owner revision. A real canonical transition retires the old checked phase, including false→true→false. A mixed-only acknowledgement with unchanged checked remains a valid original toggle. The precise original emitted false payload and the corrected absence of that stale payload are retained in `field-choice-owner-payload-review-probe{,-fixed}.json`. The implementation owner's additional unchanged-checked and ABA controls were read; they do not weaken ordinary activation.

The earlier first probe's stricter signal-list oracle is retained independently. The refined failing criterion is specifically the stale false inversion of a new true owner, not a blanket ban on all signals.

### FIELD-CHOICE-REVIEW-003 — corrected: queued Radio blur survives reset or policy cancellation

Across Base, Shadcn and Brutalist, focus the selected Radio, move outside, and request Form reset in the same turn. The original queued focus sample runs after reset and marks the Field touched again. An onBlur validator can therefore receive an obsolete departure after reset cleared it.

The correction has a distinct focus generation: reset/policy changes retire the old task, then resample current focus using sync facts. It does not reuse every value-operation generation, which would incorrectly cancel legitimate focus coordination. The implementation owner's new reset/readOnly/disabled cases also verify that a later fresh departure still produces blur.

The independent actual Web Component Adapter/HappyDOM probe originally has three failing reset cases plus three passing creation-baseline controls. Against `3693622`, the same six cases pass with zero skipped. Receipts: `field-choice-focus-review.json` and `field-choice-focus-review-fixed.json`; source/config and complete logs are retained. These are source/Adapter checks, not native browser focus evidence.

### FIELD-CHOICE-REVIEW-004 — corrected: focused subscriber terminal retirement

Ordinary Radio's public no-op `requestValue(currentValue)` performs immediate focus coordination. A subscriber to the newly exposed `focused` state can synchronously dispose the Root. The old method then resumes and reads disabled on that terminal owner, throwing a disposed-runtime error. An equivalent new controlled owner decision must likewise not turn an original no-op into a stale value proposal.

`3693622` preserves the original no-op intent and validates view, operation and a monotonic value-owner revision after focus publication and collection reads. Its owner tests include unmount, dispose, remount, new value and ABA. The independent original portable Runtime probe now passes all three unmount/dispose/remount cases; each returns false without accessing a retired owner. Receipts: `field-choice-focus-retirement-probe{,-fixed}.json`.

The very first reviewer fixture omitted a one-shot subscription guard and recursively remounted until its process exited 137. Its body and empty log are retained as `field-choice-focus-retirement-loop-error.*`; that fixture error is not a product negative control. The corrected original probe uses one-shot reentry and distinguishes the actual dispose failure.

### FIELD-CHOICE-REVIEW-005 — corrected: FieldSwitch reset adopts a newer preview-teardown owner

The newly added explicit reset correctly targets the original baseline and preserves ordinary Switch's public API, but captures `interactionEpoch` only after `invalidatePreview` returns. That call publishes public pressed/dragging/progress states and can reenter application code.

Independent actual Runtime reproduction at `3693622`: initial controlled `checked=false`; pointer-down publishes pressed=true; a public pressed subscriber sets controlled checked=true when reset clears pressed; then `resetValue()` emits its older baseline false. An ordinary controlled listener accepting that proposal overwrites the newer true decision back to false. The companion case with no owner update passes. Evidence: `field-switch-reset-preview-review-probe.mts/.json/.log`.

Expected: reset owns a fixed operation from entry, and preview teardown cannot make it adopt a newer owner/operation after reentry. Legitimate internal axis cancellation must still permit normal reset, while newer controlled decisions, ABA, nested reset and retirement end the older continuation. The finding was sent to the implementation owner before correction. `42ee3b9` now fixes a distinct reset intent and view lease at entry. Real owner, policy, nested reset and new activation advance that intent; the reset's own internal Axis cancellation only advances the interaction generation. The final axis rearm reads current policy for the same surviving view and never restores an old canonical value. The original independent two-case probe now passes both cases: the newer checked=true owner produces no stale false signal, while ordinary controlled reset still proposes its baseline. `field-switch-reset-preview-review-probe-fixed.json` retains the exact result. The author's five actual Runtime preview-teardown cases and actual Axis-input/geometry source control distinguish normal cancellation from owner/ABA/nested/terminal retirement; its original three red and three positive cases and subsequent six-file 232/232 receipt were read. That suite retains the old non-debounced Switch notification test and all 12 public recipes.

## Other inspected source and public recipes

The shared coalesced Checkbox/Radio Field report stores an initial canonical snapshot and schedules one owned zero-delay report. A net unchanged batch emits sync facts rather than an accepted change; false and empty string remain valid baseline values. Reset and policy/lifetime changes cancel owned notifications. Public exposed methods are used to enter the owning Radio callback scope; unbound cross-owner function dispatch was not accepted as a substitute.

The family implementations install the Base owner once and reuse existing style helpers. Checkbox/Radio role and relationship projection use existing portable modules. The explicit FieldSwitch reset is exposed only by its Field composition and restores canonical progress; controlled reset only requests the baseline. The author's ordinary refusal, reset callback, reconnect and readonly baseline tests were read, but finding 005 adds an earlier state-notification boundary those tests did not cover.

The final `095ecbd` public choice DemoSpecs compose actual Form, Fieldset, FieldLabel/Description/Error, FieldCheckbox, FieldRadioGroup and FieldSwitch across all three release families. Controlled owner acceptance is an ordinary queued application callback. It includes refusal, readonly, inherited disabled, held stale replies, replacement during a proposal, creation reset and actual Form submission. Dynamic replacement increments a consumer revision and cleans old instances through the real DemoRenderer. The added 12 source tests use real WC/React/Vue/Vue2 frameworks and Adapters, replacing only dependency acquisition. The native runner adds the same 12 public recipes and observes trusted input, relationships, old terminal handles and cleanup. No native result has yet been supplied to this reviewer. The new source-bound stylesheet helper compiles the actual website Tailwind stylesheet and literal candidates from the public Form/Select/choice recipe sources with installed Tailwind 4.2.2, embedding the exact referenced DM Sans and Geist font bytes for the no-asset-server fixture. An independent generation readback confirms the required size-5, block and inline-flex utilities and both embedded font files; `field-choice-stylesheet-review.json` binds all input/output hashes. This is a real CSS prerequisite check, not a geometry/input or visual acceptance result.

Earlier public recipe failures from an illegal Fieldset readOnly prop and a missing FieldSwitch reset were retained by the author, rather than concealed by weakening readonly/reset assertions. The Fieldset error was corrected in the consumer and draft wording; no new Fieldset API was invented.

## Evidence and acceptance limits

Owner-run logs read: the original seven-file 212-test receipt, later eight-file 265-test correction receipt, and the four-file 212-test final-public receipt for `3693622` plus the then-current recipes. They remain owner-run/source-bound observations, not reviewer-native executions. Independent replay totals above cover only the specifically described controls.

New definitions remain draft; no stable semantic or whole-PR promotion follows from these tests. Final integrated compiler consumers, browser/paint, full physical input/AT, and original cross-platform/experimental-family conditions remain independently tracked. All five findings are reconciled in the bounded source review at `42ee3b9`. No further defect was found in the reviewed slice; this does not establish final-head native execution or whole-PR readiness.
