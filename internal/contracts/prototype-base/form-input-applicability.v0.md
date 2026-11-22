# Sprint 2 · explicit form input applicability (draft)

This independently reviewable definition bounds #1160 and #1094 for the 0.3 Base, Shadcn and Brutalist release families. It does not activate the historical full-family/native/AT criteria. Existing Field validity and Form submission remain independent owners.

| Input | Form entry | readOnly meaning | Value/reset owner |
| --- | --- | --- | --- |
| Button | FormSubmit / FormReset | A command has no editable value; Form pending/disabled controls command availability | Form owns the requested operation; ordinary Button owns no field |
| Checkbox | **FieldCheckbox** inside one Field | Retains focus, rejects pointer/Space/Label value proposals; disabled additionally blocks focus | Checkbox owns boolean checked; indeterminate is presentation only; reset proposes initial checked/mixed independently for controlled owners |
| Radio Group | **FieldRadioGroup** inside one Field, ordinary same-family Items | Retains roving focus and Label focus; no pointer/Space/arrow value proposals | Root owns one canonical string; reset proposes its initial value, including empty |
| Input | FieldControl | TextControl rejects edits, retains focus/manual validation | Stable TextControl value owner; reset is controlled proposal or initial uncontrolled value |
| Textarea | FieldTextarea | Same as Input, with multiline selection/composition | Same single TextControl owner; Field only consumes its snapshot |
| Switch | FieldSwitch | Focus remains; click/keyboard/drag proposals blocked | Existing boolean Switch owner and reset; Field consumes canonical checked |
| Toggle | No automatic Form field | A command-state toggle is not a submitted value | Existing active/pressed owner and group/toolbar contract; an explicit custom reporting composition would need its own definition |

## Explicit choice entries

FieldCheckbox and FieldRadioGroup call the existing semantic root setup with a definition-time `fieldBinding` option and asOptionalFieldControl. Ordinary Checkbox/Radio Group remain unregistered inside Form or Field and never become form fields through ancestor discovery. The ordinary roots also admit local readOnly as a focus-preserving edit policy; the explicit entries OR it with Field/Fieldset policy. There is one semantic owner per control.

Checkbox reports the canonical boolean, including false. Indeterminate never changes the submitted boolean or the required oracle. Existing C-FIELD-0001 defines false as empty; no other boolean Field is reinterpreted. Radio Group reports the canonical string; empty is missing when required. Item names are not serialized values; duplicate/disabled/nonmember requests remain rejected by the Root.

The creation canonical value is the reset baseline. A later default does not change it. Controlled reset emits an ordinary proposal; rejection retains the canonical value and therefore dirty remains true when it differed from the baseline. The request does not silently force checked/value. ReadOnly/disabled do not block an explicit reset operation. Checkbox checked and mixed ownership remain independent.

Accepted canonical changes report synchronously for current Field snapshots, then one bounded task after ordinary owner commits may notify onChange. Same-turn proposals coalesce to the latest canonical result; a refused candidate or a sequence returning to the initial batch value creates no onChange notification. Manual and blur validation remain available. This is a choice-control contract and does not rewrite the existing TextControl candidate-edit notification contract.

Radio Group's focused Field fact is the aggregate of current owned Items. Blur of one Item followed by focus of another in the same host turn is not Field blur. A deferred sample resolves the group fact; actual departure may mark touched/validate. ReadOnly still allows arrows, Home/End or explicit focus methods according to the existing roving contract, while every value request is blocked. Disabled members are excluded from roving.

Every callback can reset, unmount, dispose, replace an Item or reconnect the same logical owner. Operation/view epochs retire old continuations and pending report/focus tasks. A newer owner decision wins; old work cannot emit completion, publish stale Field state or access a terminal RunHandle. Label activation focuses the explicit target and respects the same edit policy.

Three public family entries and four Web Adapter recipe consumers must share these meanings. Family style functions remain passive and consume the same Base state; no hidden input, native form forwarding, raw DOM lookup in prototypes, validator, second value owner or compiler business dispatch is admitted. Native recipe results, physical touch/IME and assistive technology remain distinct evidence.
