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

For React migration, the Runtime Adapter's `autoUpdateOnPropsChange` defaults to `true`; this is an additional host-owned update request. The compiled React DOM source default is `explicit`. Under the explicit policy, receiving changed Props can refresh Rule styles and run watchers while template text remains at its last committed value. A lawful `def.props.watch(['label'], run => run.update())` requests the new text without replacing its owner or DOM nodes. Keep such authored update intents when migrating a consumer; do not add a React key change or an implicit per-prop render. A deliberate compatibility choice can instead select `{ profile: 'react-dom-source-v1', propsUpdatePolicy: 'host' }` at compilation. The selection is recorded in the artifact's `provenance.observableSemantics` and does not change the profile default.

The manual Runtime Adapter receives host-source invalidations lazily, whereas the compiled facade applies its received snapshot immediately. Equivalence tests therefore identify the Runtime synchronization boundary as well as the update policy. [The Adapter matrix and migration guidance](../adapters/react/README.md#props-delivery-and-view-updates) and `test/props-update-policy.test.ts` cover default Adapter / auto-update off / compiled explicit, each with and without the lawful watcher, including style, text, DOM/handle identity, slots, committed lifecycle and repeated updates. `test/sprint1-ownership.browser.test.ts` provides the corresponding browser consumer and records actual CSS. These fixtures preserve the original Shenko reproduction shape; they do not establish complete Shenko or OpenGreendam/verdant application acceptance.

The active [C-PROPS-0014](../../spec/contracts/C-PROPS-0014.yaml) constrains the Props channel, while its `C-PROPS-0014-Q-CORE-UPDATE-OWNER` question about the upstream positive scheduling owner remains open. The draft [observable policy contract](../../spec/contracts/C-COMPILER-OBSERVABLES-0001.yaml) records the selected profile behavior. A future useful missing-update diagnostic must prove the relevant path and respect other lawful update causes and analysis limits. This slice adds no direct-watcher-only rejection and does not close that diagnostic work in #1453.

Scalar State domain validation is also profile-specific. The legacy Core/Runtime v0 contract leaves range and enum domain validation open; native Web and GPUI profiles perform their documented checks. Differential claims therefore identify the common admitted input domain. A native validation failure must remain an authored, catchable error and leave the owner usable; it does not establish that every legacy Runtime input has identical native behavior.

Public record fields are projected again at an explicit registry read or public call result. This refresh preserves aliases and guards newly assigned functions before that result crosses the owner boundary. Holding a record does not install automatic tracking of every later external assignment; a mutation with no subsequent read or returned result does not create another projection boundary.

In `vue-source-v1`, an already-issued external State subscription cancellation remains callable during and after terminal disposal. It becomes inert when the public owner is invalidated; owner teardown clears the remaining subscriptions. Fresh `get`, `subscribe` and `unsubscribe` calls still reject terminal access. While the owner is live, cancellation removes its registration, including during notification delivery.

Public callable records require statically known named fields. Portable IR rejects typed index signatures because their dynamic fields have no implemented public projection contract. The opaque `index: unknown` view used by internal `JsonObject` and hook stores remains available inside the checked program and is not a public value contract.

The four browser source profiles admit keyed `def.props.watchRaw(keys, callback)` against the host-supplied pre-resolution snapshot, following active `C-PROPS-0012` and `C-PROPS-0013`. Initial hydration is silent; later dispatch compares the union of raw keys with `Object.is`, runs matching raw watchers before resolved watchers, and binds `run.props.*` to that dispatch window. Keys may be undeclared, but raw values do not enter resolved props through this API. Registration remains setup-only; the returned cancellation is an ordinary void callable and does not reacquire setup authority. Vue 2 still rejects `props.watchAll` and `props.watchRawAll`; the other profiles retain their independently declared all-key boundaries. Focused generated-consumer regressions are in `test/raw-props-watch-consumer.test.ts` and `test/vue2-native-template.test.ts`.

## Supported source-pinned consumption

The private compiler has a supported Node build and CLI route at an exact reviewed Git revision. It preserves experimental profile status and does not publish an npm package or a stable declaration-file API. From a clean checkout with Node 24 and the frozen pnpm install, run `node --import tsx scripts/compiler/build-pinned.ts --revision <full-40-character-HEAD-SHA> --output <fresh-directory>`. Install the resulting package with `npm ci --ignore-scripts`, then run `node cli.js --build-info`. The executable has one external package dependency, the exact locked TypeScript version, plus Node built-ins. It does not borrow Floating UI from another package.

The [English consumer guide](../../apps/www/src/content/docs/en/build/compiler-guide.md#supported-pinned-source-compiler-build) and [Chinese consumer guide](../../apps/www/src/content/docs/zh-cn/build/compiler-guide.md#受支持的固定源码编译器构建) document the full build, minimal selected-family route, profile lock, generated dependency ownership and create-only output lifecycle. Output parent directories are caller prerequisites. `diff` is read-only; watch publishes immutable revisions; consumer edits use an ordinary target rebuild while preserving historical compiler provenance and maps.

The [Sprint 2 consumer record](../../internal/records/2026-11-22-sprint2-compiler-consumers.zh-CN.md) binds the exercised Base/Shadcn/Brutalist Button consumers, real Shenko application and Verdant producer to separate source revisions and execution receipts. Source admission, ordinary application build, DOM simulation and native browser/platform execution have separate statuses. The record retains the original unsupported inventory and historical measurements rather than replacing their denominator with these selected consumers.

Capture metadata identifies owner-local lexical bindings, while reached module helpers and module data retain their independently validated module dependencies. Portable validation derives this distinction from the declaration scope: copying a module helper into a local alias still creates a local capture. It continues to validate every dependency and compare full capture provenance when a FunctionIR object is shared; incomplete supplied local capture metadata or forging a module dependency as a local capture remains invalid. `test/module-helper-capture-boundary.test.ts` covers this private metadata boundary without changing authored input.

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

The synthesized authored-hook result exposes `render` as the checked setup render callable or `undefined`. Reading or forwarding this field does not execute the fragment. Callable analysis retains its declaration environment, and serialized IR independently checks the projected type. A void hook setup contributes no render field; returning that missing field from the caller preserves the caller's existing default-render behavior. This compiler slice follows the draft asHook result contracts and does not promote their lifecycle.

## Diagnostic origins

Checked source rejections retain their actual available source spans and categories. A failure before a source position is known uses a diagnostic-only sentinel: the known relative source identity where available, otherwise `<unknown>`; `start`/`end` are `-1` and line/column coordinates are `0`. Human-readable diagnostics say `source location unknown`, and supplying source text does not turn that sentinel into a first-line excerpt. JSON preserves the sentinel. Valid IR and generated source maps continue to require real, nonnegative offsets and one-based line/column positions.

Expected file/root/loader rejections and closed snapshots without their entry remain `PUI1003` / `invalid-input`. Unexpected implementation exceptions remain `PUI1999` / `compiler-defect` with the original stack. Both `compileFile` and the public `compileRustDataFile` preserve these distinctions and use the same best-effort relative identity tracing; that tracing never decides filesystem path admission. A checked `CompilerRejection` retains its existing diagnostic. Frontend exceptions use unknown coordinates rather than an invented source location. Source-map attachment failures retain `PUI3005`, their original stack and the available setup span explicitly labeled as context. Public diagnostic presentation keeps its existing absolute-path redaction. `test/diagnostic-origin.test.ts` exercises these public boundaries with deliberate fault injection; it does not admit any additional Hook, Rust target or source-language feature.

`src/diagnostic-registry.ts` retains each code's existing primary category and lists its permitted meaning-specific additional categories. The source drift check validates **every** observed category, including `as const` diagnostic literals; a correct emission cannot hide an added incorrect one. Snapshots preserve the primary category table as well as the complete allowed categories and meanings. For example, `PUI4201` distinguishes invalid library inputs, invalid style IR, and the existing unsupported request to link a non-DOM source profile as a nominal DOM library. This registration does not admit that profile or reclassify its rejection.

Watch retains its existing diagnostic codes and lifecycle contract: a throwing compiler invocation reports `PUI4003` / `compiler-defect` for that failed revision with explicitly retained old output, and a throwing report consumer closes the watch and resolves `finished` with `PUI4004` / `compiler-defect`. Both preserve the original exception stack. Watch diagnostics without an authored location use the same unknown-coordinate sentinel with the `<watch>` context identity; input/native watcher failures retain their existing categories. The deterministic `src/watch.test.ts` controls exercise the public watch orchestration, recovery and cleanup without launching a native filesystem watcher.

Project entry loading retains ordinary file/loader rejections as `PUI4101` / `invalid-input`. Unexpected loader `TypeError`, `ReferenceError` and `RangeError`, and unclassified failures after successful loading, use `PUI1999` / `compiler-defect` with the original stack; a failed attempt publishes no partial generation or entry cache. The CLI retains `PUI9001` / exit 2 for command/configuration errors and `PUI9002` / exit 3 for unexpected failures, with the original stack passing through the existing public path redaction.

Project output, artifact diff/publication, compiler libraries, shared SDK verification and native support migration use unknown coordinates when only an input/output identity is known. This leaves their original input/conflict/write categories and transactional behavior intact. Target selection, IR validation, Rule lowering and Style projection likewise use a diagnostic-only fallback when no authored span is available; actual spans and successful IR/projections remain unchanged. `test/public-diagnostic-boundaries.test.ts` verifies these selected entry/helper boundaries, including zero-write and rollback controls; it does not claim an exhaustive audit of arbitrary malformed JavaScript objects or native-platform acceptance.

## Host support follows invocation

Creating a closure does not execute its body. The compiler first removes unused values only when their evaluation is proved inert. It then follows known ordinary calls, returned callables, registrations and outward callable values to choose host support. An effectful helper that ignores a callback still executes; transporting that callback does not acquire its host capability.

A function value whose body is proved unreachable can still have observable allocation identity. Native JavaScript emission preserves that allocation and arity while omitting the uninvoked body and defaults. Unknown callable edges invalidate this elision proof and retain the checked support conservatively. This is a compile-time decision, not a runtime fallback. Recursive provenance is bounded; analysis exhaustion cannot be treated as proof that a body is dead.

`src/native-support/plan.ts` declares host helper dependencies, initialization resources and release obligations. Canonical templates are specialized by TypeScript binding analysis into ordinary ES modules. Separate ownership modules preserve logical identity when independently generated components require different support closures.

The Web source profiles admit setup-only `asAccessible().part(family, { key })` and structured `relation(kind, { target: { kind: 'part', family, role, key } })` declarations. Source admission and serialized IR validate the nominal Anatomy family and string/State key fields. Reached structured relationships use a shared A11y host service, separate from Anatomy membership: matching requires the identical family, nearest logical root domain, target role and exact non-empty protocol key. Missing or duplicate matches withdraw the source contribution. Key changes, detach, remount and terminal disposal reconcile token leases and host-id reservations without putting host identity into portable state. Linked libraries share this service through the named `part-relationships-v1` support ABI and explicit family imports.

This implements a compiler slice of **draft** `C-A11Y-PART-RELATIONSHIP-0001`; it does not promote that contract or the Collapsible definitions. `test/a11y-part-admission.test.ts`, `test/a11y-part-native.test.ts` and the structured-target case in `test/artifact-linking-consumer.test.ts` define focused source/IR and real generated-output regressions. Their ID/IDREF observations belong to the instance's physical accessibility Root: framework output marks that Root with `data-pui-root`, and a Web Component without a physical-control declaration binds its custom-element host. An authored `r.el(...)` child does not acquire the instance's accessibility identity. Withdrawing the last IDREF token removes its attribute; a later host-authored empty `id` remains a distinct authored value during cleanup. Test source is not an execution receipt. Browser evidence for pre-visibility commit ordering, same-epoch physical replacement, and the full unchanged Shadcn Collapsible consumer remains a separate acceptance boundary. GPUI diagnoses `accessible.part` as unavailable.

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

An embedding Rust workspace can pass `gpuiDependency: 'workspace'` to the compiler API. The generated component and bundled SDK inherit `[workspace.dependencies].gpui`, so the host and component share native types. This mode uses the GPUI element API with a blanket `IntoElement` implementation and cached path IDs, as in Zed revision `48741fd17d0dec28be6ad664b0a06dc7202086be`. The workspace selects its required GPUI features. With `nativeSdkPath`, generate the shared SDK in the same dependency mode. Standalone generation uses the profile's original pinned GPUI revision. Each `gpui-source-v1` output bundles the GPUI SDK as its own `proto-ui-gpui-native` crate. Cargo admits only one package of that name in a workspace, so a consumer with several units emits the SDK once with `proto-compiler emit-gpui-sdk --output <dir>` and compiles every unit with `--native-sdk-path <dir>`. The units then link one SDK crate; its version must match the compiler that produced them.

The CLI exposes the same workspace mode as the API through `--gpui-dependency workspace`, including `emit-gpui-sdk`, `compile`, `check`, `diff` and `watch`. JSON configuration uses `gpuiDependency: "workspace"`. Emit the shared SDK and all components in the same dependency mode:

```sh
proto-compiler emit-gpui-sdk --gpui-dependency workspace --output /absolute/output/sdk
proto-compiler compile src/control.proto.ts --profile gpui-source-v1 \
  --gpui-dependency workspace --native-sdk-path /absolute/output/sdk \
  --output /absolute/output/control
```

Shared SDK compatibility binds the complete compiler-owned source inventory and dependency mode in addition to the SDK version. A file API verifies an absolute shared SDK path against actual bytes. A relative SDK path is relative to the generated Cargo crate and is verified by the checked writer or diff at that output location. Pure `compilePrototype` records the expected SDK identity without claiming a filesystem observation. Project publication also rechecks shared obligations, and watch observes SDK changes even when the authored source is unchanged. Same-version modified SDK source, mismatched mode, missing inputs and unowned build inputs reject; retained output and consumer files are not deleted. Regenerate SDK and components together when their compiler-owned inputs change.

`scripts/gpui/check-cargo-graph.mjs` adds a separate dependency-resolution gate. It runs full `cargo metadata --locked --all-features` without filtering platforms, follows resolved package IDs and checks the actual GPUI Git URL, requested revision, resolved commit and shared SDK identity. Dependency aliases, target-specific tables and build dependencies therefore receive Cargo's real parsing. The [native fixture](test/fixtures/gpui-ordinary-values/README.md) documents its scope and the distinct fresh compilation, Rust execution and OS-input evidence.

### Headless Rust data artifacts

A session that only needs pure decisions can use the separate private Rust data artifact API. This compiles explicitly selected checked module functions and their helper closure into typed Rust functions, with no GPUI, renderer or component owner dependency. It does not instantiate a prototype, execute setup or claim that a conditional Expose registration occurred. Instance methods such as `handle.call_data_method` retain their own registry and lifetime requirements.

```ts
import { compileRustDataFile, writeRustDataCompilation } from '@proto.ui/compiler';

const result = await compileRustDataFile('src/decisions.proto.ts', {
  root: '/absolute/source/project',
  methods: ['plan'],
  crateName: 'editor-decisions',
});
if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
const written = await writeRustDataCompilation(result.value, '/absolute/fresh/data-crate');
if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
```

The result exposes each generated function's Rust name and typed argument/result schema. A caller-supplied `crateName` keeps application manifests independent of source fingerprints. `compileRustDataFile` follows the ordinary declared source graph, including helper imports and `proto` package exports; the receipt records its complete source and resolution inputs. `compileRustDataPrototype` handles supplied source graphs, and `emitRustDataSource` independently validates serialized IR. `rustDataCompilationArtifacts`, `writeRustDataCompilation` and `diffRustDataCompilation` retain the existing checked create-only publication and read-only comparison boundaries.

Cargo license metadata is an explicit caller choice. Pass `sourceLicense` only from the source owner's existing declaration, for example `sourceLicense: 'AGPL-3.0-or-later'` for an application that already declares that expression. The compiler writes that exact value to the generated data crate's `license` field and `provenance.json`; `compileRustDataFile`, `compileRustDataPrototype` and `emitRustDataSource` share the option. Omitting it omits the Cargo license field instead of assigning the compiler's MIT license to translated application code. Generated data crates retain `publish = false`.

This option safely quotes a non-empty Unicode metadata string and rejects control characters or unpaired surrogates. It does not infer licenses from source files, validate an SPDX expression, or determine licensing rights. The separately authored Proto-UI compiler templates and GPUI support SDK keep their own attribution. A license-only option change leaves translated Rust behavior unchanged but changes the manifest and receipt hashes; regenerate artifacts through the ordinary producer instead of editing generated files.

The bounded subset admits immutable scalar, record, array and finite-union computation, checked module calls, defaults, conditionals and supported data operators. Owner operations, mutation, recursive call cycles, nested closures and unimplemented type/operation combinations produce explicit diagnostics. Generated fields and operations are type-directed Rust; there is no generic `Value` map or IR interpreter. Reached language primitives preserve portable numeric/string behavior, and any needed language-support dependency is listed separately from UI dependencies. [The draft data-artifact contract](../../internal/compiler/rust-data-artifacts.md) gives the ownership and evidence boundaries. This private format is not a newly admitted UI target or a stable compiler release.

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
