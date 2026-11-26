# Sprint 1: checked capture facades, actual callable provenance and stable identity

The final bounded verification completes the same **28 full files / 387 cases** in four sequential fresh Vitest processes, with **387 passed, zero failed and zero pending**, followed by a successful scoped TypeScript check. The partition retains every original selected case, worker count and authored deadline. It is not the whole Compiler, workspace type-check or scheduled regression gate.

## The regressions and repair

The exact current three-file reproduction at `f419483e78403817fbe5aa6146caec30ab90352a` had **36 cases: 17 passed and 19 failed**. Fifteen failures were in capture-renderer aliases and four in the actual capture-facade consumers. The 14 release-family consumers already passed, including the integrated Vue Context correction; this repair does not claim those 14 were newly fixed.

Parser admission and portable IR validation disagreed about a checked finite capture facade. Validation now uses the same `checkedSpreadFields` proof as the parser when an object spread crosses that facade. It does not admit an opaque receipt or an open indexed object by calling it a capture.

The callable analyzer now preserves the actual installation behind a copied capture getter. Literal method and child lookups recover that installation's stored source closure, handle or raw capture. Dynamic keys remain unknown, and an external callable's signature does not give it source authority. Outward getter escape still visits the actual reachable method/child callbacks for phase checks. Public receipt buckets retain their opaque boundary.

An independent follow-up exposed a second, real defect in the first repair: assigning `child.methods` back into the same lexical alias from an ordinary public callback manufactured a new analysis record on every read. The finite analysis then falsely reported recursive callable provenance after 17,685 ms. Stable frozen facade records are now keyed by the actual capture; direct-child entry records are keyed by the actual installation and child name. Current branch facts remain in the flow store, so branch joins are preserved. An authored mutable spread is still a separate record and cannot lose its replacement callback merely because the real facade is read again.

The corresponding lexical-flow fix retains an original, unrefined type by identity. Previously, invalidation reconstructed an empty facade into a different data-record representation while the lexical storage type remained unchanged. Refined heap facts continue through the existing invalidation rules.

The integration review also found two actual presence false proofs in an intermediate candidate. An empty hook does not publish an `artifacts` bag. A conditionally declared method does not prove that its getter exists in every installation. Both false proofs could discard a reachable branch that illegally declares State during render. The final analyzer derives certainty from actual method/child flow alternatives, retains absence in conditional alternatives, and treats State/Event declaration metadata only as a may-inventory. It does not promote that metadata to unconditional runtime presence. The two source counterexamples are permanent tests and both retain the required `PUI1007` refusal.

## Verification with the original failures preserved

| Stage | Actual result and boundary |
| --- | --- |
| Original three complete files | 17/36 passed; 19 failures retained in `current.json`. |
| First bounded repair | 36/36; a separate 16-file adjacent execution passed 204/204. Neither accepts the later identity or presence findings. |
| Independent identity probe | Repeated alias refresh falsely refused; the no-refresh comparison parsed and validated. The independent successor accepted the original input plus lawful/illegal mutable-spread controls. |
| First identity control file | 3/6: two child probes incorrectly attempted an opaque render capability, and the third failure was the real lexical representation mismatch. The invalid probe source is retained separately. |
| Corrected identity controls | 5/6 before the lexical fix; 6/6 after it. |
| Presence review | Two real intermediate false acceptances are retained in `absent-artifact-red.json` and `conditional-method-getter-red.json`. Two earlier invalid probe inputs remain classified as probe errors. |
| First 28-file presence candidate | 359/387 passed, 28 failed because optional event metadata was dereferenced; scoped TypeScript also caught that dereference and loss of key narrowing inside a closure. Original JSON, logs and full source snapshots are retained. |
| Corrected 28-file single process | pnpm reported SIGKILL, exit 1, with no terminal Vitest JSON. This is incomplete evidence; the cause of the kill is not established. The planned scoped TypeScript command did not run after the missing-JSON failure. |
| Final four processes, same 28 complete files | 70 + 123 + 125 + 69 = **387/387**, zero failed/pending. Exact file-union comparison proves no selected file was omitted or duplicated. |
| Final scoped TypeScript | Exit 0 for the three changed implementation files and the new eight-case control file with their real imports. This is not the full workspace type-check. |

All 587 selected tracked Compiler source/test files, including the new file, have identical before/after hashes across the final partition. Its parent checkout is `6ccb36ad473b72e75b3b86ee9ea5a5989b73ac5b`; the four changed inputs are identified separately in the [manifest](./evidence/2026-11-24-sprint1-compiler-capture-repair/manifest.json). Their exact bytes, every listed intermediate input/result, and full snapshots for the 28-file failed candidate and final partition are retained in the accompanying archive.

The [independent review](./2026-11-24-compiler-props-capture-review.md) records which probes it executed and which successor it read. It is a separate bounded review, not a fabricated GitHub approval. The Props advisory still distinguishes an actual authored update, an absent request in a proved closed graph, and unknown external behavior. It neither requires a direct watcher nor changes the default host policy.

## Integration boundary

These repairs address concrete Compiler failures observed during Sprint 1 regression work. Remaining lowered-hook inventory findings, the complete Compiler inventory, generated strict types, native shards, package/site checks, mainline integration and the original two valid consecutive regression cycles remain their own gates. The source and receipts above must be evaluated with those later results; a successful selected partition does not close #1178 by itself.
