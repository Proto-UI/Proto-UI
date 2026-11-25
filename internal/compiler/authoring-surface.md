# The 0.4 authoring input

The [authoring contract](../../spec/contracts/C-COMPILER-AUTHORING-0001.yaml) chooses the API spellings below for the already accepted [foundation semantics](../../spec/contracts/C-COMPILER-FOUNDATION-0001.yaml). Its [independent cases](../../spec/tests/T-COMPILER-AUTHORING-0001.yaml) define observable expectations. This page explains those choices and the complete example sources; it does not add a language rule.

**Implementation status.** The shared TypeScript Program reads all three versioned authoring inputs from disk. Compiler-owned typed intrinsic declarations bind `@proto.ui/core/authoring` for source lowering. The historical public Core package has yet to provide that runtime export. The readonly Badge, controlled Toggle and both exports of the async Tabs source have run as ordinary React and native Rust GPUI components. The hosts recorded the same checked IR and source closure for each selected source export. Adapter execution and common-source consumer migration remain open.

The `.proto.ts.txt` files contain complete TypeScript examples outside the ordinary workspace build. The source producer resolves their imports and analyzes reached declarations without executing author modules. General lint still reports `analysisComplete: false`. `sourceValid` is `false` when a violation is proven and `null` otherwise.

## Author-facing operations

The entry remains `definePrototype({ name, setup(def) })`. Existing `@proto.ui/core` consumers retain their historical API until a verified common-source migration is ready. Legal helpers remain ordinary authored functions; the compiler resolves and analyzes their bodies instead of requiring every declaration to appear directly inside one setup body.

| Author operation | Meaning in this input design | Governing foundation criteria |
| --- | --- | --- |
| `def.props.define(schema)` | Declare typed readonly handles; fields select a default or explicit optional presence | `VALUES`, `RESULTS`, `PHASES` |
| `def.state.define<T>(name, { initialize(read) })` | Declare an owned state location and an initializer that runs once per logical instance | `PHASES`, `LIFETIME` |
| `def.derive(name, read => value)` | Pure readonly computation with dependencies from actual reads, including helpers | `DEPENDENCIES`, `TRANSACTIONS` |
| `read.get(handle)` / `renderer.get(handle)` | Read a typed value from the appropriate consistent view | `VALUES`, `DEPENDENCIES` |
| `def.action(name, (run, ...args) => body)` | Declare an action and its concrete argument/outcome types | `PHASES`, `TRANSACTIONS`, `PUBLIC` |
| `run.get(handle)` / `run.set(state, value)` | Read the current segment, including its pending writes, or stage an owned write | `TRANSACTIONS`, `CAPTURES` |
| `def.expose.state(name, handle)` / `def.expose.action(name, action)` | Publish readonly projections and declared actions under semantic names | `PUBLIC`, `CONTROLLED`, `STYLE` |
| `def.expose.event<Payload>(name)` / `run.emit(event, payload)` | Declare a typed event and publish it only after successful segment completion | `CONTROLLED`, `FAILURE`, `EFFECTS`, `REENTRY` |
| `def.event.on(eventName, action)` / `def.lifecycle.onCreated(action)` | Explicitly connect owned input or creation to an action | `PHASES`, `REENTRY`, `LIFETIME` |
| `return renderer => renderer.el(...)` | Declare pure portable view structure and dynamic values | `IR`, `DEPENDENCIES`, `EMISSION` |
| `renderer.child(prototype, { key, props })` | Declare a real typed child invocation with logical key identity | `IR`, `LIFETIME`, `PUBLIC` |
| `tw(...)` selected through pure helpers | Produce style tokens without a second interaction-state owner | `STYLE`, `DEPENDENCIES` |
| `createContextKey<T>(name)` | Declare nominal typed key identity; a shared module key is one legal pattern | `CONTEXT` |
| `def.context.provide(key, read => value)` / `def.context.consume(key)` | Declare a pure provider projection and a required logical subscription | `CONTEXT`, `LIFETIME` |
| `def.task(name, { policy }, async (task, ...args) => body)` | Declare a task owned by the instance, with `latest`, `parallel` or `serial` policy | `ASYNC`, `CAPTURES`, `LIFETIME` |
| `run.start(task, ...args)` / `run.cancel(task)` | Stage explicit task scheduling/cancellation on successful commit | `ASYNC`, `FAILURE`, `EFFECTS` |
| `task.get(handle)` / `task.set(state, value)` | Access the currently executing task segment without exposing a retained writable transaction view | `ASYNC`, `TRANSACTIONS` |
| `await task.await(extern, ...args)` | Example form for an owned async operation with a post-commit host call and typed result | `ASYNC`, `EFFECTS`, `EXTERNS` |
| `declareExtern<Arguments, Result>({...})` | Declare an atomic typed boundary with effect, owner lifetime and target set; actual bindings are still required | `EXTERNS`, `COMPLETE` |

Every legal `await` commits and resumes in a fresh scheduled segment, even for an already-ready value. `task.await` is the examples' explicit operation form; it is not a new ban on other valid owned await expressions. The task capability follows the current segment internally; it never exposes a writable transaction reference that can be held across suspension.

`Presence<T>` in the prop schema is `omitted` or `present(value)`. It is separate from a business `Option<T>`. `Result<T, E>` in the async example is the typed `ok(value)` / `err(error)` result, represented by discriminated records with `kind`, `value` or `error`. An `err` handled by the task is data. Explicit cancellation, latest supersession and owner termination are distinct scheduler outcomes, not fabricated business failures or successes.

The table is not a complete implementation inventory. The foundation also requires checked integers, Unicode scalar operations, typed conversion failure, all effect classes, real view-commit acknowledgements and the remaining independent traces. A frontend can report those missing capabilities without inventing source restrictions. Neither `as` nor `==` is rejected just for its spelling; actual types, origins and defined operations govern admission.

## Complete input 1: readonly Badge

[readonly-badge.proto.ts.txt](examples/readonly-badge.proto.ts.txt) contains the whole prototype and its `badgeStyle` helper. Its motivating consumer is Shenko's transport badge: the caller already owns the transport decision and provides label/tone. This example keeps that responsibility outside the prototype.

| Existing author intent | 0.4 input | Independent observation |
| --- | --- | --- |
| Read caller label and tone | Readonly prop handles | New input updates both public projections and the view |
| Request a render after label changes | Automatic dependency from `renderer.get(props.label)` | Updating the input updates the generated view without an author `watch` or `update` |
| Choose appearance from tone | Pure `badgeStyle` helper and derived style handle | Known tone adds its token; unknown tone retains the common token |
| Keep transport logic in the caller | No transport task, timer or network access | Pure recomputation produces no effects |

The Chromium consumer mounts the generated TypeScript component and reads the DOM label, computed color, nested dot width and public `label` and `tone`. The native headless GPUI consumer reads the same projections and observes the painted label, chip and nested dot on one mounted Rust component. Both cover `Offline`/`offline`, `Connected`/`online` and an unknown tone that retains the common chip appearance. Separate backend controls take checked IR directly. See the [React consumer](../../packages/compiler/test/react-target.node-test.mjs) and [GPUI consumer](../../packages/compiler/test/gpui-target.node-test.mjs).

The authoring contract also requires equivalent behavior when a reached helper is renamed or extracted into shared source. Migrating the registered Shenko source still requires its source manifest, safe transformation and both Adapter and compiler execution.

## Complete input 2: controlled Toggle

[controlled-toggle.proto.ts.txt](examples/controlled-toggle.proto.ts.txt) contains an active-value owner, typed change requests, a disabled guard, a public action and a view. It is a complete controlled-value scenario, not the full Base Toggle definition: focus, accessible semantics, transient pointer/press state, labels and the full semantic-event host path remain governed work.

The `active` prop explicitly declares `optional: true, controlMode: 'fixed-instance'`. Its initial presence selects the schema's controlled or uncontrolled mode. A later value in controlled mode is valid; changing presence within the same logical instance is rejected by that input schema. A new instance/key may select a different mode. Other defined transition policies remain possible; this example does not introduce a language-wide ban on mode transitions.

| Input and action | Actual projection | Request |
| --- | --- | --- |
| Create with present `active: false`, then activate | Remains `false` | `activeChange({ active: true })` |
| Activate again while the owner delays | Still `false` | Another request for `true` |
| Owner rejects the request | Still `false` | No invented acceptance |
| Owner publishes `active: true` | Becomes `true` | Publication is distinct from the earlier request |
| Create with `active` omitted and `defaultActive: true`, then activate | Commits `false` | Request for `false` |
| Activate while disabled | Unchanged | None |

The local initializer executes once. Changing `defaultActive`, hiding or physically remounting that same instance does not reset it. The action's derived reads use its current transaction view, public emission occurs after successful publication, and implicit callbacks queue rather than reentering a partially completed action. Owned input connections and captured handles retire on terminal disposal.

The source producer follows the narrowed `Presence<boolean>` value from `run.get(props.active)` and represents the named fields of the event payload in checked IR. For a component compiled with `--name ControlledToggle`, the React consumer reads `handle.active` and `handle.disabled` and receives `{ readonly active: boolean }` through `onActiveChange`. In Rust, `active: Some(false)` selects controlled mode and `active: None` selects local mode. The host reads `projection().active()` and matches `ControlledToggleSignal::activeChange(payload)` to read `payload.active`.

Both consumers observed typed requests and the actual state described in the table. A rejected same-instance presence change preserved the previously accepted input, including `disabled`, and the next legal update succeeded. Chromium rejected an explicitly supplied `undefined` at first mount. Retained instances preserved their local state through hide/reveal in React and physical reattachment in GPUI. A fresh instance could select a new mode. A GPUI signal subscriber queued host acceptance while its current snapshot still held the prior value. See the [four Chromium cases](../../packages/compiler/test/controlled-source-react.node-test.mjs) and [three native GPUI cases](../../packages/compiler/test/consumers/gpui/tests/controlled_source/mod.rs).

## Complete input 3: Context and owned async Tabs

[context-owned-async-tabs.proto.ts.txt](examples/context-owned-async-tabs.proto.ts.txt) contains a nominal Context key, a typed atomic loader declaration, a pure label helper, an async panel and its owner prototype. The owner exposes `value` and `select`; the panel exposes its discriminated `panel` state, its readonly `label`, and `reload`/`cancel` actions.

This is a selection/loading scenario for authoring design. It does not replace the full Tabs protocol for anatomy, keyboard navigation, activation policy, focus, controlled selection, accessibility or indicator geometry. The example's external loader is an explicit scenario dependency, not evidence that ordinary official prototypes face a new platform-extern blocker.

The created panel explicitly starts loading through `def.lifecycle.onCreated(reload)`. An ordinary Context change only invalidates its pure readers; this example does **not** automatically start another load. A consuming application can invoke the declared `reload` action when it wants that behavior. No renderer or derivation starts a task as a side effect of recomputation.

| Trace | Required observation |
| --- | --- |
| Create at `alpha`; loader result is already ready | `loading(alpha)` commits before a fresh segment handles that result; a host may coalesce painting, but the logical commit boundary remains |
| Start at `alpha`, select `beta` while pending, do not reload | The task remains eligible; captured `requested` is `alpha`, fresh Context read is `beta`, and the authored guard publishes `stale(alpha, beta)` |
| Explicitly invoke `reload` while an older load is pending | `latest` starts the new invocation and withdraws the old invocation's future submission eligibility |
| Loader returns typed `err` | The task handles it and commits the `failed` projection; no automatic rollback is invented |
| Invoke `cancel` | The action commits its explicit `cancelled` projection and cancels owned invocations; no fake loader success/error is generated |
| Replace the nearest provider with an equal-valued provider | Release the old subscription and resolve the new identity; do not cancel solely because Context changed |
| Reorder or temporarily detach the stable keyed panel | Retain the logical instance and owned task while recomputing applicable logical Context/host binding |
| Remove the panel or end its owner | Withdraw submission eligibility and cancel cancellable external work; uncancellable late results cannot write to an old or replacement instance |

The example's visible `cancelled` value is written by the explicit cancel action. Disposal does not write another value into a dead component. Scheduler evidence separately distinguishes completion, explicit cancellation, supersession and owner termination. The task's local `requested` value crosses suspension; its writable transaction view does not.

The synchronous Context fixture exercises nominal provider identity, required reads and stable keyed composition through React and GPUI. Both original Tabs exports also exercise the panel's tagged state, creation-triggered task, fresh reads after `await` and typed `authoring.load-tab` binding. The React consumer uses a loopback fetch and the GPUI consumer reads files. Each independently observes the task and panel outcomes above. Both emitters locate a missing registration at the reached await. [React consumer](../../packages/compiler/test/tabs-source-react.node-test.mjs) · [GPUI consumer](../../packages/compiler/test/consumers/gpui/tests/tabs_source/mod.rs)

## Migration and executable completion

Implement the authoring exports and their Adapter path together with the shared frontend; keep the old API intact in its historical scope until an actual common-source migration is ready. Then record the same entrypoints, resolution configuration and per-file source digests for Adapter and compiler. Host bindings may differ by target; authored component and helper bytes do not.

Upstream owns delivering and verifying necessary official and registered-consumer migrations. Where a general autofix is not yet safe, upstream must finish the concrete migration and establish verified tooling/preconditions instead of transferring a permanent source fork to consumers. The safety boundary prohibits a guessed edit or an unsupported claim of semantic preservation; it does not waive the migration obligation.

The [source/lint projection](source-compatibility-and-lint.md) defines how to report undetermined source, missing implementation, safe migration and the full inventory. The [implementation sequence](atomic-lowering-completion.md) maps all 28 foundation criteria into M1–M3 and the remaining three targets. Badge, controlled Toggle and the selected async Tabs scenario have source-bound observations in React and GPUI. Other primitives, Vue 2, Vue 3, Web Components and Adapter execution of the common source still require implementation and consumer evidence.
