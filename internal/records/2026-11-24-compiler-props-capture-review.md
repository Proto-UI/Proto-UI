# Sprint 1: independent capture-provenance / Props advisory review

This is a bounded independent review of the integration author's changes to `packages/compiler/src/callable-effects.ts` and `packages/compiler/src/ir-validation.ts`. It is not a GitHub review, whole-Compiler acceptance, native-browser result, or approval to change an observable profile.

## Reviewed behavior

`checkedSpreadFields(value, captureFields)` now gives validation the same finite capture-facade shape used by the parser. It still rejects unproved opaque values and open indexed records. This correction does not give opaque capture receipts callable authority.

The new callable-flow atom binds a copied capture getter to the actual captured installation and operation. Literal method/child lookup obtains the actual stored source closure, child handle or raw capture. Unknown keys retain unknown provenance. Public capture buckets remain opaque; a host-supplied callable still has external provenance. The ordinary source-call graph is not reconstructed from a callable signature or lookup metadata.

No blocking defect was found in that initial bounded read. A later independently executed identity probe did find a blocking defect, recorded below; the earlier seven-source observations do not accept that new condition. The existing `capture-facade.test.ts` and `capture-lookup-integrity.test.ts` contain independently relevant controls for forged getter return/lookup metadata, incomplete lookup maps, opaque receipt spreading/calling, and capability leakage through narrower records. Their execution is part of the integration owner's separate suite receipts; this review does not relabel those tests as rerun here.

## Executed independent probes

The seven final authored-source probes returned their expected results:

| Probe | Actual result |
| --- | --- |
| Copied render with direct Props read, no update request | `missing-authored-update`, closed |
| Same copied render with the real authored watcher request | `authored-update-present`, closed |
| Detached literal `getMethod` call to an ordinary source method | Source remains closed; no update is invented |
| Actual captured method invokes an incoming external callback | `unknown`, `external-callable`, no absence advice |
| Public method accepts a `RunHandle` | Existing public-authority refusal `PUI4003` remains |
| Dynamic method name is looked up and invoked | Existing unclosed-callable refusal `PUI1007` remains |
| Ordinary incoming callable has a getter-like key signature | `unknown`, `external-callable`; signature does not grant capture provenance |

The first probe run was 5/7 because two probe assumptions were invalid: an alias duplicated an existing public exposure name (`PUI1006`), and a `RunHandle` parameter crossed the deliberately restricted public-value boundary (`PUI4003`). The alias was given its own name, and the latter probe was retained as an explicit admission-refusal control. Both complete first-run source/results and final source/results are preserved. These were probe-input errors, not repaired product failures.

Before and after SHA-256 values agree for the two reviewed implementation files and `props-update-analysis.ts`. The later archived source bytes also equal those execution hashes. The exact receipt, raw source/results, and matching source snapshots are in [the review archive](./evidence/2026-11-24-compiler-props-capture-review/receipt.json). Five of the seven final probes compile and observe advice; two deliberately fail admission. No native execution or performance evidence is claimed.

The Props advisory retains its prior scope: direct render-time Props reads and the admitted authored invocation graph. A present request does not prove that every Prop change reaches that request; external behavior remains unknown. This review does not change that scope or any existing API/default.

## Additional identity probe: a real defect retained for repair

The integration owner requested a specific follow-up on repeated capture bag reads. The independent source reproduces it without recursion or changing the actual captured object:

```ts
const child = asChild(); // its setup exposes one ordinary method, read
let bag = child.methods;
def.expose.method('refresh', () => {
  bag = child.methods;
});
def.expose.method('readAlias', () => bag?.read?.());
```

The variant with `refresh` incorrectly returned `PUI1007` (finite recursive-callable boundary) after 17,685 ms. Removing only that public assignment callback parsed and validated after JSON serialization in 68 ms. Both probes were bound before and after to `callable-effects.ts` SHA-256 `568e99355e0f076c290e46b6dc652d7e8b23665c024146f7923274769297530d`; the separately archived post-run bytes match. This later source hash is distinct from the earlier seven-probe snapshot.

The cause is an analysis identity error: every `captureMembers` read creates a fresh tracked `methods` record, although the actual frozen public bag is stable. Repeated outward callback analysis joins those synthetic locations and keeps revisiting the callback until the finite limit. This is not evidence that the author's source has unclosed recursion. The archive includes both exact input variants, original diagnostics, and the matching implementation.

### Independent identity successor

After the integration owner added stable per-capture facade records and per-installation child records, the same repeated-bag input parsed and validated in 58.8 ms. Two independent spread controls also passed: a mutable clone can accept an ordinary replacement callback, and replacing it with a callback that illegally calls `state.bool` still refuses with `PUI1007` even when the same outward invocation first re-reads the real capture's `methods`. The cache therefore did not erase that independent mutable clone's write. These three exact inputs and results are retained as `capture-cache-review.*`.

Before/after hashes matched for that execution: callable effects `22b44b5815dea2fee4a08fc7c657df5cbbdd066936b74a3be10ba6107aa47dcf`, expression types `160cdaddcef9c51798902ab1eb02098a8fc45afd5a5084c5fa2afedfd324d62c`, validator `b8ef32a38d694348ffc221dff7df643110795d4918ada24f4060cc856731e535`. The receipt separately states which later source snapshots still matched; no different source is labeled as this execution's snapshot.

The `invalidateHeapFlow` identity early return retains an unrefined original type instead of reconstructing an empty facade as a different data-record representation. Refined types continue through the existing invalidation logic. The source read plus these controls accept this bounded identity repair, not every capture presence condition. The integration owner subsequently found a separate empty-capture `artifacts` presence false proof; its original input and failure live in `compiler-ci-repairs/absent-artifact-red.json` and require a separate successor. That finding is not covered by these three passing identity observations.

### Independent read of the final presence successor

The final read is bound to `callable-effects.ts` SHA-256 `34bd5a87d0e991e627ac1b67697fc1af59a4d554cb54f1b26d577cb601f60c8b`; the expression-types and validator hashes remain the two values recorded above. The empty capture now exposes `artifacts` as absent. A method bag, copied getter or child-derived facade becomes certainly present only from the actual flow alternatives; conditional publication retains its `undefined` alternative. State/Event declaration metadata supplies only a possible inventory, so it cannot make a conditional installation's artifact bag truthy. Optional Event metadata is read safely. The stable facade identity repair and ordinary mutable-spread behavior remain in place.

No additional blocking defect was found in this bounded source review. This closes the pending review of the separate presence correction; it does not turn the earlier identity-only probes into presence tests. Unconditional State/Event-only presence is still conservatively represented as possible, rather than inferred from declaration metadata. The advisory continues to retain unknown provenance and lawful update causes.

The integration owner separately executed the final eight identity/presence regression controls within 28 complete source/negative suites. After retaining an interrupted single-process attempt with no terminal JSON, the same 28-file, 387-case inventory passed in four sequential complete-file partitions (70 + 123 + 125 + 69), with no skipped/pending cases and a passing scoped type check. Those executions and their 587-file source-stability binding belong to the integration owner's separate receipts. This reviewer did not rerun them, and neither this read nor those focused suites are a whole-Compiler or workspace acceptance claim.
