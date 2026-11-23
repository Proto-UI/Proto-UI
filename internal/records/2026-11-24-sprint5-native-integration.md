# Sprint 5 native integration and original architecture acceptance

This increment follows the user's request to complete Sprint 5. The inspected
integration base is `1709cd31b1`: Sprint 5 candidate `db747e1b81` combined with
main `d0eb81d3c6`. It preserves the original #1144, #1056 and #687 conditions.
It does not admit a public GPUI Adapter profile, promote a draft contract, or
replace a native execution result with a generated-source result.

## The original native failure and its correction

[Run 45228171867](https://github.com/Proto-UI/Proto-UI/actions/runs/45228171867)
failed the default generated SDK check on both Linux and macOS. The Linux job
`137880232587` reported 99 Rust errors; downstream native consumers were not
executed. The source integration contained several independently developed
pieces without all their corresponding definitions:

- The complete ControlLabel source was appended twice, and `Modules` declared
  its ControlLabel field twice. Both are now emitted once. A generated-source
  regression first failed on both profile-owned and workspace-owned SDK modes
  (two definitions rather than one), then passed after the repair.
- Native view prepaint and module commit called a lost ControlLabel view-receipt
  function. Its current implementation retains the nominal request from the
  newer lowering while restoring physical node/epoch/uniqueness retirement.
  Stable unique or ambiguous views do not repeatedly advance the pair revision.
  An ambiguous live participant cannot be skipped to elect another participant.
  Old hover/move calls now use the current cancellation and full pointer-sample
  operations. App-local native owner enumeration receives the current `App`.
- The retained `NativeScrollTarget` source from the authored-input contribution
  had been lost while its request, lifecycle and consumer calls survived.
  Target identity, exclusive claims, physical availability, lease replacement,
  explicit builtin restoration and target cleanup are restored. The existing
  compatibility engine lease remains separate. Both forms suppress a second
  compiler-root viewport and observe external geometry after child prepaint.
  The later explicit-pause and actual-reader-displacement rules remain in the
  common request/frame path; raw input by itself does not resume following.

These changes reconcile the actual contributions, including
`a6bb128e887dee550ee0bb8436426886931aabef`,
`317860ba5d` and `c356497c86`, rather than adding component-name dispatch or an
empty compatibility implementation. The previously merged duplicate
`scroll_reader` dependency correction is retained.

The independent Adapter job in the same original run reached 13 passing and
one failing `a11y_projection` case. The recorded real Checkbox now sends
`readOnly: false`; the projector did not accept this boolean fact. The repair
retains `Option<bool>` so absent, explicit false, and true remain distinct,
preserves diagnostics for invalid values, and projects the current fact into
the actual AccessKit node. It does not convert read-only into disabled or
remove the authored action. The native-node regression also checks that label,
role, mixed checked state, and action metadata survive the wrapper.

## Executed local evidence and its limits

The local toolchain is Node `24.22.3`, pnpm `10.32.1`, and Rust `1.98.1`.
One worker and one Cargo build job were used. Raw results are retained under
`/workspace/scratch/f7b299133482/native-evidence/` for attachment to the final
candidate receipt.

| Execution | Observed result | Meaning |
| --- | --- | --- |
| SDK assembly negative, `sdk-assembly-red` | 17 passed, 2 failed | Both generation modes detect the duplicated native definition. |
| SDK assembly/control-label/authored-input source selection, `sdk-assembly-green` | 64 passed | The first assembly correction, before the complete native reconciliation. |
| Six source suites, `native-integration-source` | 107 passed, zero skipped | SDK compatibility, ControlLabel, authored inputs, axis sync, published capabilities, and scalar lowering on this candidate. |
| Mandatory headless Rust data consumers, `headless-rust` | 32 passed, zero skipped | Real generated Rust compilation and execution, including artifact/graph and source mutation controls. This is the dependency-free data lane, not GPUI. |
| Current ordinary native producer, `producer-candidate` | 37 generated modules | Unchanged authored sources and generated SDK receipts; generated Rust is not patched. |
| `audit-source-lowering.mjs` | 199 shared operations; 192 profile-listed; 83 reached by these 37 modules; 109 not reached by this producer | A complete static inventory for this producer, not 192 operation runtime passes. |
| Local `cargo check --offline --locked --lib` against pinned GPUI | Exit 101 before compiling generated Rust | The pinned Zed checkout is absent from the local dependency cache. No native pass or new Rust-source failure is inferred. |
| Original independent ControlLabel producer | Base Input rejected at `projectHandle` object spread with `PUI2002` | A further shared IR integration failure, retained separately. The original Input journey has not been removed or reclassified as inapplicable. |

The inventory retains one visible discrepancy: `scroll.bindComposedChrome` is
profile-listed but has no direct GPUI emitter case or generated consumer. Its
status is not accepted merely because the profile includes its name. The
inventory also distinguishes typed numeric/boolean locals and proven data
callables from identity-preserving ordinary record/array `Value` storage.
Complete field-level native representation, optimized retained link bytes,
initialization allocations/registrations, and all accepted operations remain
separate #1056 evidence requirements.

The repaired native SDK must still compile and execute the unchanged consumer
selection on the final Linux/macOS candidate. The Adapter projection and
AccessKit-node tests must execute in its own native workspace. OS input and
assistive-technology delivery have their own evidence; neither source tests
nor direct framework callback calls establish them.

## #687: reconciliation of its four original first-step conditions

The assigned architecture owner remains **HyacinthHaru**. The
[owner-authored architecture decision](./2026-09-22-gpui-adapter-architecture-decision.md)
and its #466 rulings remain authoritative. The
[previous current-source reconciliation](./2026-11-22-sprint5-gpui-adapter.md)
is retained. This section refreshes the original decision packet at the stated
integration base; it does not expand those four first steps into complete
GPUI-on-WASM delivery.

| Original first-step condition | Current concrete reconciliation |
| --- | --- |
| Fresh architecture decision covering Event, A11y, Focus and schema | The peer's `session.ts` uses the reference Runtime, private Event buses and per-epoch data leases. `EventTarget` casts remain type-level Web debt. A11y uses a peer identity ledger and host projection; this increment adds the already-authored boolean `readOnly` fact without completing all roles/relations. Focus uses acknowledged-view readiness, opaque host references and `FOCUS_ORDER_CAP`; the remaining `HTMLElement` cap types stay identified as Web debt. `specAdapterProfileSchema` still models one `@proto.ui/adapter-*` package plus target, not a Rust host/TS peer/protocol/platform bundle. |
| Bounded first fixture with source peer and native plan | Base Button T0 is the existing real Rust host plus Node/TS peer fixture. The independent Adapter workflow explicitly runs the peer protocol, native workspace, eight existing T0 suites and own-window macOS accessibility test. The compiled-source producer/SDK is a different lane. A final candidate must supply fresh native receipts for whichever fixture is accepted. |
| Portable contracts, Web debt and new non-Web requirements classified | Props, State, Context, callback scope, semantic Event dispatch and lifecycle remain in the reference Runtime peer. Native layout, hit testing, window identity, native focus, AccessKit, platform resources and physical Slot composition stay in Rust/GPUI. The strict profile schema and Web-shaped cap types are debt to resolve through their owners. No synchronous guest execution is added to layout/prepaint/paint. |
| Residual risks and owner decisions before public admission | T0 remains transitional; T1 embedded QuickJS and T2 GPUI-on-WASM retain separate decisions. Public multi-artifact profile identity, full Base capability waves, physical input/IME/AT, platform cleanup, and the original browser/WebGL2/single-thread constraints remain explicit future gates. This record supplies a fresh reviewable mapping and does not manufacture owner acceptance. |

The four original deliverables can therefore be reviewed as a bounded decision
packet. Their independent acceptance and any public-profile decision remain
with the existing owners; there is no newly declared `A-GPUI-*` entity.

## Qt and Flutter remain separate

The canonical `qt-source-v1` and `flutter-source-v1` targets still use their
explicit unimplemented admission in `targets.ts`. Experimental emitters and
the independently executed Flutter Widget Scroll consumer are real bounded
work, and remain part of #1144. They do not become complete platform consumers
or disappear as “not applicable” because GPUI now has a repaired candidate.
The original run's Flutter Scroll job succeeded; its result does not establish
every Flutter operation or any Qt platform behavior.
