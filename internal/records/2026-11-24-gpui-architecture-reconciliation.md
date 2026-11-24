# GPUI Adapter: current-main reconciliation of the four #687 first steps

Status: non-normative implementation and acceptance packet. The inherited owner rulings remain the rulings in the [2026-09-22 architecture decision](2026-09-22-gpui-adapter-architecture-decision.md). This packet supplies the current-source reconciliation requested by [#687](https://github.com/Proto-UI/Proto-UI/issues/687); it does not appoint a new owner, invent a maintainer decision, activate a draft, or admit a public Adapter.

The current main read from GitHub is `0fbb52ef832cc27c78e24c28c59a55a16f51d7fe`. The implementation candidate inspected alongside it is `b8800d4cef9302718d4514b1ba28508860059929`. The accompanying source manifest records immutable Git objects and SHA-256 for both. The earlier packet's 2026-09-22 baseline remains historical; it is not silently rewritten as this tree.

## Acceptance denominator

The original issue labels **four required first steps as this issue's acceptance**: current-main architecture reconciliation, a bounded first-fixture plan, explicit contract classification, and residual risks/human gates. The later progress block also describes complete Base waves and GPUI-on-WASM. Those remain implementation workstreams; they are not four additional hidden prerequisites for this first-step packet. This record does not treat their remaining work as delivered.

| Original first step | Current disposition and reviewable result |
| --- | --- |
| Architecture against #466, Event, A11y, Focus and profile schema | The ownership decision remains applicable. The following section identifies what has actually changed, what remains Web-shaped, and the candidate-only native A11y correction. |
| One Base Prototype plus explicit T-evidence plan | Keep the inherited Base Button T0 Rust/Node fixture. Its plan and current executable locations are mapped below. No second first fixture or full-Base denominator is introduced. |
| Portable contracts, Web debt and new host requirements | The three classifications below update the old packet, particularly the now-implemented opaque Focus ordering capability. |
| Residual risks and human gates | The final table identifies concrete decisions needed before profile admission and which existing bounded results cannot resolve them. |

## Ownership and topology decision retained

The native Adapter runs the existing TypeScript Runtime through the private `packages/adapters/gpui-peer` package. Rust owns the window, event loop, physical view and Slot tree, layout/prepaint/paint, native input, `FocusHandle` realization, AccessKit projection and platform resources. Layout, prepaint and paint must never synchronously call or wait for JavaScript, IPC or WASM. Input dispatch and the asynchronous projection protocol remain distinct from painting.

T0 is the implemented first-fixture topology: Rust GPUI plus the TS/Node peer over bounded framed IPC. T1 embedded QuickJS remains the inherited deployment direction; T2 GPUI running in a browser remains separately gated. Neither the browser **Compiler** WASM Worker nor the **Compiler-generated** Rust consumer changes the Adapter's Runtime authority or proves T1/T2. The Rust compiler lane and the Runtime/Adapter lane retain separate fixtures and acceptance evidence.

The current native workspace pins GPUI and its platform backend to `62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`; its declared Rust minimum is 1.85. An execution's actual toolchain, OS, graphics backend, protocol and source digest belong in its receipt. A minimum version declaration is not a run on that version.

## Changes since the inherited architecture packet

### Event and input

The semantic Event kernel remains the authority for transaction, callback and default-action semantics. The peer's `bus.ts` implements plain callback registration and `{type, detail, sampleId}` delivery without requiring a DOM EventTarget global. The bus is private to the peer; it is not a wire value. Session code still mints leases for registrations and sends explicit release operations.

The exported Event root/global capability types and the Trigger group-target type still use `EventTarget`. The private bus makes the current T0 bridge possible; it does not settle the public host-binding type decision. Frame-local GPUI handlers, logical persistent leases, stale epoch rejection and inactive-plan activation remain required. T0 cannot manufacture synchronous default-action authority across IPC; any emulation must be declared. No new synchronous guest call from a paint callback is authorized by this reconciliation.

### Accessibility

The peer's actual `toA11yWire` maps semantic object references through a shared composition-tree ID ledger. It handles string/null relations and ordered arrays; unsupported relation object shapes produce a diagnostic and a null wire relation. Names are explicitly represented as text or content. General structured part relationships must not be inferred from this bounded wire implementation.

ControlLabel has a separate typed association channel and physical view-lease rules. Its existence does not make all A11y relationship shapes supported. The candidate also fixes exact `readOnly` boolean projection: `Option<bool>` separates absence from explicit true/false, and the real node sets or clears the state. This candidate-only change is absent from the inspected main. Other native A11y roles, values, relations and platform behavior retain their own admission limits.

The earlier source-bound Adapter runs include actual native T0 and real-window AccessKit checks, as recorded in [the native execution packet](2026-11-24-sprint5-native-execution.md). An AccessKit tree check is not an OS assistive-technology reading session. Those results remain attached to their original source and are not a new main execution.

### Focus: the ordering debt has changed

The old packet's statement that Focus ordering still lives in a DOM comparator is no longer the current boundary. `FOCUS_ORDER_CAP` takes and returns opaque objects. It supplies one total order for the entire requested set, or no order; the Focus module then keeps registration order for the whole navigation. The peer answers synchronously from the most recent host `projection.order` snapshot. A missing member makes the complete set unorderable. There is no IPC round trip per key.

`HC-FOCUS-ORDER-0001` remains draft. Its recorded bounded T0 evidence includes horizontal Tabs, whole-set fallback and host surface replacement. The order is surface-tree document order, not geometric/visual order. Cross-tree Web ordering, GPUI scope/vertical-key combinations, other platforms, AT and WASM remain open. Other target-facing Focus capability types still use `HTMLElement`; adding the opaque ordering capability did not remove that remaining public type debt.

Readiness is still a host fact. The peer returns false before a current target is ready. A ready T0 request sends a typed focus operation and returns undefined because application cannot be observed synchronously; later native focus/blur samples provide the result. It does not report immediate successful focus merely because a request was queued.

### Adapter profile schema

The current strict `specAdapterProfileSchema` still contains only the official `@proto.ui/adapter-*` package name and target platform/runtime descriptor. It has no artifact list, protocol revision, GPUI pin or topology fields. No `A-GPUI-*` profile was found in the current Adapter catalog. The inherited multi-artifact schema proposal remains a maintainer decision; naming only the private TS peer would not describe the complete Rust/peer/protocol implementation.

## Bounded first-fixture plan and evidence mapping

Retain Base Button through T0 on an explicitly pinned native platform. Reuse the original packet's eleven T-evidence rows; they remain the plan, not eleven newly asserted successes. The current implementation has a real Rust host, private TS peer, generated protocol/session fixtures and `button_t0.rs` consumer. Generated fixture JSON must continue to come from the repository generators.

| Observable boundary | Contract/Test family retained | Current executable or evidence owner |
| --- | --- | --- |
| Pointer press, Enter/Space and scoped prevention | `T-EVENT-0003`, `P-BASE-BUTTON` | Native Button T0 consumer, input routing and peer lease traces; declare T0 default-action disposition. |
| Ready/not-ready focus, disabled refusal and modality | `T-FOCUS-0002`, `C-AS-FOCUSABLE-0001` | Button T0 and native Focus facts; retain pre-ACK refusal. |
| Button name, role, disabled state and activation | `T-A11Y-0001-CASE-BUTTON`, `HC-A11Y-0001` | Native AccessKit projection and actual real-window node checks; complex Slot without a content alternative remains diagnostic. |
| Slot and outward click signal | Template and Expose Event contracts | Host-owned Slot subtree plus peer signal descriptors; no live guest closure crosses the wire. |
| Rebind, failed install, stale frame and terminal disposal | `C-LIFECYCLE-0006`, `T-EVENT-0003-CASE-REBIND-CLEANUP` | Shared protocol vectors, native T0 fixtures and session epoch/lease traces; scripted peers alone are not native conformance. |

Later families retain the inherited history/capability order. The existence of Toggle, Switch, Tabs, Transition, Checkbox or Label consumers does not accept an unexecuted family, full theme/input matrix or every platform.

## Updated contract classification

| Class | What remains in this class |
| --- | --- |
| Existing portable semantics reused | Props/State, callback authority, Context/Anatomy identity, semantic Event transactions, logical Trigger chains, Expose registry and bounded wire data remain governed by their existing definitions. The private peer executes the Runtime; current-source host evidence is needed for each translation. |
| Web debt carried honestly | Event/Trigger target types, remaining HTMLElement-shaped Focus capabilities, Web content-name assumptions and unsupported relationship forms are still explicit. Whole-set Focus ordering has a host-neutral capability now and is no longer classified as an unimplemented DOM-comparator prerequisite. |
| Native host obligations | Logical Event leases over frame-local handlers; asynchronous projection/activation/readiness; default-action timing; native Slot ownership; content alternatives; remote Expose; bounded sessions, epochs and queues; pinned platform/toolchain; multi-artifact profile representation. |

Web-only Expose State modules remain separately omitted by definition if and when a profile is admitted. Uncataloged modules remain uncataloged, rather than being silently counted as supported or unsupported. A successfully compiled consumer, pixel capture or rejected unsupported operation proves only its recorded scope.

## Residual risks and human gates before public admission

| Gate | Concrete decision/evidence still required |
| --- | --- |
| Public profile identity | Maintainers accept the representation of Rust crate, TS peer, protocol, topology, version ranges and pin; explicit supported/omitted/uncataloged modules and native/translated/emulated roles follow `D-ADAPTER-PROFILE-0001`. |
| Public portable interfaces | Resolve Event/Trigger binding shape and remaining Focus target typing; accept the applicable draft capability boundaries and compatibility consequences. |
| Native behavior and resource limits | Choose supported platform/backend/toolchain combinations and budgets, then accept actual input, lifecycle, accessibility and failure/transport-loss evidence for each declared combination. |
| A11y semantics | Decide general relation and content-alternative support; independently verify applicable platform AT. Real-window AccessKit success is retained within its measured boundary. |
| T1 deployment | Accept the embedded-engine protocol, queue, input/default-action timing and lifecycle evidence before declaring it supported. T0's success does not establish T1. |
| T2 browser GPUI | Preserve the inherited five-year Chrome/Firefox constraint; separately verify the pinned renderer/fallback, single-thread path, real browser runner, artifact/input budgets and conformance. Browser Compiler WASM results do not satisfy this gate. |

These gates are explicitly retained for the future support decision. They do not change #687's original four first-step deliverables into a requirement to finish all GPUI, all Base components or the browser-GPUI lane before this packet can be reviewed. Independent review and any issue disposition must name this bounded denominator and must not fabricate the original owner's or a maintainer's approval.
