# Sprint 4: ordinary record getter prerequisite

## Scope and original input

This is the current public compiler repair for the getter prerequisite exposed by #893's frozen abrupt-return input. It does not replace the original private IR10 candidate or certify that candidate's full source closure. The original 270-byte input is retained outside the public repository at SHA-256 `afc674007d860620722bcae793d6a982723767db478499a7ec47563bdca65b3a`; its private source body is not reproduced here. The earlier public compiler rejected its getter initializer with PUI1004 before it could exercise the throw-only return path.

The public tests use independently authored examples. The unchanged frozen input is replayed separately through current source parsing, serialized IR validation, and generated consumers. Its source hash and the compiler revision must accompany each receipt. Current execution does not rewrite earlier historical results.

## Implemented contract

An ordinary object literal may declare a static-name, zero-argument getter. Creating the object creates its callable without invoking it. Every member or dynamic element read invokes the real getter body; spreading an object invokes each own getter in ECMAScript key order and creates data properties in the result. A later literal field overrides a copied field only after the earlier getter has executed. An optional data field cannot erase a previous getter when the field is absent. Object.assign retains its fresh data target and direct finite source-literal boundary, including source getters returning finite data.

The getter is readonly. Setters, `this`, computed accessor names, numeric-name syntax, and new descriptor/reflection APIs remain outside this admitted source subset. A quoted numeric string key retains ordinary JavaScript integer-key ordering. A getter body that always throws needs no fabricated return and throws at the actual read, including reads during spread. The generated code uses native JavaScript getters and the actual lowered body; it contains no getter interpreter or source evaluator.

The getter entry and its object field retain `accessor: 'get'` in private IR7. The entry contains a real zero-argument FunctionIR; the field describes its return domain and readonly access. No old field is reinterpreted. Older strict cold-IR readers reject the added marker as an unknown field rather than treating its callable as ordinary data. This additive current-schema representation is distinct from historical private IR10 transport.

Cold validation independently checks each marker, callable, arity, return domain, readonly field, and invocation effects. The shared callable analysis follows getter reads, copies, throws, and possible conditional overrides. Getter creation is inert. The flow checker does not reuse an earlier getter invocation to narrow a later invocation; taking a scalar snapshot first preserves a lawful immutable observation. Type views cannot erase executable getter authority, and getter objects do not cross public data boundaries. Their scalar results and copied data can cross those boundaries.

Module getter literals retain module storage. A module object cannot close over an owner-dependent helper, including one whose default argument needs that owner; moving that existing object into every owner would change its storage semantics. Such input is diagnosed and may instead create its object inside the owner. The check is shared by source and cold-IR admission and follows transitive helper/default dependencies.

## Target boundary and validation

| Surface | Behavior covered |
| --- | --- |
| React DOM source, Vue3 source, Vue2 source, Web Component source | Native getter output; repeated reads; dynamic key reads; copy, overwrite, optional overwrite and Object.assign; real thrown values; key order; two owners of one generated module; disposal guards |
| Explicit React Runtime profile | Real lowered getters through its existing Runtime/Adapter route; separate owner counters; shared module counter; copying, throw and disposal guards |
| GPUI source | Reached getters receive PUI4003; no incompatible Rust getter storage is emitted |
| Qt / Flutter source | Existing unavailable profiles receive PUI4001 before native lowering |
| Typed Rust data artifact | Getter closures remain outside the finite pure module-function selection; PUI_RUST_DATA_PURITY is retained |

Executable evidence lives in `record-getters.test.ts`, `record-getter-consumer.test.ts`, and `record-getter-runtime.test.ts`, with the independently authored `record-getter-fixture.ts`. Ordinary flow, source values, and throw-only-return suites cover adjacent invariants. Private exact-input receipts record current parsing/cold validation and four generated Web consumers without publishing the original body.

The first focused run had 116 passing tests and two existing parameter-default TDZ failures caused by the concurrent dormant-source admission change. The parameter-default declaration obligation was repaired separately while keeping those original negative controls. Getter phase violations report PUI1007, and unavailable Qt/Flutter profiles report PUI4001; the new test expectations were corrected to those established diagnostic layers rather than weakening the behavior assertion. Final executed counts and exact source manifests belong in the integration handoff and PR check receipts.

## Remaining acceptance

Independent review, committed-source validation, ordinary application consumer checks, and PR integration are handled by the Sprint 4 integrator. The original private IR10 candidate's full acceptance remains bound to its own source closure and historical criteria. This record certifies neither a new non-Web getter implementation nor a production browser or hardware acceptance run.
