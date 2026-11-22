# Sprint 5 request ownership and fresh-owner initialization

Status: reviewable implementation and decision record for [#895](https://github.com/Proto-UI/Proto-UI/issues/895) and [#896](https://github.com/Proto-UI/Proto-UI/issues/896). The definitions remain **draft**. This record is non-normative; it does not record independent acceptance, a public SSR target, a release, or closure of the parent compiler and host conditions.

## Selected direction

The Sprint 5 user request asks each lifecycle track to form a decision and then implement it. The earlier issues separated that decision from target admission. The concrete choice for review is:

| Boundary | Selected behavior | Governing draft |
| --- | --- | --- |
| Server request | One real logical owner, setup and created, bounded projection, then terminal disposal; zero host view epochs | `C-LIFECYCLE-REQUEST-0001` |
| Browser hydration or source replacement | A fresh owner with its own State, Context and callback generations | `C-LIFECYCLE-OWNER-INITIALIZATION-0001` |
| Same-owner detach/rebind | The existing active L1 guarantee is retained | `C-LIFECYCLE-0008` |
| Initialization carrier | Explicit finite data with checked encoding and compatibility; no live State, closures, Context scopes, native children or leases | `C-LIFECYCLE-OWNER-INITIALIZATION-0001` |

The alternative of continuing server execution identity in a browser, or automatically migrating arbitrary State between source revisions, is not selected. An application can deliberately carry admitted domain data into a fresh owner. The current controlling owner retains Props authority; a render projection does not authorize restoring hidden mutable cells.

## Implementation ownership

`packages/runtime/src/instance/request.ts` is a private executor of an already trusted Prototype. It composes the existing `createRuntimeSession` and its real disposal/Delay/Context ownership. It does not create another owner framework, evaluate authored source, render HTML, simulate a DOM, or appear in the public Runtime barrel. The caller supplies a serializer; an aborted request settles without waiting for a serializer that ignores cancellation. Later fulfillment or rejection cannot return a successful response or revive a terminal owner.

`packages/runtime/src/instance/initial-data.ts` independently clones finite data for this request boundary. The compiler emits ordinary target-local data guards and strict tagged decoders through `packages/compiler/src/owner-initial-data.ts`. The generated code imports no Proto UI Runtime or Adapter. Native framework children, handlers and style bindings remain local host inputs, separately from the raw data that enters a carrier.

Both implementations use depth 64, 10,000 visited nodes and a conservative 1,048,576-byte ceiling, including field names and per-node encoding overhead. Encoded and decoded trees are each checked; the transport representation can reach a budget before the corresponding in-memory tree. Cycles, nonfinite numbers, sparse or extended arrays, functions, symbols, BigInt, accessors, nonenumerable properties and class instances are rejected. Strict decoders also reject malformed tags and duplicate record keys. Admitted `undefined`, negative zero and ordinary `__proto__` data keys retain their values without inheriting prototype behavior.

These checks assume trusted in-process callers or actual decoded wire data. Reflection can execute Proxy traps; a descriptor guard is not a sandbox for an untrusted live JavaScript object. Source hashes and version checks establish compatibility, not authentication. The application owns provenance, transport trust and domain validation.

## Actual faults and corrections

The existing private SSR emitters had several independently reproduced problems:

- React and WC replaced a created failure with an `AggregateError` from cleanup.
- Falsy errors, especially `undefined`, were treated as absence of failure. Vue could accept an empty HTML placeholder after an authored created callback had thrown `undefined`; Vue 2 also used truthiness for abort and cleanup.
- WC SSR lifecycle dispatch continued through failed created callbacks and lost an `undefined` failure. Failed-created exhaustive cleanup and ordinary fail-fast disposal were not distinct.
- Vue framework scope cleanup could consume an `undefined` disposal failure before the explicit request closer observed it.
- Abort occurring before a subsequent synchronous throw could lose its original reason. Some listeners could throw cleanup errors out of the AbortSignal dispatch path.
- Several array encoders read getters or accepted sparse/extended inputs. The carrier decoders accepted malformed tags and duplicate keys without a bounded whole-tree check.

Explicit failure cells retain even falsy values. Request retirement preserves the first initiating failure or abort reason, tries reachable cleanup, and rejects a normal completion on cleanup failure. One cleanup failure retains its identity; multiple request cleanup failures may be aggregated. Failed-created cleanup attempts all registered beforeDispose callbacks; ordinary disposal retains the canonical first-failure short circuit. Real framework renderers and the generated WC server port execute the regression fixtures.

## Verification receipts

The implementation branch starts from `dc3b184` and uses Node 24 with the repository's pnpm 10.32.1 lock. The browser lane supplies the matched Vue 2 renderer dev dependency and its explicit pnpm peer binding; no third-party version check is patched. The tests import the real Vue 2 constructor and renderer from the Adapter's adjacent dependencies.

| Receipt | Actual result | Scope |
| --- | --- | --- |
| Initial React/Vue 3/WC generated regression before fixes | 16 failed, 20 passed | Original 36-case error/abort subset; failures were retained, not skipped |
| Initial real Vue 2 regression before fixes | 15 failed, 3 passed | Selected 18 Vue 2 cases; the other targets were outside this targeted command |
| Current four generated server targets | 72 passed | Real emitted source, target-native serialization, error identity, cleanup order, abort precedence, finite data, strict decode and canonical rejection |
| Runtime request ownership | 28 passed | Real Session, zero epochs, fail/abort/dispose, stale asynchronous work, Delay, State/Context isolation and identity contrast |
| Runtime finite data | 17 passed | Independent clone, getter negatives, live values, bounds and repeated-reference isolation |

Reproduce the focused runtime and generated server checks with:

```sh
corepack pnpm@10.32.1 exec vitest run \
  packages/runtime/test/contract/lifecycle.request.contract.test.ts \
  packages/runtime/test/contract/lifecycle.initial-data.contract.test.ts \
  packages/compiler/test/request-owner-ssr.test.ts \
  --maxWorkers=1 --minWorkers=1
```

The Runtime and compiler suites use different implementations of data validation and ownership. They are not assertions against one shared semantic interpreter. The generated-source suite executes emitted artifacts, never the original Prototype module. Vue's warning after an intentionally failed setup remains visible; the request is required to reject, not accept the placeholder.

## Remaining acceptance and exact boundaries

All four canonical SSR profiles still reject with **PUI4001**. The private entry paths are conformance candidates. No target registry admission is changed. `T-LIFECYCLE-REQUEST-OWNER-0001` explicitly retains the required missing complete consumer case, including per-target source/compiler/helper/revision binding, application trust, controlled authority, real browser adoption, Context topology, supersession, cleanup and failure recovery. Existing source-only carrier headers are not described as a complete compiler/helper provenance closure.

This work does not implement streaming SSR, async authored setup, a general State snapshot API, remote authentication, non-Web host acceptance, physical input or assistive technology. Synchronous authored JavaScript cannot be preempted; request cancellation is observed at the next boundary. A serializer which ignores its scope can continue its own external work, but cannot publish through the retired executor.

The fresh browser Worker revision lane can dispose its old preview and create a new owner without depending on SSR or state transfer. Its actual browser tests remain separate. Shenko is a real Harness application and OpenGreendam/verdant is an actual compiled Rust consumer; these server fixtures do not claim either application's acceptance or adoption of the candidate revision. Their producer, application revision, upstream pin and actual journey belong in their own consumer receipts.
