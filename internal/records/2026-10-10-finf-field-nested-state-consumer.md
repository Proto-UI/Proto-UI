# Field nested state consumer correction

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This independently reviewable correction follows the real editor invalid-paint failure recorded in the preceding source-paint commit. It changes no Runtime implementation, validation ownership or state instance.

## Authority and public type impact

Draft `C-AS-HOOK-0009-D/E` preserves a child handle and allows a declared typed child-handle map; it does not flatten authored hooks. Draft `C-FIELD-0001-A` assigns canonical value/editing to the control and Field validity/policy to its explicit `asFieldControl` binding. The public Field entry already exports this binding and `FieldControlBindingHandles`.

`FieldControlAsHookContract` had falsely placed nested invalid/pending and the required expose alias in its direct state capture. Its corrected contract declares its actual direct state names, including `inputAriaLabel`, and the existing `as-field-control` child handle. This is a public typing correction: callers that read `stateHandles.invalid`, `.pending` or `.required` must now use `getAsHookHandle('as-field-control').state.invalid`, `.pending` or `.fieldRequired`. Instance Exposes retain invalid/pending/required and their concrete boolean types; no public observable value or owner changes.

All four family FieldControl recipes now use that public nested handle for invalid paint and fail clearly if the promised binding is absent. They do not recapture another hook, duplicate a State, interrogate private artifacts, add validation, or write owner Props.

## Evidence

- The source-paint test on the preceding commit showed real `aria-invalid=true` without the intended paint. The corrected consumer now produces the generated invalid condition on Shadcn/Neo/Bootstrap editors. Liquid's material path resolves the actual foreground-border token and withdraws it when validity clears; it is not falsely tested as the same CSS transport.
- The new actual child-handle test covers required, async pending, resolution to invalid, clearing validity and value preservation. It verifies absent flattened keys and stable public child-handle identity.
- True external consumer types cover direct and nested getters, binding report, Base/four-family instance Exposes, and rejected incorrect domains/members. Restoring only the old type declaration causes real TS2339 errors for the child plus three TS2578 unused negative directives for the old falsely accepted flattened keys. The corrected source passes that same fixture.
- 38 focused tests pass across the new nested consumer, source paint, existing Field semantics and Liquid material-intent suites. The preceding Form/CheckboxGroup collector failures, Bootstrap's two unsupported source tokens, and missing new pixels remain separate open evidence. Material-intent tests are not optics acceptance.

The authorized source build covers the public dependency closure and each private family's normal draft build. Exact final commands/results are bound to the delivered commit. No full-delivery checkbox, lifecycle promotion or frozen fifth change follows from this repair.
