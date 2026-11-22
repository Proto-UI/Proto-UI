# Sprint 5: current GPUI Adapter acceptance

Agent's request paraphrase: deliver Sprint 5 through a reviewable PR, preserving the original browser compiler, compiled non-Web, independent Adapter and lifecycle conditions. Shenko and OpenGreendam/verdant are actual application consumers. This record covers the independent GPUI Adapter lane of #687 and related #1144/#1178 evidence; the compiler's generated Rust lane has separate results.

Inspected baseline: `dc3b184ba10b0de53e40359c52d012b204b2cd01`, including the GPUI integration contracts from PR #1694. The inherited owner-authored [architecture decision](./2026-09-22-gpui-adapter-architecture-decision.md) remains the topology decision. This is a current-source reconciliation and validation increment, not a new public profile admission or a replacement for its owner rulings.

## Current architecture and original #687 conditions

| Original condition | Current implementation and disposition |
| --- | --- |
| Reconcile Event after #484 | `packages/adapters/gpui-peer/src/session.ts` uses the existing Runtime, adapter-private buses and per-epoch wire leases. `native/gpui/crates/proto-ui-gpui/src/host.rs` projects native handlers and sends data to the peer. Layout/prepaint/paint do not synchronously call the guest. The Event cap's `EventTarget` type and peer cast remain explicit type-level Web debt. |
| Reconcile A11y direct references | The peer maps opaque semantic references through a composition-scoped identity ledger; Rust receives data-only IDs, states, actions and relations. Label additionally verifies native tree/view leases. Current native projection is bounded: `tree.hidden` transport, complete role/relation/description coverage and all-platform AT remain unfinished. |
| Reconcile Focus | The peer uses readiness from the acknowledged projection, opaque focus refs, host results and current `FOCUS_ORDER_CAP`. Rust owns actual `FocusHandle` realization. The public module types still name `HTMLElement`; physical entry/scoped focus and complete text/IME behavior are not established by a root-target cast. |
| Reconcile lifecycle | One Runtime logical owner survives view epochs. The existing session barrier retires child sessions and listener leases before the final terminal notice, rejects inbound work during retirement and retains disposal failures. The source tests include stale ACK/input and terminal-lifetime controls. This does not transfer live State or Context to a new owner. |
| Reconcile profile schema | `specAdapterProfileSchema` still admits one `@proto.ui/adapter-*` package plus target. A multi-artifact Rust host / TypeScript peer / protocol / platform pin is not represented as a newly admitted public `A-GPUI-*` profile. The private package and native workspace retain their current scope. |
| Bounded first fixture | The original Base Button T0 plan now has real Rust host + Node peer tests, followed by Toggle, Switch, view intent, Tabs, Transition, Checkbox and Control Label suites. The source includes mouse/key/focus, native layout, leases and cleanup. A fresh source-bound run is required before accepting these at a new candidate. |
| Portable / Web debt / new host requirements | Existing Runtime, Props, State, Context and lifecycle semantics stay in the peer. Event/Focus type shapes remain Web debt. Native frame projection, window identity, AccessKit realization and the timing of deferrable default actions belong to the host protocol; T0 is honestly distinct from an embedded-engine topology. |
| Remaining admission decisions | The named #687 maintainers retain profile admission and the separate T1/T2 decisions. Full Base waves, platform-specific input/AT/material/cleanup and GPUI-on-WASM protocol/runtime/performance evidence must be completed independently. The original recent-five-years Chrome/Firefox, WebGL2 and single-threaded browser requirements remain in the inherited decision. |

The [native workspace README](../../native/gpui/README.md) and [peer README](../../packages/adapters/gpui-peer/README.md) describe the executable separation. A TypeScript scripted host is useful for semantic transport but does not run GPUI. GPUI's headless test platform runs actual native layout/input machinery with simulated contacts; the real-window macOS accessibility suite is a further, separately recorded observation.

## Three retained failures and responsibility

The complete TypeScript peer/protocol baseline ran 15 files and 159 cases on Node 24.22.3 / pnpm 10.32.1: **154 passed, 3 failed, 2 existing todos**. The three failures reached their original assertions:

| Case | Observed baseline | Owning correction and retained discrimination |
| --- | --- | --- |
| No-feedback-style transport | The fixture used real Base Button, whose authored content-selection contract now emits `select-none`; the old assertion expected `[]`. | Exercise an actually unstyled Prototype and verify that a real delivered press callback runs while no style update is sent. A separate real Button case asserts the exact `select-none` projection, exactly one click signal and no invented dynamic style update. |
| Label activates Switch once | The last Expose message was `percentage: 100`; the test assumed the last field must be `checked`. | Observe the named `checked` field before and after activation (`false` → `true`) and retain exactly-one `checkedChange` and focus-request assertions. Other exposed fields may arrive afterward. |
| Shadcn Select Separator's declared hidden intent | The raw Runtime fixture failed setup because current style-scope selection needs an instance token and parent lookup. | Bind the same real logical owner token to Anatomy and Context, with explicit empty ancestry. Preserve the original `tree.hidden === true` and absent-role assertions before wire serialization. |

After the corrections, the same complete peer/protocol selection ran **15 files, 158 passed, 2 existing todos** (160 total; one additional real Button control). The two todos still identify missing native decorative-tree transport. They are neither skipped former failures nor evidence of native hiding.

Command, with one worker and the shared heavyweight lock:

```sh
corepack pnpm@10.32.1 exec vitest run packages/host-protocol packages/adapters/gpui-peer \
  --maxWorkers=1 --minWorkers=1
```

The unchanged ES2024/esbuild warning appeared in both runs. These results are local TypeScript/host-model evidence on the inspected source plus the stated test corrections. They do not relabel historical CI or certify a later merged source.

## Candidate-bound native execution

The new [targeted Adapter workflow](../../.github/workflows/gpui-adapter-acceptance.yml) runs the existing tests independently of [generated compiler consumers](../../.github/workflows/compiler-gpui-source-consumers.yml). It binds the checkout SHA/tree, both dependency locks, Node/Rust and macOS SDK, installs frozen dependencies, then runs:

1. The complete peer/protocol tests and generated-message/session fixture checks.
2. The native workspace tests.
3. Real-process T0 protocol tests and all eight existing ignored GPUI T0 suites explicitly.
4. The existing own-window macOS accessibility test and its enabled/disabled Control Label captures.

Every selected native invocation receives a terminal exit record, including after an earlier suite fails. Each invocation must report a nonzero passing test count and exit successfully; the two required captures must exist. Logs, captures, source identities and failures are retained as one artifact. The workflow does not convert ordinary `cargo test --workspace`'s ignored T0 tests into executed evidence and does not weaken the main full-cycle recovery policy.

The workflow's YAML and every embedded Bash program were checked locally. Actual hosted execution is recorded separately by run URL and candidate SHA after publication; adding this workflow is not itself a native pass.

### First hosted candidate and recording drift

[Targeted run 45017248297](https://github.com/Proto-UI/Proto-UI/actions/runs/45017248297) was dispatched at published candidate `4ea7e8ffe5f83c08ef38e2fa73775554bbfec0b2`, with the separate Adapter input enabled. The generated-Rust Linux and macOS jobs both reached success. The Adapter peer/shared-vector step failed while the independently aggregated native suites continued; a pending native job is not a passing result.

Read-only local diagnosis at the same source found a passing message-fixture check and four stale session recordings. Current Button adds authored `select-none`; Toggle registers `press.cancel` and advances subsequent leases; Switch exposes `percentage` / `dragging` and sends the new named-state messages. The recording generator's nominally passive Label still passed `{}`, although the actual Label now defaults to activation. Blind regeneration would have turned that accessibility negative control into an actionable Label.

The generator now explicitly passes `activation: false` for its passive Label. Regeneration therefore preserves the existing Label bytes and the native assertion that this text offers no press action. Checkbox also remains byte-identical. Only the Button, Toggle and Switch recordings change, through the real peer generator. Its subsequent `--check` passes for all five recordings. This is an identified, repaired recording failure; the actual hosted log still determines whether the first peer/shared-vector step stopped here or encountered an earlier failure.

## Remaining scope and owners

- **GPUI Adapter maintainers / #687:** complete the remaining Base capability waves, protocol stability and multi-artifact profile admission; retain genuine host/input/focus/lifecycle/AT and cleanup evidence per platform.
- **GPUI-on-WASM owner / #687:** obtain the separate browser-runner decision and execute its original browser/rendering requirements. A canonical compiler running inside QuickJS WASM is a different implementation and supplies none of this evidence.
- **Sprint 5 non-Web compiler lane / #1056/#1144:** validate actual generated Rust and Verdant separately. Preserve Qt/Flutter backend conditions under #793/#792, including their current canonical target rejection.
- **Sprint 5 integration / #1178:** retain these baseline failures, candidate corrections and actual hosted results in criterion updates. A queued full cycle is still queued; the source-ready PR does not override the release recovery or protected-branch review gates.

The complete original Issue conditions remain. Successful bounded validation earns its corresponding subcondition, while public admission, unrun platforms and broader parent closure keep their independent evidence requirements.
