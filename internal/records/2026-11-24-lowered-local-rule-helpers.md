# Sprint 1: closed rule helpers and argument capture

Date: 2026-11-24 (Beijing). This is implementation and local evidence for the continuing #1178 lowered-hook gate. **The complete inventory still fails with 724 unresolved records.** It does not reopen #1457's previously accepted bounded conditions or claim completion of Sprint 1.

## Changes and their boundaries

The preceding [canonical setup escape repair](./2026-11-24-lowered-setup-escape.md) preserves finite rows captured by a real Core setup. This continuation proves one additional source shape: a private same-file named function declaration containing rules, whose complete value-use set consists of direct calls from source-proven authored setups. Each call's actual arguments populate the helper's parameter scope, and the helper retains its declaring lexical scope. The scanner does not infer State origins from a parameter's spelling or TypeScript annotation.

`closed-rule-helpers.ts` rejects export, escape, alias use, reassignment, recursion, unknown callers, dynamic lexical execution, spread invocation, incomplete argument lists, calls preceding the declaration, defaults/rest parameters and asynchronous/generator declarations. A rejected helper keeps its independent declaration scan and its unresolved rows. A closed helper's body is replayed for every admitted invocation, including unknown actual arguments; a known first call cannot certify a later unknown call.

The call visitor captures arguments from left to right before later arguments can rebind an earlier value. A scalar State already captured by an earlier argument remains that State. A borrowed container still observes later writes through the same identity before the helper body runs. Fresh literal and spread copies preserve their own outer members. The existing conservative post-call mutation treatment remains in force; helper admission is not a blanket read-only exception.

The production token collector now retains the source graph of an object literal containing a spread when every candidate graph has proven members. This provides the fresh container identity and authored overwrite order that were absent from its previous property/shorthand-only semantic map. It fixes the concrete case where `{ ...facts }` is captured before a later argument replaces `facts.ready`: the clone retains the original State and now emits its actual variant. Unknown spread graphs retain token inventory without certifying a convenient partial handle map. Ordinary object literals without a spread keep their existing path.

No component name, prototype path, shipped-file allowlist, type annotation, or global public-export assumption is used to establish any of these proofs.

## Independent review found an unsound candidate

The first helper candidate passed its original related tests but an independent argument probe found a real false proof:

```ts
let facts = asA();
paint(def, (facts = asB()) ? facts.ready : facts.ready);
```

Here `paint` reads its second parameter directly as a State. JavaScript evaluates the assignment before either branch and passes the `asB` State. The candidate captured the old `asA` State before visiting the condition, then reported no unresolved subject. Updating container versions afterward could not repair this already captured scalar. This finding invalidates that candidate's proof; its earlier full-file run remains historical evidence, not acceptance of the repaired code.

`helperArgumentBeforeVisit` now admits only a bounded data-expression slice whose value can be captured at that point. It recursively checks object/array entries and member receivers. Member reads and object spreads require plain source-backed members for every source candidate. An opaque member may invoke a getter, so even an otherwise unused earlier property such as `noise: opaque.value` cannot be ignored before a later State read. Pure identifier/literal truthiness conditions are retained; assignments, opaque calls, effectful conditions, unproved member getters, dynamic computed keys and other unsupported internal effects leave the parameter unknown. A direct assignment to a lexical identifier with an admitted RHS is retained because it returns that RHS; member assignment is outside this slice. Source-proven direct authored producers and their supported member paths remain admitted.

The actual expression is still visited **once**, in normal argument order. The repair neither evaluates it twice nor recomputes an earlier captured scalar using later caller bindings. Unknown arguments leave a subject row, while an independent separate-owner rule remains visible.

The regression expansion also found a separate collector failure: the scanner correctly captured a spread clone's original State, but the actual collector omitted its `data-[alpha]:bg-primary` variant. That expectation was retained and repaired in the collector rather than changed to accept missing CSS.

## Executed evidence

All counts below refer to actual local runs; every listed run has zero pending tests. Raw logs and result JSON, including every failing stage, are in the [evidence manifest](./evidence/2026-11-24-lowered-local-rule-helpers/manifest.json).

| Stage | Passed | Failed | Meaning |
| --- | --: | --: | --- |
| Initial helper regressions | 6 | 6 | Four missing positive capabilities and two initially unsuitable same-owner fixture assumptions; the latter were corrected to a separate owner rather than presented as product defects. |
| First helper implementation | 7 | 5 | Preserved failure while fixing borrowed-container version capture and the independent-owner fixture. |
| First bounded helper set | 12 | 0 | Intermediate scope only. |
| Expanded closure/setup/token-map set | 49 | 0 | 21 helper, 8 canonical-setup and 20 existing token-map cases. |
| First related complete files | 141 | 0 | Superseded by the independently found argument false proof. |
| First complete inventory file | 198 | 1 | Historical candidate; original inventory gate failed. |
| Exact effect/ordering expansion | 27 | 8 | Seven stale-capture/opaque-effect controls and one actual spread-clone token omission failed. |
| Conservative argument guard | 34 | 1 | Stale-capture controls passed; the real collector omission remained red. |
| Guard and spread repair | 70 | 0 | 42 helper, 8 setup and 20 token-map cases, including real output assertions. |
| Final related complete files | 162 | 0 | Nine complete files after formatting, with no exclusions. |
| Final complete inventory file | 198 | 1 | Same original 199 cases and 240-second inventory limit; no timeout increase or filtered denominator. |

The final selected TypeScript probe exited 0 with empty output. Its exact configuration and output are archived. This is a scoped source/test type check, **not** a workspace-wide type-check result. The collector retains its pre-existing `@ts-nocheck`; this probe does not claim new strict checking of that file.

The final 199-case file took 54.39 seconds overall (52.44 seconds in tests, 35.12 seconds for the inventory case). The inventory's exact 724-row multiset is unchanged from both the preceding canonical-setup run and the superseded helper run: **no rows added or removed**, comparing full filepath, reason, original expression and duplicate multiplicity. There are still 109 affected files:

| Reason     | Records |
| ---------- | ------: |
| subject    |     550 |
| comparison |      77 |
| intent     |      66 |
| condition  |      30 |
| spec       |       1 |

The declaration-provenance and shaped-attribute expectations after the failed inventory assertion were not reached. These unknown rows are analysis gaps, not a count of independently reproduced product bugs.

## Source binding and review

The final run records HEAD `0b0b861bf18a18d20aa2f0e627ba477dbab463e5` **plus uncommitted candidate files**. A before/after manifest covers 7,577 related package source, test and configuration inputs; all recorded hashes were unchanged during that run. The complete manifests and exact final source snapshots are archived. HEAD alone does not identify the tested candidate.

The superseded helper source and test snapshots were reconstructed by reversing the exact later patch, then verified byte-for-byte against their original pre-run SHA-256 values. The archive states this reconstruction method rather than claiming the snapshots were captured earlier. The independent argument probe's source readback occurred after its execution; its hashes agree with the superseded candidate's pre-run manifest.

Two separate peers performed bounded local reviews. One provided 14 independent lexical/use-closure probes covering shorthand and computed references, deferred return, exports, destructuring/array reassignment, nested callbacks, same-name labels and lexical shadows; all passed against the **superseded** candidate's recorded hashes. That unchanged closure evidence is retained with its original binding, not relabeled as a final-tree rerun. Another found the argument false proof, read the repaired boundary and the unchanged 11-case probe's successor, and confirmed the counterexample is now unknown while the lawful ordering/capture controls remain. Both peers reviewed the final collector spread path and found no blocking issue within that scope. These are local, bounded independent reviews, not a formal GitHub approval, native CI acceptance or full-library green result.

## Remaining full-inventory work

This private same-file slice does not erase exported helper declarations. For example, the 113 unresolved records in Shadcn's `dialog/action-paint.ts` occur in the publicly exported `setupPassiveOverlayAction`; its real consumers live in other source files. Proving selected calls is useful consumer evidence, but it does not prove the export has no other valid caller or justify deleting its independent parameter-origin rows. Other current files include exported helpers with optional/default parameters, conditional presence, finite profile comparisons, imported token maps, and provider projections. Their current source and original expressions remain in the archived inventory.

A whole-corpus extension needs an explicit entry/dependency closure, resolved module and re-export identities, caller-specific parameter/return effects, default/optional handling, and an honest disposition for still-public or escaping declarations. It cannot infer all public arguments from today's few local consumers. The inventory API and original denominator currently remain per-source and unchanged; the present patch does not pretend that an architectural extension has already been delivered.

At handoff, the newer `origin/main` #1751 source-summary changes had not yet been merged into this worktree. The integration owner must validate that combination and its adjacent accessor tests separately. The evidence here must not be relabeled as execution on that future merged tree.
