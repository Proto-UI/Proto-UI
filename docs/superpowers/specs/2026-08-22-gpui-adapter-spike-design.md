# GPUI Host Adapter — Feasibility Spike Design

Status: **Spike / discussion draft** — implements nothing normative. Companion to issue #466.
Requested ruling: port strategy for Event caps, adapter hosting model, and the first
vertical-slice increment (see #466 questions).

## Goal

Validate that the Proto UI runtime contract can be satisfied by a non-DOM host adapter,
using a **TypeScript-hosted GPUI bridge** as the working hypothesis:

- The adapter runs inside the Node/TS process that owns the Proto UI runtime session.
- GPUI owns the window, event loop, painting, focus, and accessibility surfaces in Rust.
- A narrow message bridge connects the two; the adapter translates semantic events out of
  GPUI input messages and projects template commits into GPUI element updates.

This mirrors `D-TEXT-CONTROL-PROJECTION-0001`'s shape: the portable declaration stays
host-neutral while the adapter leases host-native mechanisms.

## Why not Rust-hosted

Re-implementing the runtime (module kernel, state ownership, callback scopes) in Rust is a
rewrite, not an adaptation. It would fork the semantic guarantees that make cross-adapter
conformance meaningful. Rejected for this spike; revisit only if the maintainers prefer a
protocol bridge with a remote runtime.

## Blocking gaps (from #466)

1. Event caps are `EventTarget`-typed (`packages/modules/event/src/caps.ts`). This spike
   ships an **adapter-local shim** implementing the minimal `EventTarget` surface over
   GPUI input messages so required-profile wiring can be exercised end-to-end. If
   maintainers rule for bind→lease redesign instead, the shim is discarded and the spike
   result still stands: the rest of the profile is portable once Event is host-neutral.
2. Focus caps assume `HTMLElement`. The spike defines GPUI equivalents per cap
   (see mapping below) without changing module signatures where avoidable.
3. Template→GPUI projection. The spike supports only `el('div', …)` containers and text
   nodes mapped to GPUI div/text elements — enough for one prototype family end-to-end.

## Cap mapping (spike scope)

| Module | Cap | GPUI realization |
| --- | --- | --- |
| props | `RAW_PROPS_SOURCE_CAP` | normalized snapshot from bridge-owned props store + invalidation on message receipt |
| event | `EVENT_ROOT_TARGET_CAP`, `EVENT_GLOBAL_TARGET_CAP`, `EVENT_CANCEL_DEFAULT_ACTION_CAP` | shim EventTarget fed by GPUI input messages; cancel-default via message reply |
| expose-event | `EXPOSE_EVENT_SINK_CAP` | application callback registered at creation |
| expose-state | `EXPOSES_RECORD_SINK_CAP` | finalized-record publisher into bridge state channel |
| focus | `FOCUS_*` family | element-id keyed registry; readiness on first commit containing the id; sequential order = authored tree order |
| feedback | `EFFECTS_CAP` | token→GPUI style translation for the supported slice only |

Explicitly omitted (recorded in the eventual A-entity): `expose-state-web`,
`rule-expose-state-web`, positioning/overlay/scroll/hit/boundary modules.

## Vertical slice

Button (Base) end-to-end: mount → render label → pointer/key events from GPUI messages →
pressed/hovered/focusVisible facts → outward `click`. Success criterion: the existing
base Button behavioral assertions re-run unmodified against the bridge harness.

## Test harness

A deterministic fake GPUI bridge in TS: scripted input messages, inspectable element
tree, flushed queues. No DOM asserts anywhere; conformance comes from behavior.

## Governance

Package starts `protoUi.release.scan: false`, private `0.0.0` — same posture as
prototypes-brutalist before admission. Promotion to a public `@proto.ui/adapter-gpui`
requires the #466 rulings plus launch-governance classification.
