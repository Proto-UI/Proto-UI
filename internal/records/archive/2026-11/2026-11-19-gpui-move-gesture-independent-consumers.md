# GPUI field report: independent non-Scroll consumers of compiled move gestures

Date: 2026-11-19
Status: non-normative engineering record (see `internal/records/README.md`). It does not change any `spec/**` entity, promote a lifecycle, or claim Proto UI conformance.

## Why this record exists

`D-MOVE-GESTURE-0001-D` defers promotion of Move Gesture to a public Module or privileged `asHook` until at least one independent non-Scroll consumer exists, and `D-MOVE-GESTURE-0001-C` keeps threshold, press arbitration and multi-recognizer competition out of the stable guarantee until they are validated.

This record reports one external application that compiles continuous pointer gestures to Rust/GPUI and exercises exactly those deferred areas. It is offered as evidence for a future review, not as a decision.

## Subject

Verdant is a singing-voice editor (a DAW-style desktop application) written in Rust on GPUI, pinned to Zed commit `48741fd17d0dec28be6ad664b0a06dc7202086be`. Its interaction layer uses a small restricted compiler of its own ("GC0"), inspired by the Proto UI separation of protocol, host capability and Adapter. GC0 is **not** the Proto UI compiler, does not read Proto UI prototypes, and nothing here establishes compatibility with `packages/compiler` or `native/gpui`.

GC0 input is a declarative JSON gesture protocol (states, events, ordered guarded transitions, named effects, a projection declaration and required host capabilities). Output is static Rust: a `step(state, event, &guards) -> { next, transition, effects, consumed }` function, a canonical IR and a support report. There is no runtime interpreter. Guards and effects are implemented by hand-written host bindings; the generated step alone chooses transitions and effect order.

## Consumers

Fourteen compiled machines run in the editor. Apart from the original note gestures, all are non-Scroll continuous-move consumers:

| Machine | Host surface | Threshold | Notes |
| --- | --- | --- | --- |
| Note move / duplicate / resize / marquee | note canvas | 3 px mouse, 8 px touch | ordered recognizers on one canvas |
| Fader and pan (track and master strips) | channel strip | immediate | live preview to audio control atomics; one transaction on release |
| Parameter-lane stroke and control-point drag | parameter lane | immediate | pencil/line/smooth/eraser/select-rectangle strokes |
| Pitch drawing | note canvas | immediate | competes with pencil, eraser and note gestures by tool |
| Pencil note creation | note canvas | immediate | zero-length armed preview is never committed |
| Eraser | note canvas | one-shot press | no move phase |
| Region move / trim / fade | arrange regions | immediate | can retarget to another track during the move |
| Tempo event | tempo lane | 3 px (max-norm) | a sub-threshold press still commits as "add event" |
| Phoneme boundary | phoneme timing strip | immediate | bounded by neighbour minimum durations |
| Keyboard audition | piano keyboard | none | press-and-hold; never edits the document |
| Generic value drag | value control | 3 px for numeric scrub, otherwise immediate | **one protocol projected onto eight controls**: automation points, numeric scrub, dialog sliders, vibrato/portamento handles, loop locators, timeline phoneme boundaries, pane splitters, scroll thumbs |

## Observations relevant to the deferred areas

**Single ownership across recognizers (press arbitration).** Every press transition is guarded by one shared host predicate, `pointer_free`, that is false while any machine on any surface owns the logical pointer. Arbitration is therefore a compiled guard, not per-widget convention. Before this was compiled, several surfaces each checked a different subset of "is something else dragging", which is the failure `D-MOVE-GESTURE-0001-B` warns about.

**Threshold is a protocol property, not a host constant.** Machines that need a threshold model it as an `armed` state with a `pointer_threshold_crossed` guard; machines that move immediately have no `armed` state. A host-wide constant would have been wrong for at least two consumers (tempo events and pencil notes) whose click and drag meanings differ.

**Multi-recognizer competition on one canvas** was expressed as ordered offering of the same press to several machines (eraser, pitch tool, pencil, then the note gestures). Each machine's idle state declines input it does not match, and an active machine consumes all input until it returns to idle.

**One protocol, many projections.** Eight unrelated controls share a single compiled value-drag protocol (press, optional threshold, live preview, one commit, click and double-click actions, cancel). Each projection supplies only the press hit, the motion-to-preview mapping and the named commit. Before this, each control stored its drag in its own global state with its own capture and cleanup; consolidating them removed five independent ownership paths.

**Cancellation reasons.** Four reasons reach every machine: escape, focus loss, platform pointer cancel, and a document change underneath the gesture. The last one matters for undo/redo and background edits; it is delivered from inside a transaction where no GPUI `Window` is available, so the capture release is deferred to the next frame.

## GPUI realization notes (relevant to `HC-MOVE-GESTURE-0001-B/C`)

- Ownership uses `Window::capture_pointer(HitboxId)` and `Window::release_pointer()`. Capture and release are only ever emitted as named host effects of generated transitions; a source-scan test fails if any surface calls them directly.
- GPUI delivers mouse-move events to every registered listener, so the host routes Move/Up to a machine only when that machine's preview is owned by the same contact and, for repeated widgets such as faders, the same strip.
- Touch contacts arrive as `TouchDragEvent`; a surface claims a touch drag with `window.prevent_default()` only after its machine accepted the press, otherwise the contact remains a scroll.
- Contact identity, capture and coordinates stay in the host binding; protocols see only typed press/move payloads, consistent with `HC-MOVE-GESTURE-0001-C`.

## Evidence and its limits

- For each machine, every guard assignment and every event sequence up to length five is executed through the generated step. Checked invariants: at most one document write per gesture, only on release or a one-shot press; cancellation never writes and always returns to idle; capture only when leaving idle and release only when returning to it, balanced; idle declines unmatched input and active states consume it. A deliberately injected write on a cancel arm makes the check fail.
- A compiler test rejects, with a located diagnostic, a guard, effect, payload or preview type borrowed from a different host surface.

Not established: a platform input matrix, physical touch hardware, assistive-technology behaviour, or any relationship to Proto UI prototypes, Adapters or conformance tests. The application uses its own document model; its undo semantics are not Proto UI semantics.

## Possible follow-ups (non-binding)

- When `D-MOVE-GESTURE-0001-D` is reviewed, the consumers above may be useful as an external data point for threshold, arbitration and recognizer competition.
- A future host capability for move ownership on GPUI may want an explicit rule for cancellation that originates without a window (document changes), since GPUI only releases capture through `Window`.

Source of the report: Verdant frontend, `frontend/gc0/*.pui-protocol.json`, `frontend/crates/verdant-gc0`, `frontend/crates/verdant-app/src/gestures.rs` and `gesture_protocol_tests.rs`.
