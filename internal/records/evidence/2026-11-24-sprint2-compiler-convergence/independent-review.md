# Independent review: payload-free event analysis boundary

Reviewer: `/root/s2_distribution`, separate from the candidate implementation owner.
This is a bounded read-only source review, not a GitHub approval or a claim that the whole Compiler is accepted.

## Exact candidate

- Base: `6b6462b526094cee9d3fa385332162c384624e3e`.
- Frozen patch: `compiler-convergence-candidate-01/candidate.patch`.
- Patch SHA256 independently read back: `653ec36647a5445e32ad761d475ce3a06441cd898b5dc045b07a9ac3cabfcae8`.
- `callable-effects.ts` SHA256 independently read back: `54594910baa6140658a3a0dcb415c07fcfd8c3448ad4974c4767806e56bbf499`.

The reviewed candidate is the conservative 21-line IR scan. The earlier experimental condition based on `event.payload !== 'void'` is not the reviewed candidate.

## Conclusion

No new unsafe exemption was found in the reviewed condition. The change can proceed to integration with its actual test receipts. It removes additional aggregate-data tracking only when every actual `expose.emit` has no second argument or has the real IR `undefined` expression. Ordinary phase and callable analysis still executes unconditionally.

The conclusion is limited to this condition. It does not establish bounded performance for every complex prototype that actually emits JSON, or replace the original generated-type, consumer, source/IR and integration gates.

## Checks performed

1. **Executable roots.** `PrototypeIR` stores executable definitions in `setup`, `moduleBindings`, and `hooks`. The scan includes all three. `AuthoredHookIR` setup/configure/projectHandle functions are traversed. Module/static declaration configs are finite static values, and exposure/prop schemas do not execute another hidden function body.
2. **Nested/default execution.** The generic object/array walk includes `FunctionIR.parameters[].default`, nested functions, getters expressed as entry functions, record/array values, conditional operands, loops, and try/catch/finally bodies. It does not prune a dormant branch and therefore conservatively enables the data analysis even for an unreachable payload expression.
3. **Metadata exclusion.** `type` and `span` are metadata fields in the validated IR. Actual authored record fields named `type` or `span` are represented as entries with a key and a value; their value expression is still traversed. Shared-node `seen` tracking does not hide an executable use first encountered only in a skipped metadata field.
4. **No trust in void declarations.** A reference, call, narrow, record, literal, or other non-undefined payload expression enables the full data analysis regardless of its declared type. A legally typed `() => void` that actually returns a function or an object remains a call expression. Changing only event payload metadata to void does not make the payload-free shortcut apply.
5. **Cold IR.** The same `callableEffectIssue` condition is used after portable IR validation. A forged record with a void type remains a record and enables the data analysis. A forged `undefined` expression with extra executable fields is rejected by the validator's exact kind schema; a valid undefined IR expression evaluates to the canonical undefined fact. The source parser resolves actual local/module bindings before emitting its builtin undefined IR form.
6. **Existing phase boundary.** `analyzeCallableFlow` remains unconditional. The candidate only changes the boolean controlling additional data provenance. A payload-free outward event does not grant setup-only operations to a host callback.

The patch includes paired source void-return contamination examples, cold metadata/record examples, an ordinary phase refusal, omitted/explicit-undefined positives, and complete authored Transition compilation plus cold validation under a subprocess deadline. These were inspected as source; this reviewer did not rerun or modify those suites. Their execution counts remain attributable to the implementation owner's recorded runs.

No product source, fixture, threshold, declaration status, or original result was changed during this review.
