# GPUI host Adapter architecture decision packet

Date: 2026-09-22

Status: non-normative architecture decision record for #687, authored by the assigned implementation owner. This record does not admit an `A-GPUI-*` profile, a Host Capability, Module, Contract, Adapter relation, package, executable artifact, support-matrix entry, or stable guarantee. It reconciles the inherited #466 ruling against current `main`, fixes the lane boundaries, the first-fixture plan, the contract classification, and the human gates that later pull requests must satisfy.

Refs: #466 (closed maintainer ruling, inherited as entry condition), #467 (closed spike, historical only, not reused), #484 (merged Event kernel), #577 / #578 (Website Browser WASM lane boundaries), #687 (this work), owner ruling comment on #687 dated 2026-09-22.

Baseline: `main` at `9d9552bbe0bc747e9b7f2f1ff6f6db3414086424` (2026-09-22), catalog `0.3.0-alpha.1` with 635 entities. The #466 audit snapshot was `ecf8fc658fe015be2fa0d680ee6617311a128bf4` (2026-08-22).

## Recommendation

1. Keep one semantic authority per running profile: the existing TypeScript `RuntimeSession` executes Prototype semantics; Rust/GPUI owns every host responsibility listed in #466 §1. Reimplementing Runtime semantics in Rust remains rejected.
2. Apply the owner's Rust-first ruling to the **Adapter**, not to the semantic Runtime: the GPUI Adapter is a Rust crate that owns the protocol codec, session/epoch state machine, logical Event lease records, input multiplexing, `FocusHandle` realization, AccessKit projection, and host-owned Slot composition. The guest side is reduced to a minimal binding surface so that the same protocol can later be carried by an embedded QuickJS engine and, eventually, by a language-neutral semantic bundle.
3. Run three topologies over **one versioned host protocol**: `T0` Rust process plus Node/TS peer over local IPC (first fixture, transitional), `T1` in-process QuickJS binding (deployment target of the native lane), `T2` browser WASM (separate lane, blocked until `T0` protocol stability). A profile must declare its topology honestly.
4. Do not require a Runtime lifecycle change for the first fixture. The peer batches every projection that `RuntimeSession` emits synchronously inside `CommitSignal.done()` into one epoch transaction, installs it inactive on the Rust side, and activates it after the host acknowledges. A governed Runtime-level projection transaction (#466 §C) remains a later refinement gated on fixture evidence.
5. Conformance target is the full Base Prototype set in project-history order (owner Q2), starting with Base Button, with capability closure as the only reordering rule inside a wave.
6. The browser WASM lane is admitted only through a separate decision whose hard constraint is Chrome and Firefox releases within five years; that rules out a WebGPU-only renderer and makes a WebGL2 path and a single-threaded build mandatory admission criteria.

## Owner rulings applied

| Question | Owner ruling (2026-09-22) | Applied in this record |
| --- | --- | --- |
| Q1 topology | Mostly Rust Adapter with a very small QuickJS binding; local IPC Rust+Node acceptable as a transitional first fixture; do not freeze v0 topology as permanent architecture; this direction also prepares a future Compiler design | Section "Architecture decision" A and B; `T0` is explicitly transitional; the minimal guest binding is enumerated; the semantic-bundle migration path from #466 §2 is preserved |
| Q2 first conformance target | All Base Prototypes, ordered by project development history | Section "Conformance order" reconstructs the order from the first commits of each family and their capability closure |
| Q3 Event lease model | Owner designs it; review settles it | Section "Architecture decision" D proposes the model with wire shapes and the explicit non-goals it leaves open |
| Q4 WASM admission | Criteria set by owner; hard constraint: mainstream Firefox and Chrome versions from the last five years must run | Section "GPUI-on-WASM lane" derives concrete criteria from that constraint |

The Q1 ruling and #466 §1 do not conflict once the boundary is named precisely: "Rust-first" applies to the host translation layer and its protocol codec; the semantic Runtime remains the reference TypeScript implementation running inside whatever guest engine the topology provides.

## What moved on `main` since the #466 snapshot

Every claim below was checked against the baseline commit.

### Event kernel after #484

- `M-EVENT-0001-I/J` and `HC-DEFAULT-ACTION-0001` now govern transactional listener installation with rollback, fail-closed unbound state, an immutable data-only portable payload, a window-bound default-action control, and rejection of DOM listener options on semantic registrations. Base Button already requests prevention through `ev.control.requestDefaultActionPrevention(...)` (`packages/prototypes/base/src/button/button.proto.ts`).
- `M-EVENT-0001-K` and `HC-EVENT-BINDING-0001-G` add opaque global-input scope and sample identity tokens; these are already host-neutral.
- Still Web-shaped: `EVENT_ROOT_TARGET_CAP` and `EVENT_GLOBAL_TARGET_CAP` return `EventTarget | null` (`packages/modules/event/src/caps.ts`), `redirectRoot` / `redirectSemanticRoot` require an `EventTarget`-like object (`packages/modules/event/src/impl.ts`), and the shared Web router (`packages/adapters/base/src/events/web-event-router.ts`) resolves routes through DOM `composedPath()` and trigger-owner symbols. The open questions `M-EVENT-0001-Q-HOST-BINDING-SHAPE`, `HC-EVENT-BINDING-0001-Q-LEASE-SHAPE`, and `HC-EVENT-BINDING-0001-Q-OPTIONS` remain open.
- Observation that matters for the boundary: every current Web Adapter already dispatches Proto events onto an adapter-private bus (`protoRootBus` / `protoGlobalBus` in the Web router), not onto the DOM element itself. The object the Event module sees is therefore already an adapter-private translation surface; what is not yet portable is the _type_ of that surface.

### A11y direct-reference transport

- `A11ySemanticObjectSnapshot` (`packages/core/src/a11y.ts`) is data plus an unforgeable opaque `objectRef`; relation targets may be strings, `null`, or ordered arrays of opaque refs. `A11Y_PROJECT_CAP` (`packages/modules/a11y/src/caps.ts`) is a projector function with `detach`, `reactivate`, `dispose`, and `clearHeadingLevel`. The Web projector (`packages/modules/a11y/src/web.ts`) owns the id/IDREF ledger; `HC-A11Y-0001-C` requires opaque-ref binding and self-scoped revocation, and explicitly does not require hosts to resolve protocol match keys.
- `nameFromContent()` is stored as `{ kind: 'content' }` (`packages/modules/a11y/src/create.ts`) and the Web projector realizes it by omitting `aria-label`, relying on the browser accessible-name algorithm. The #466 §6 gap is unchanged.
- Pending on top of this: PR #688 (`C-A11Y-PART-RELATIONSHIP-0001`, #549) extends relation targets to structured same-domain part references. The bridge must therefore map `objectRef` and part references to wire identifiers inside the peer and never assume the Web ledger.

### Focus module

- `M-FOCUS-0001` and `HC-FOCUS-TARGET-0001-A/B/C` are cataloged (draft) with logical instance tokens, readiness subscriptions, retained-request retry, and honest `false` on failed application. Those semantics are host-neutral.
- Still Web-shaped: every target-facing cap in `packages/modules/focus/src/caps.ts` is typed `HTMLElement`; `packages/modules/focus/src/center.ts` orders members with `compareDocumentPosition`. `M-FOCUS-0001-Q-PORTABILITY` records exactly this gap.

### Trigger routing

- `HC-TRIGGER-GROUP-0001` and `M-AS-TRIGGER-0001` use opaque instance tokens, parent lookup, and group merge; the only Web-shaped cap is `AS_TRIGGER_GET_GROUP_EVENT_TARGET_CAP: (instance) => EventTarget | null` (`packages/modules/as-trigger/src/caps.ts`). The logical instance tree that resolves chains lives in `packages/adapters/base/src/platform/instance-tree.ts` and is already Adapter-owned, as #466 §4 required.

### Adapter profile schema

- `specAdapterProfileSchema` (`packages/spec/schema/src/index.ts`) is strict: `package` must match `@proto.ui/adapter-*` and `target` is `{ platform, runtime? }`. There is no field for a multi-artifact profile (Rust crate, TS runtime peer, shared protocol, pinned GPUI revision and toolchain). `D-ADAPTER-PROFILE-0001-A/D` (active) require exact package/platform/runtime identity and honest `native` / `translated` / `emulated` roles.

### Runtime commit lifecycle

- Unchanged since #466 §7: `RuntimeHost.commit(children, signal)` (`packages/runtime/src/instance/host.ts`) and `signal.done()` synchronously runs `bindEvents()` and `moduleHub.afterRenderCommit()` before the mount transition continues (`packages/runtime/src/instance/session.ts`). Every Web Adapter calls `signal.done()` synchronously after its local DOM commit (`packages/adapters/web-component/src/runtime/session.ts`).
- The Adapter base already separates owner-lifetime capabilities from view-epoch capabilities: `createViewEpochOwner` plus `HostWiring.rebind` / `replace` (`packages/adapters/base/src/host/view-epoch-owner.ts`, `packages/adapters/base/src/wiring/host-wiring.ts`), and the Web Component Adapter wires them as two specs (`createWebComponentOwnerModules` and `createWebComponentModules` in `packages/adapters/web-component/src/runtime/modules.ts`). The GPUI peer reuses this shape instead of inventing another lifecycle.
- `packages/runtime/src` contains no `HTMLElement`, `EventTarget`, `document`, or `window` reference. The only DOM-typed capability in core is `HOST_ELEMENT_CAP` (`packages/core/src/caps/host.ts`), which is Web-only by name.

### Template, Slot, and Expose

- Template v0 (`packages/core/src/spec/template.ts`) is structural and serializable by contract, has no keys, carries SVG as data nodes (`kind: 'svg-node'`), and reserves `{ kind: 'slot' }`. #466 §5 stands: durable identity exists only for semantic entities.
- Expose records still carry live callables; `createScopedExposesReader` (`packages/adapters/base/src/host/exposes.ts`) depends on JavaScript object identity to route calls into `invokeInCallbackScope`. #466 §8 stands.

### Modules with Web-typed source files at the baseline

`packages/modules/a11y/src/web.ts`, `as-trigger/src/{caps,impl,index}.ts`, `boundary/src/{impl,web/host-bridge}.ts`, `event/src/{caps,impl,kernel,types}.ts`, `expose-state-web/src/{caps,impl}.ts`, `focus/src/{caps,center,create}.ts`, `hit-participation/src/{impl,web/host-bridge}.ts`, `overlay/src/{caps,impl,web/modal-lock}.ts`, `positioning/src/web/floating-ui-host.ts`, `scroll/src/web/create-web-scroll-host.ts`. Some of these are Web realizations of host-neutral capabilities; some are Web-only Modules by definition. The classification section separates them.

### Catalog and prototype growth

- New Base families since the #466 snapshot: Radio Group (2026-08-24), Image (2026-08-30), Input (2026-09-03), Table (2026-09-22, #676). New Modules: Expose Event (2026-08-21), Image View, Table Structure.
- The Website already reserves a non-interactive `'gpui-wasm'` research label in `apps/www/src/components/PrototypePreviewer/HomeDemoPreviewer.astro` (record `2026-08-31-runtime-box-react-reveal-and-browser-runner-readiness.zh-CN.md`). Nothing there is a runner, protocol, or support claim.

### Upstream GPUI

- zed-industries/zed PR #50228 (merged 2026-02-26) "implements a basic web platform for the wasm32-unknown-unknown target for gpui" on the wgpu renderer, including multi-threading support and a `hello_web` example. `crates/gpui_wgpu/src/shaders_webgl.wgsl` exists and decodes instance data from a `texture_2d<u32>` instead of storage buffers, which is the shape a WebGL2 path needs. These are upstream facts observed on 2026-09-22; the exact web backend selection, feature flags, and browser floor still have to be verified against a pinned revision before any lane admission.
- GPUI remains pre-1.0 with frequent breaking changes; a pinned revision is part of every fixture's identity.

## Architecture decision

### A. Ownership

Unchanged from #466 §1. Rust/GPUI owns `Application`, windows, the native event loop, host-owned Slot subtrees, frame projection, layout, hit testing, painting, `FocusHandle` realization, AccessKit projection, native input, and platform resources. `RuntimeSession` owns Module kernels, State, Props normalization, callback scopes, semantic Event dispatch, Focus policy, Expose registries, Prototype execution, and contract-defined ownership.

Non-negotiable execution rule: GPUI layout, prepaint, and paint never synchronously call or wait for JS, IPC, WASM, or any other guest runtime. Input dispatch is not paint; topology `T1` may dispatch into the guest synchronously from an input handler under an explicit time budget (see D).

### B. Topologies and the minimal guest binding

| Topology | Guest engine | Transport | Role |
| --- | --- | --- | --- |
| `T0` | Node.js process running the TS peer | local IPC, length-framed JSON | first fixture; conformance evidence; explicitly transitional |
| `T1` | embedded QuickJS inside the Rust process | in-memory queue | native deployment target of the lane |
| `T2` | browser WASM (GPUI compiled to `wasm32-unknown-unknown`) plus the existing Website JS runtime | in-memory queue inside one page | separate lane, blocked until protocol v1 freezes |

The guest binding is bounded to: `host.send(frame)`, `host.poll() -> frames`, `host.now()`, `host.schedule(delayMs, token)` / `host.cancel(token)`, `host.log(level, data)`. Everything else is protocol data. No JS function, live Prototype, `EventTarget`, `HTMLElement`, arbitrary object identity, GPUI `Entity`, `AnyElement`, or Rust closure crosses the boundary, exactly as #466 §3 requires. The peer must run on Node and on QuickJS without a DOM: it ships its own minimal event bus rather than relying on `EventTarget` / `CustomEvent` globals.

### C. Protocol P

Versioned, transport-neutral, suitable for generated TypeScript and Rust bindings, with a future WIT binding kept possible.

- Handshake: protocol version and feature set, semantic-runtime profile and package version, Prototype bundle id and digest, GPUI revision, Rust toolchain, OS and graphics backend, companion artifacts, topology.
- Identities: `sessionId`, `instanceId`, `viewEpoch`, `commitId`, `routeRevision`, `leaseId`, `sampleId`, `exposeRevision`, `slotRef`, `semanticObjectId`, `focusTargetRef`. Structural Template nodes carry no durable identity.
- Message families: session lifecycle; Props push (JSON per `C-PROPS-0003`); projection transaction (Template snapshot, Slot plan, Event binding plan, Focus plan, A11y snapshot) and its acknowledgement `applied | superseded | unsupported | failed` with `readySurfaces` and diagnostics; activation; input samples; focus facts; content-alternative requests; Expose descriptors and operations; structured lifecycle diagnostics.
- Stale rules: any message carrying an older `viewEpoch` or `commitId` than the current one is rejected with a diagnostic; disposal is terminal and cannot be resurrected by late frames; queues are bounded and coalesce Props and Template snapshots per epoch; transport loss or peer crash disposes host resources for that session.

### D. Event lease model (owner design, review settles it)

Rust side:

- `LeaseRecord { leaseId, scope: root | global, type, viewEpoch, active }` is a persistent logical registration record. A per-window `InputMultiplexer` projects the set of active records into frame-local GPUI handlers on every frame. There is no durable per-lease GPUI callback.
- Release marks the record inactive, gates any handler already painted for the current frame, and requests a refresh so the next frame omits it. Release is idempotent.
- Plan installation is transactional per epoch: validate the complete plan, allocate all records, ACK; on any failure allocate nothing and ACK `failed`. Records are installed inactive; `event.plan.activate { viewEpoch }` switches delivery on. This is the "install inactive then activate" item from #466 §4.
- Input samples are data only: `{ sampleId, type, leaseIds, key, ctrlKey, metaKey, altKey, shiftKey, repeat, pointer? }`. Wrappers for the same native sample share one `sampleId`, satisfying `M-EVENT-0001-K` without exposing the host event.

Peer side:

- The peer provides the Event module with an adapter-private bus that implements only `addEventListener` / `removeEventListener` / `dispatchEvent` over plain `{ type, detail }` objects, the same role the Web router's private buses already play. The bus is not the wire and never leaves the peer. This keeps `M-EVENT-0001-Q-HOST-BINDING-SHAPE` open but does not deepen the debt; a `bindPlan(registrations, deliver) -> leases` capability remains the target shape and should land on the existing Web Adapters first (see follow-up sequence).
- Default action: in `T1` the host dispatches a sample into the guest synchronously from the input path with a budget; a prevention request returned within the budget is applied to the host-local default, otherwise the default runs and a `late-prevention` diagnostic is recorded. In `T0` no synchronous window exists: prevention can only be applied to deferrable host defaults; everything else is `emulated` and must be declared as such in the profile. This is a genuinely new non-Web requirement on `HC-DEFAULT-ACTION-0001`.
- No portable listener options exist in v0 (`HC-EVENT-BINDING-0001-Q-OPTIONS` stays open); a plan carrying options is rejected at validation.

### E. Focus

- Targets cross as opaque `focusTargetRef` values; the Rust side maps each to a `FocusHandle` and reports `applied | not-ready | rejected` plus native `focused` and `focusVisible` transitions, which remain the truth.
- Readiness is a host fact: a `FocusHandle` allocation is not readiness; the surface must be projected in the current frame. The peer keeps `FOCUS_TARGET_READY_CAP` false until the epoch ACK lists the surface as ready, so retained requests retry under `HC-FOCUS-TARGET-0001-C` instead of fabricating success.
- Ordering: the first fixture has one member and needs no ordering, but `center.ts` document-order comparison is a Module-level blocker for any multi-member wave. The Focus module needs an ordering capability supplied by the Adapter (Web: document order; GPUI: projected visual order), which resolves `M-FOCUS-0001-Q-PORTABILITY` and must be evidenced on Web Adapters first.
- Only the directly proven `asFocusable` subset enters the first profile (#466 §4).

### F. A11y

- The peer maintains the ledger `objectRef -> semanticObjectId` and serializes snapshots with ids; ordered opaque relations become id arrays; structured part references from #688 become `{ kind: 'part', ... }` data after that PR lands. Rust projects role, name, description, states, actions, relations, tree behavior, and heading level to AccessKit and revokes its own contributions on view replacement or terminal disposal, per `HC-A11Y-0001-C`.
- `{ kind: 'content' }` names require an explicit host channel: `a11y.resolveContentAlternative { semanticObjectId, slotRef } -> text | labelledBy(ids) | unavailable`. A simple string Slot resolves to text; a complex host subtree needs an App-provided summary; `unavailable` is a diagnostic and blocks any accessibility-name conformance claim for that case.

### G. Slot composition

The Template `{ kind: 'slot' }` marker is the only place App Maker content enters a Proto view. Rust retains the App's GPUI subtree builder and inserts it at the marker inside a layout-transparent `ProtoSurface` element; the subtree is never serialized. Base Button renders through the Runtime's anonymous slot renderer, so its whole view is one `ProtoSurface` with one Slot child.

### H. Expose

Expose crosses as descriptors: `{ states: { name: { revision, value } }, methods: [name], signals: [name] }` with operations `expose.read`, `expose.subscribe`, `expose.call { callId, args }`, `expose.signal { name, payload }`. Values are JSON; a non-JSON state or method result is reported `unsupported` rather than approximated. Calls enter `invokeInCallbackScope` inside the peer. Base Button needs boolean states (`disabled`, `hovered`, `focused`, `focusVisible`, `pressed`), one method (`focusSelf(options)`), and one void signal (`click`). This is evidence for partial Expose portability only.

### I. Prototype bundle manifest

Rust never receives a Prototype object. The handshake names a governed bundle `{ bundleId, digest, runtimeVersion, entries: { 'base-button': { module: '@proto.ui/prototypes-base/button', export: 'default' } } }`. The peer resolves entries; arbitrary import strings over the wire are rejected. `proto.name` is not a cross-process identity.

### J. Platform pin

The first fixture pins macOS with the Metal backend, one exact GPUI revision, and one Rust toolchain. Windows, Wayland, and X11 need separate admission, especially for focus and accessibility. The pin is recorded in the handshake and in the future profile.

### K. Placement and profile representation (proposal)

- Rust: a Cargo workspace outside the pnpm package graph, for example `native/gpui/` with crates `proto-ui-host-protocol` and `proto-ui-gpui`.
- Protocol schema and generated bindings: a private workspace package, for example `packages/protocol/host-bridge` with `private: true` and `protoUi.release.scan: false`.
- TS peer: a private workspace package, for example `packages/adapters/gpui-peer`, following the `createViewEpochOwner` owner/view split.
- Profile: an honest `A-GPUI-*` entity cannot be expressed by the current strict `adapterProfile` schema. The recommended path is a reviewed schema extension `adapterProfile.artifacts[]` with kinds such as `rust-crate`, `runtime-peer`, `protocol`, and `wasm-runner`, each with a name and pinned version or revision. Naming the TS peer as `package` while hiding the Rust crate in prose would violate `D-ADAPTER-PROFILE-0001-A`. This extension is a human gate.

## First-fixture plan

Subject: `P-BASE-BUTTON` through topology `T0` on the pinned macOS platform. It exercises Props, State, Event, Trigger (single-member chain), Focus (single target), A11y, Expose, Slot, lifecycle epochs, and disposal, which is the smallest coherent slice of the Wave 0 capability closure.

Deliverables, each separately reviewable:

1. Protocol v0 schema, generated TS and Rust bindings, and deterministic protocol-model tests for identity, stale rejection, retained state, pruning, idempotent lease release, and terminal disposal. This is the clean replacement scope the maintainer authorized for #467; the old branch is not reused.
2. Rust crate with `ProtoSurface`, `InputMultiplexer`, lease records, focus realization, AccessKit projector, Slot host, and the IPC transport, plus Rust integration tests that drive a scripted peer.
3. TS peer with session owner, epoch transaction batching, private bus, Expose descriptors, bundle manifest loader, and Node tests against a scripted host.
4. The Button fixture binary and its evidence.

Evidence plan. Cases are written against the existing Test families they extend; identifiers below are working names, not catalog entities:

| Working case | Extends | Expected observable |
| --- | --- | --- |
| pointer press lifecycle | `T-EVENT-0003-CASE-SCOPED-TRANSLATION` | `pressed` follows pointer down/up/cancel/leave on the native surface; `click` fires once per `press.commit` |
| keyboard activation | `T-EVENT-0003-CASE-DEFAULT-ACTION-REQUEST` | Enter and Space commit; Space prevention request is recorded; `T0` reports `emulated` disposition |
| focus request and rejection | `T-FOCUS-0002`, `C-AS-FOCUSABLE-0001` | `focusSelf` applies on a ready surface, reports not-ready before ACK, is rejected while disabled |
| focus-visible modality | `T-FOCUS-0002` | keyboard-driven focus sets `focusVisible`, pointer-driven does not; native transition is the source |
| disabled clears transient | `P-BASE-BUTTON` disabled criteria | disabling clears `hovered` and `pressed` and suppresses activation |
| accessibility projection | `T-A11Y-0001-CASE-BUTTON` | AccessKit inspection shows role button, name from content alternative, disabled state, activate action |
| content alternative unavailable | `HC-A11Y-0001` | complex Slot without summary yields `unavailable` diagnostic and no name claim |
| remount and stale epoch | `C-LIFECYCLE-0006` family, `T-EVENT-0003-CASE-REBIND-CLEANUP` | view replacement creates a new epoch; late frames for the old epoch are rejected; no double delivery |
| transactional plan failure | `T-EVENT-0003-CASE-TRANSACTIONAL-ROLLBACK` | injected allocation failure installs no lease and ACKs `failed`; explicit retry installs all |
| terminal disposal and transport loss | `T-EVENT-0003-CASE-REBIND-CLEANUP` | disposal releases leases, focus handle, AccessKit node, Slot; peer crash disposes host resources |
| outward signal | `T-EXPOSE-EVENT-0002` family | `click` reaches the host as a signal descriptor event with no payload |

Visual evidence follows `internal/agent-operations/visual-evidence.md`: recordings of the running GPUI window for pointer, keyboard, focus-visible, and disabled transitions; AccessKit inspector captures for the accessibility rows; measured lease and epoch traces for the internal rows.

## Conformance order

Owner Q2 selects the full Base set in project-history order. The order below comes from the first commit that introduced each family under `packages/prototypes/base/src/**`; catalog entity dates (`P-BASE-*` from 2026-06-30 onward) are not the ordering source.

| Wave | First commit | Families (execution order inside the wave) | Capability closure added by the wave |
| --- | --- | --- | --- |
| 0 | 2026-03-27 `af397f5a` | Button, Toggle, Switch, Tabs, Hover Card, Dropdown Menu | Props, State, Expose (core, state, event), Event, Trigger, Focus, A11y; Tabs adds Anatomy, Context, Collection, roving Focus and ordering; Hover Card and Dropdown Menu add Presence/Transition, Overlay, Positioning, Boundary |
| 1 | 2026-04-04 to 2026-04-12 | Transition, Dialog, Select, shared behaviors (`useEscapeKey`) | Presence semantics, modal Overlay, Hit Participation, Focus scope and entry, Collection with anchored content |
| 2 | 2026-05-06 | Checkbox | same closure as Switch plus indicator part |
| 3 | 2026-07-27 to 2026-08-02 | Scroll Area, Separator, Tooltip, Async Region, Live Region, Textarea | Scroll surface and Move Gesture, live-region A11y, multiline Text Control |
| 4 | 2026-08-24 to 2026-09-22 | Radio Group, Image, Input, Table | Image View, single-line Text Control, Table Structure |

Inside a wave the only reordering rule is capability closure: a family starts after every Module it installs has a GPUI realization with evidence. Wave 0 therefore runs Button, Toggle, Switch, then Tabs, then Hover Card and Dropdown Menu. A wave does not claim conformance for a family whose closure is `unsupported` or `emulated` in the profile; it records the omission.

## Contract classification

### Satisfied by current portable semantics

`M-PROPS-0001` / `HC-PROPS-SOURCE-0001` with JSON Props (`C-PROPS-0003`); `M-STATE-0001`; `M-EXPOSE-0001` registry and `M-EXPOSE-STATE-0001` attenuation inside the peer; `M-EXPOSE-EVENT-0001` / `HC-EXPOSE-EVENT-SINK-0001` as a signal descriptor sink; `M-CONTEXT-0001` / `HC-CONTEXT-IDENTITY-0001` / `HC-CONTEXT-ANCESTRY-0001` and `M-ANATOMY-0001` / `HC-ANATOMY-STRUCTURE-0001` through opaque logical instance tokens owned by the peer; `M-EVENT-0001-I/J/K` transactional binding, data-only payload, and typed default-action request; `HC-TRIGGER-GROUP-0001` chain resolution through the peer-owned instance tree; `HC-A11Y-0001` snapshot transport with opaque refs; Template serialization; structured lifecycle diagnostics; `C-ADAPTER-TYPES-0001` at the TS peer's public types.

### Web debt carried into the fixture (must be declared, not hidden)

- `EVENT_ROOT_TARGET_CAP` / `EVENT_GLOBAL_TARGET_CAP` typed `EventTarget` (peer-private bus stand-in).
- `AS_TRIGGER_GET_GROUP_EVENT_TARGET_CAP` typed `EventTarget` (same bus).
- Focus caps typed `HTMLElement` (peer passes opaque target objects behind the type) and `center.ts` document ordering (single-member fixture only).
- `HC-ANATOMY-ORDER-0001` realized by a DOM order observer on Web; GPUI needs a projected-order observer before Wave 0 Tabs.
- A11y content naming that relies on the browser name algorithm on Web.

### Genuinely new non-Web requirements

- Frame-projection Event leases instead of durable listeners (D).
- Asynchronous host projection with install-inactive/activate and readiness barrier (recommendation 4, E).
- Asynchronous or budgeted default-action decisions (D).
- Rust-owned Slot composition through `{ kind: 'slot' }` (G).
- Explicit content-alternative channel for `nameFromContent()` (F).
- Remote Expose descriptors with JSON-only values (H).
- Governed Prototype bundle manifest (I).
- Session, epoch, revision, stale-rejection, queue, crash, and feature-negotiation rules (C).
- Platform pinning as part of profile identity (J).
- Multi-artifact Adapter profile representation (K).

### Omitted from the native lane by definition

`M-EXPOSE-STATE-WEB-0001`, `M-RULE-EXPOSE-STATE-WEB-0001`, and `HC-EXPOSE-STATE-WEB-TARGETS-0001` are Web-only Modules and will be cataloged under `omits.modules` when a profile exists. `HC-COLOR-SCHEME-INVALIDATION-0001` needs a platform appearance source and is deferred. Overlay, Positioning, Boundary, Hit Participation, Scroll, Text Control, and Image View have Web realizations only and stay uncataloged for GPUI until their wave supplies evidence.

## GPUI-on-WASM lane

Hard constraint (owner Q4): mainstream Chrome and Firefox releases from the last five years must run the artifact.

The floor is a date rule, not a fixed version pair. For an evaluation date `D`, the supported set is every major stable release whose own release date is on or after `D - 5 years`, and the floor is the oldest release in that set. Stating it this way lets the floor roll without re-deciding it, and it is the rule an admission review should re-apply rather than reusing a number recorded here.

Applied at this record's date, `D = 2026-09-22` gives a cutoff of 2021-09-22:

| Browser | Floor at this date | Release date | Nearest excluded major                       |
| ------- | ------------------ | ------------ | -------------------------------------------- |
| Chrome  | 95                 | 2021-10-19   | 94 (2021-09-21, one day before the cutoff)   |
| Firefox | 93                 | 2021-10-05   | 92 (2021-09-07, two weeks before the cutoff) |

Chrome 94 and Firefox 92 both fall outside this window, so neither is part of the constraint; an earlier draft of this record named them and understated the floor. The derived admission criteria below are tied to the corrected floor: WebGPU shipped in Chrome 113 (May 2023) and Firefox 141 (July 2025), so at Chrome 95 / Firefox 93 a WebGL2 path is mandatory regardless of how the cutoff rolls, and the same holds for the single-threaded requirement, which is driven by deployment headers rather than by browser version.

Derived admission criteria, all required:

1. WebGPU cannot be required. Chrome enabled WebGPU by default in 113 (May 2023) and Firefox in 141 (July 2025, Windows first). A WebGL2 rendering path is mandatory; WebGPU may be a progressive enhancement. Upstream `shaders_webgl.wgsl` suggests the path exists; the pinned revision must prove it in both browsers.
2. A single-threaded build is mandatory. `SharedArrayBuffer` requires cross-origin isolation headers, which constrains the Website's Cloudflare Pages deployment and any embedded preview; a threaded build is optional and separately evidenced.
3. Protocol P v1 must be frozen by at least one completed native conformance wave before a browser runner consumes it; the WASM runner reuses the native lane's wire format and semantic bundle and adds no second protocol.
4. Accessibility: AccessKit has no browser backend at the baseline, so a canvas-only runner projects nothing to assistive technology. The lane must either declare `HC-A11Y-0001` as `emulated` through a hidden DOM mirror with evidence, or declare it unsupported. A runner without this decision is not admissible.
5. Artifact and latency budgets are measured before they are fixed: record the pinned `hello_web` baseline size and a Button-fixture input-to-paint latency on a reference machine at 60 Hz, then propose ceilings from those measurements. No number is claimed in this record.
6. Website integration only replaces the existing non-interactive `'gpui-wasm'` research label after a separate runner admission; until then no `RuntimeId`, Adapter preference, or `renderDemo()` path changes.

## Residual risks and human gates

Residual risks:

- GPUI pre-1.0 churn can invalidate a pinned fixture; every wave re-pins explicitly.
- The peer-private bus and `HTMLElement`-typed Focus caps are honest debt; a multi-member wave cannot start before the Module-level ordering and bind-plan capabilities exist on Web Adapters.
- `T0` cannot prove default-action fidelity; only `T1` can.
- The projection transaction dissolves the #466 §7 cycle without a Runtime change only because `bindEvents()` and `afterRenderCommit()` are synchronous inside `signal.done()`; if that lifecycle changes, the peer must change with it.
- AccessKit name computation, focus-visible modality, and platform focus traversal are unverified on the pinned platform.
- The browser lane's WebGL2 and single-thread requirements are derived from external browser facts observed on 2026-09-22 and must be re-verified at admission time.

Human gates before any `A-GPUI-*` profile:

1. Semantic direction: accept this reconciliation of the owner rulings with #466 (this record).
2. Spec change: bind-plan Event capability and Focus ordering capability on the existing Web Adapters, with `T-*` evidence.
3. Schema change: multi-artifact `adapterProfile.artifacts[]` extension or an approved alternative representation.
4. Semantic admission: `A-GPUI-*` draft entity after real pinned macOS fixture evidence for Base Button.
5. Ownership decision: placement of the Rust workspace and private packages in the repository and their release-scan governance.
6. Separate admission for each additional platform and for the browser runner.

None of these are authorized by this record.

## Rejected or deferred alternatives

- Reimplementing the Runtime in Rust: rejected by #466 §1 and reaffirmed; the owner's Rust-first ruling targets the Adapter.
- Treating an `EventTarget`-shaped shim as the final cross-host boundary: rejected as a boundary; permitted only as a peer-private bus with the open questions left open.
- Reviving #467: rejected by the maintainer decision on that PR; only its authorized clean replacement scope (protocol-model fixture) is reused as a scope description.
- WebGPU-only browser runner: rejected by the five-year constraint.
- Starting with the browser lane: rejected; it would freeze a protocol before native evidence exists.
- Starting with Table instead of Button: deferred; Table is the newest family and depends on Table Structure evidence that has no GPUI realization.

## Follow-up work

1. Protocol v0 schema, bindings, and protocol-model tests (private package).
2. Web-first spec work: bind-plan Event capability and Focus ordering capability, resolving `HC-EVENT-BINDING-0001-Q-LEASE-SHAPE` and `M-FOCUS-0001-Q-PORTABILITY` with Web Adapter evidence.
3. Rust crate with pinned GPUI revision and toolchain; scripted-peer integration tests.
4. TS peer package; scripted-host tests.
5. Base Button `T0` fixture on macOS with the evidence table above; `A-GPUI-*` draft proposal and schema-extension proposal submitted together to the human gates.
6. Wave 0 remainder, then Waves 1 to 4 in order.
7. `T1` QuickJS binding with budgeted synchronous default-action evidence.
8. Browser lane research against the six admission criteria, then a separate runner admission proposal.

Review trigger for this record: any change to the #466 ruling, to the owner rulings on #687, to the Runtime commit lifecycle, to the Adapter profile schema, or to upstream GPUI web platform support.
