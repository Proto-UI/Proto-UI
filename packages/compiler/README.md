# Private Proto UI compiler

This package is a private restricted-TypeScript compiler and conformance tool. It is not a published compiler release. A target profile is a concrete implementation boundary, not a promise that every TypeScript program or every capability works on every host. Public SSR, Qt and Flutter profiles remain unimplemented. GPUI additionally diagnoses the physical FocusEntry APIs missing from its pinned upstream dependency.

The direct Flutter emitter returns structured Scroll outcomes for its existing position, relative, page, control-drag and to-end requests. Host maps crossing a checked record-union boundary are discriminated by the checked data fields and converted to the same native record classes used by authored values. The first matching checked structural arm wins and projects its declared fields; this does not introduce rejection of extra keys. Common/discriminant member reads such as the returned `kind` use the ordinary member projection. Authored flow-refined reads of `reason` still require the unsupported `narrow` expression. A live owner without a mounted view returns `not-mounted`; an attached view without current controller geometry or the requested axis returns `unavailable`. The canonical `not-declared` reason guards manual host construction without the capability declaration; ordinary authored `asScrollSurface()` installs that declaration before its request handle is available. Only to-end requests alter end-follow request status. The current implementation refreshes geometry and follow facts, rechecks the request's current owner/view/controller identity, then publishes `applied`; subscribers therefore observe those refreshed facts during that publication, as in the current DOM implementation. This records current observable ordering, not a stable cross-host ordering guarantee. Synchronous callbacks cannot deliver a retired request to a replacement view. There is no synchronous Scroll attachment queue in this host, so it does not return `queued`. Anatomy reveal retains its existing unsupported request boundary. These implementation bounds do not establish Flutter Widget execution or native acceptance. Any complete-emitted Widget consumer evidence applies only to the direct emitter: the public Flutter profile remains `implemented: false` with an empty operation list. Nested structural, array and optional-union conversion paths require separate behavioral coverage; the scalar-only Dart fixtures do not exercise Scroll geometry or owner lifetime.

`test/flutter-scroll-outcomes.native.test.ts` is an opt-in real Flutter SDK lane (`PROTO_UI_FLUTTER=/absolute/path/to/flutter`; optional retained output root `PROTO_UI_FLUTTER_EVIDENCE_DIR`). It emits the checked authored fixture and the full native support, resolves SDK-only dependencies offline, and runs `flutter test`. The Widget consumer checks request results against real controller movement, status publication and owner retirement. A separate manual host-boundary probe uses the emitted checked outcome conversion to test discriminant selection, extra-key dropping, invalid fields and single input evaluation; it does not represent an authored undeclared capability or Widget geometry. Without the SDK variable the lane is skipped, not passed. Other compiler suites and private disposable consumers do not replace this repository regression lane.

The direct Flutter emitter currently emits its full native support source verbatim after pruning authored IR values. Its terminal cleanup retains the existing optional module releases; the retired copied Transition helper has no owner field or cleanup entry. This is not per-module support reachability pruning or Flutter profile acceptance.

## The semantic boundary

The frontend resolves source bindings, checks ordinary values and effects, and produces portable IR. Every emitter validates serialized IR again before lowering it. Source identifiers, component names and filenames are not capability identities. A record containing a function is still an ordinary record; a callable does not acquire permission to use a host operation merely because it can be transported through a helper.

IR version 7 represents callable signatures, structural records, lexical cells, checked reads, ordinary calls, default arguments, object spread and exceptions. It preserves binding identities and declaration environments. Source and portable validation both reject structural erasure of callable or owner authority, executable type-signature initializers, invalid flow refinements and unsupported effects. A flow observation must remain valid at the point of the read; a prior check does not survive an intervening call or write that can invalidate it.

The backend receives a checked program and an explicit observable policy. New native artifacts contain ordinary host-language code and the required host primitives. They do not contain a semantic IR interpreter or a copied Transition state machine. The unchanged repository Transition source exercises the same ordinary closure, State, scheduler and presence operations available to another authored hook.

### Observable policy

`proto-ui-observables-v1` describes the following independent decisions:

| Channel | Behavior |
| --- | --- |
| Props input | A complete raw snapshot updates raw/resolved values and notifies the appropriate watchers. Initial hydration is silent. |
| Props update request | `explicit` requires an explicit update intent; `host` adds the host-owned request after a changed post-initial snapshot. |
| State | Writes are synchronous. Each change records the event and subscriber registrations; delivery follows the owner's FIFO queue. Later registrations cannot receive an earlier event. |
| State subscriber failure | Eligible notifications, including reentrant writes, drain before the original failure or ordered aggregate is reported. Falsy thrown values remain failures. |
| Context | Identity is nominal. Writes remain an explicit-update channel; Context notifications retain their own provider/key dispatch contract. |
| Lifecycle | Accepted update intents may coalesce. `updated` follows host commit. View detach preserves the owner; terminal disposal invalidates retained public handles. |
| Public callables | Returned and nested callables enter their owner's callback scope. Repeated projections preserve aliases and refresh record fields. Registry reads are snapshots. |

The established defaults remain: React Runtime and Vue 2 source use host Props updates; React DOM, Vue 3, Web Component and GPUI source use explicit updates. `propsUpdatePolicy` selects another admitted policy. GPUI currently admits only the explicit policy. Adapter comparison metadata names the reference configuration; matching metadata is not a conformance result.

Scalar State domain validation is also profile-specific. The legacy Core/Runtime v0 contract leaves range and enum domain validation open; native Web and GPUI profiles perform their documented checks. Differential claims therefore identify the common admitted input domain. A native validation failure must remain an authored, catchable error and leave the owner usable; it does not establish that every legacy Runtime input has identical native behavior.

Public record fields are projected again at an explicit registry read or public call result. This refresh preserves aliases and guards newly assigned functions before that result crosses the owner boundary. Holding a record does not install automatic tracking of every later external assignment; a mutation with no subsequent read or returned result does not create another projection boundary.

Public callable records require statically known named fields. Portable IR rejects typed index signatures because their dynamic fields have no implemented public projection contract. The opaque `index: unknown` view used by internal `JsonObject` and hook stores remains available inside the checked program and is not a public value contract.

## Source resolution

An authored package publishes its compiler input through the `proto` condition in `package.json` exports. The source loader follows that condition, relative `.proto.ts` imports, aliases and re-exports. It records manifests, resolved files and unresolved lookup candidates so project caching and watch invalidation can detect edits, retargeted exports and a previously missing package becoming available. It does not guess `src` paths from `dist` names or execute a package to discover its definition.

The public package build includes the transitive authored source closure. Runtime exports and source exports are separate package entry points. A source entry can therefore remain readable without requiring a runtime implementation bundle to be executed by the compiler.

```ts
import { compileProject, writeProjectCompilation } from '@proto.ui/compiler';

const result = await compileProject({
  root: '/absolute/path/to/project',
  entries: ['src/button.proto.ts'],
  profile: 'react-dom-source-v1',
});
if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));

// Use the checked writer APIs rather than reconstructing their output paths.
const written = await writeProjectCompilation(result.value, '/absolute/path/to/output');
if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
```

## Host support follows invocation

Creating a closure does not execute its body. The compiler first removes unused values only when their evaluation is proved inert. It then follows known ordinary calls, returned callables, registrations and outward callable values to choose host support. An effectful helper that ignores a callback still executes; transporting that callback does not acquire its host capability.

A function value whose body is proved unreachable can still have observable allocation identity. Native JavaScript emission preserves that allocation and arity while omitting the uninvoked body and defaults. Unknown callable edges invalidate this elision proof and retain the checked support conservatively. This is a compile-time decision, not a runtime fallback. Recursive provenance is bounded; analysis exhaustion cannot be treated as proof that a body is dead.

`src/native-support/plan.ts` declares host helper dependencies, initialization resources and release obligations. Canonical templates are specialized by TypeScript binding analysis into ordinary ES modules. Separate ownership modules preserve logical identity when independently generated components require different support closures.

Three costs have separate evidence:

1. Delivered support source bytes.
2. Bytes retained by a production bundler, including external dependencies such as Floating UI.
3. Actual initialized State, listeners, timers, subscriptions and their cleanup.

Smaller source does not prove smaller linked native binaries or zero initialization. The GPUI fixture measures actual resource initialization against its fixed SDK; it does not claim that the SDK's source length measures linked Rust size.

## Independently compiled libraries

The Web artifact-library API publishes a serializable manifest and ordinary generated modules. It makes the owner of each nominal declaration explicit. Supported declaration kinds are Context keys, Anatomy families, FocusScope keys, FocusRoving keys and A11y references.

`prepareCompilerLibrary` records explicit exports and imports. `writeCompilerLibrary` and `readCompilerLibrary` preserve and validate the artifact set. `linkCompilerLibraries` checks library/profile identity, declaration contracts, dependency closure, shared support ABI and content hashes before the linked writer creates output.

Equal debug names or matching source text do not make two independently owned declarations identical. Two libraries share a declaration only through a resolved import/export edge. Re-exports preserve the original owner; a private declaration remains distinct. Conflicting definitions, cycles in declaration ownership, incompatible support and path collisions are rejected before output mutation.

The library manifest/linker currently covers the Web source artifacts. GPUI's independently generated Rust crates use ordinary Cargo linking and explicit SDK declarations. Those native consumers do not establish support for the Web artifact-library manifest on Rust targets.

## Artifact and SDK compatibility

Serialized IR is versioned separately from generated support ABI. Old IR is rejected with a source-recompilation diagnostic. Exact historical emitted support can be recognized by its recorded byte identity; historical provenance is retained. An old native artifact containing the retired copied Transition implementation is rejected before writes and must be recompiled from source. An unrelated authored method with the same spelling is not a migration marker.

Immutable compatibility sources live under `src/native-support/archive` and the explicitly named legacy modules. They are not a second implementation path for new compilation. Current support verification includes its complete relative import closure and exact content.

The GPUI SDK is version `0.2.0`. Its ordinary-value, Context and nominal-declaration ABI requires native consumers to be recompiled together. Safe constructors and fallible host-facing APIs return `Result` so authored failures cannot unwind across GPUI's entity lease. Native callbacks without a return channel retain the exact failure in the owner's failure queue. See the [actual native consumer fixture](test/fixtures/gpui-ordinary-values/README.md) for the pinned toolchain, upstream revision, safe construction and explicit capability restrictions.

## Evidence required for a change

The compiler repair uses five complementary test categories. A source-string assertion cannot replace the consumer that its claim requires.

| Category | Representative executable evidence |
| --- | --- |
| Rename, alias and re-export invariance | `source-normalization.test.ts`, `source-values.test.ts`, `source-graph.test.ts`; resolved bindings retain identity while same-spelling local declarations remain ordinary values. |
| Source normalization | `source-normalization.test.ts`, `source-values.test.ts`, `ordinary-flow-soundness.test.ts`; equivalent setup/function syntax, lexical ownership, defaults and checked data views normalize without changing execution. |
| Capability composition and independent semantics | `authored-native-consumer.test.ts`, `observable-consumer.test.ts`, `public-callable-consumer.test.ts`, `public-roundtrip-consumer.test.ts`, State notification tests and the actual Rust source-mutation control; generated artifacts execute with explicit observation and lifecycle expectations. |
| Separate compilation, sharing and isolation | `artifact-linking-consumer.test.ts`, package source/watch tests and historical migration consumers; actual linking, private same-name identities, explicit re-exports and zero-write rejection are exercised. |
| Irrelevant closure exclusion and cleanup negatives | `native-support-plan.test.ts`, `native-support-capabilities.test.ts`, `observed-closure-demand-consumer.test.ts`, `delay-detach-consumer.test.ts` and native resource counters; source bytes, retained dependencies, initialization and cleanup have separate evidence. |

Across these categories, source and forged serialized-IR negative controls check both admission boundaries. `authored-native-types.test.ts` checks complete produced artifacts for all five JavaScript profiles under strict TypeScript, including Vue 2's JavaScript output. Runtime comparison and native execution supplement these checks; none is replaced by a source-string assertion.

Native browser tests retain the normal Chromium sandbox. A launch failure or unavailable target is reported as blocked, never as an executed pass. The dedicated GPUI workflow runs a locked default SDK build and generated consumers on Linux and macOS; a workflow definition alone is not a remote validation result. The maintained repair record binds commands and outcomes to their tested revisions.
