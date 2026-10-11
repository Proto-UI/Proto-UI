# Shared material intent: proposed public boundary

Agent: dot. ModelTrace: not measured (owner-authorized exemption). Status: root-reviewed direction, corrected on 2026-10-06; first shared data/policy candidate. No provider or stable public author-API admission.

## Decision and scope

The maintainer distinguished two intents on 2026-10-06:

1. `liquid-glass` requests Proto UI's own optical implementation. An OS blur or native glass view cannot fulfill this request, even when visually similar.
2. `adaptive-blur` requests the best eligible platform blur material for the current OS/version and the requested sampling scope, including a real in-app browser compositor where applicable. It does not request a particular branded material or the custom optical model.

This changes the old `refractive` plus `native-semantic` / `portable-model` fidelity vocabulary. Intent, actual backend, visual quality, source scope and the reason for fallback are distinct facts. No implicit conversion between the intents is allowed. Explicit fallback remains an opaque, theme-correct presentation, never a substituted transparent material.

The existing private `experimental/feedback-material-v1` declaration is a WC/owned-scene/button-press experiment. Its provider and source-specializer evidence remains useful for that profile. It is neither the new common author surface nor proof that other families, Adapters or Compilers support material.

## Proposed finite schema

The common Core data boundary is `MaterialCandidate`, with strict own-field validation and deep immutable copies:

```ts
type MaterialCandidate =
  | {
      intent: 'liquid-glass';
      variant?: 'regular' | 'clear';
      deformation?: { kind: 'press'; phase: 'rest' | 'pressed' };
    }
  | { intent: 'adaptive-blur'; tone?: 'system' | 'light' | 'dark' };

type MaterialSourceRequest =
  | { kind: 'owned-scene'; slot: string }
  | { kind: 'in-app-backdrop' }
  | { kind: 'behind-window' };

type MaterialSlot = {
  version: 2;
  shape: { kind: 'rounded-rect'; geometry: 'style' };
  source: MaterialSourceRequest;
  fallback: { fill: 'style'; foreground: 'style' };
};
```

A static surface can directly request `{ intent: 'liquid-glass' }`. The concrete `heightfield-v1` implementation is a host profile, not a required author model. The optional finite press deformation consumes existing state when requested; future parameters require governed schema changes, not arbitrary shader input.

`slot` is a bounded logical identifier, not a URL, resource, texture, handle or permission. Only a host-owned binding can resolve it into an eligible source lease. A logical source request never grants access to other windows, desktop, screen capture, files or network resources. `behind-window` is eligible only when the native compositor actually provides that scope without capture.

`fallback.fill = 'style'` designates the unique final post-patch opaque style fill as the slot's fallback input; the final text foreground is the existing style-owned text result. The host resolves both colors before admitting any candidate. This preserves existing theme ownership without hard-coded light colors or a second palette API. Missing/nonopaque/ambiguous fill, unresolvable palette, selector-dependent provenance, competing background-image/backdrop/ coat or an unreadable foreground rejects material admission. It must not clear the legal original style while reporting a valid fallback. A successfully resolved slot owns and suppresses only the normalized material paint channels; border, layout, text and unrelated consumer paint retain their owners.

This explicit designated-fallback rule is a normative change from treating every style fill as a competing material fill. It must land with provenance tests, not be inferred from computed CSS or declaration order.

## Proposed author and Rule surface

Use Feedback's existing setup/runtime separation and Rule state handles:

```ts
def.feedback.material.declare(slot); // setup-only, one slot
def.feedback.material.use(candidate); // setup contribution; disposer
def.rule({
  when: (w) => w.state(existingPressed).eq(true),
  intent: (i) => i.feedback.material.use(pressedCandidate),
});
```

Static and active Rule contributions are complete candidates, collected by identity. Exactly one active candidate can enhance; zero selects the declared fallback; more than one selects that same fallback plus an ambiguity diagnostic. Equal-looking duplicates still conflict: no last-write-wins or field merge. Authors must make rest/pressed conditions mutually exclusive. No generic material code guesses exposed state names, adds activation handlers or requires every surface to have button state. Rest-only surfaces need no interaction binding. Slot lifetime follows the instance; removal/disposal is a tombstone, not zero active candidates. Dynamic public patch API is deferred until it has independent precedence semantics and tests; it is not needed for Rule-driven family projections.

Rule evaluator and Feedback port retain material contributions even when a Web optimizer could lower their conditions to CSS. No material-bearing Rule can be silently discarded after style-only lowering. A material-only Rule has no style tokens but still has a meaningful plan. Optimized and unoptimized paths must produce the same candidate set and fallback ownership.

## Host lowering and evidence

Promote the existing private final-style boundary into a separately governed visual sink only after conformance. Style + material + shared geometry must arrive as one complete generation-bound transaction. Source lease acquisition, native views and GPU resources remain host-private. The existing transaction identities (target/source/surface/binding/view/geometry/frame) remain separate.

The policy's output is an eligibility decision, not a paint receipt. A host receipt additionally reports requested intent, exact selected backend/profile, actual source kind, enhanced/opaque/unavailable quality, reason codes and the current transaction identity. No successful probe, schema acceptance or shader compilation is a successful paint. Provider IDs/capabilities are trusted host inputs, never author-controlled candidate fields.

- `liquid-glass`: only an admitted self optical provider can enhance; `heightfield-v1` is one finite implementation profile, not a public upper bound. Require actual source texture lease, bounds/transform/clip, color/alpha format, blur/refraction/composition and committed-frame evidence.
- `adaptive-blur`: an admitted system-native compositor, or a real browser compositor for in-app source scope, can enhance. Prefer the supported system/version material. Windows Acrylic/Aero examples are requirements to investigate, not a claim that the current GPUI targets or APIs support those OS versions. Apple NSGlassEffectView is an adaptive candidate only and requires real contentView integration, not an unrelated background sibling.
- A CSS `backdrop-filter` declaration or syntax probe alone is not provider evidence. An actual in-app browser-composited material can satisfy adaptive intent when source scope, live safety and committed paint are demonstrated. The current WebGL/GLSL ES 1.00 owned-scene experiment is not WebGPU or native material.
- GPUI's pinned macOS Metal renderer and its NV12-only `paint_surface` are not an RGBA/custom material pass. The other wgpu surface branch is empty at the pin. A new provider must demonstrate its real path rather than advertise it.

Unknown/reduced transparency, forced colors or unsafe contrast revoke enhanced output synchronously at the visual boundary and retire source/resources. Reduced/unknown motion instead constrains optional dynamic deformation to a static path; it does not imply reduced transparency. Only a provider lacking that static implementation selects opaque with a specific capability reason. Provider/source loss follows the same path without waiting for a new semantic Rule evaluation. Recovery requires current identities and a new paint receipt. No old resources may reappear after disable, detach, rebind or newer fallback.

Actual optical acceptance requires independently inspected owned-scene images with high-frequency edges, text behind the lens, rounded corners, scrolling and mixed bright/dark backgrounds. Plain blur cannot pass the refraction and edge-composition controls. Measure 1/16/64 surfaces at known pixel extents and DPR with static/scrolling sources: p50/p95 CPU prepare/submit, available GPU timestamp duration, allocations and source-copy bytes, missed frames and preference-to-opaque latency. Bind results to source commit, backend, OS, GPU, resolution and refresh rate. GPU timing unavailable is reported as unavailable, never estimated from CPU time. CI virtual-device frames do not certify a real device frame budget. Dirty-region/source reuse and intermediate pass pooling must be supported by measurements before being called performance work done.

## Compiler boundary

The shared schema is the IR consumed by both Adapter and Compiler lowerings. The finite source-specializer can emit an exact provider program only for a supported candidate/model/source profile; it must retain the intent and actual source facts in diagnostics. It cannot erase an adaptive intent into the custom shader, erase a custom intent into native blur, or treat missing implementation as a compiled full Prototype. Code generation never acquires a source lease. General Prototype Compiler coverage remains independently incomplete.

## Executable controls required before a consumer freeze

1. Both discriminants validate; unknown fields, shader/CSS/URL/texture payloads, prototype pollution, sparse arrays, NaN/Infinity and malformed slot names fail.
2. Native-only capability cannot satisfy liquid-glass; self-only cannot satisfy adaptive-blur. Both fail to declared opaque output with distinct reasons.
3. Source scope mismatch, foreign/stale lease, missing actual source evidence, successful syntax probe without paint, or unknown support cannot enhance.
4. Style fallback resolves from the same final theme and geometry. Alpha fill, conflicting paint, missing palette, foreground conflict and unknown provenance never become a claimed opaque fallback or clear unrelated style.
5. Zero/one/multiple candidates, identical duplicates, Rule toggles, inactive removal and material-only Rule plans preserve exact whole values.
6. Live reduced transparency/forced colors/contrast overrides, static reduced-motion paths, detached views and repeated dispose reject all late resources and complete frames.
7. Compiler and runtime accept/reject the same vectors. Unknown target/provider reports a real implementation gap, not success with a dropped declaration.
8. Cross-family fixtures cover static surfaces, button pressed state and disclosure content lifecycle without any implicit button-press binding.

These tests establish only their tested semantic/lowering boundaries. Four Web Adapters, GPUI pixels, real OS materials, native resources/performance, all Base atomic projections and full Compiler parity retain separate unchecked gates.

## First executed candidate

The Core parser and Feedback pure policy now share the version 2 data boundary. 60 focused cases passed locally: strict vectors, parameter-free static intent, intent/backend separation, browser scope limits, static reduced-motion paths, source qualification, fallback provenance and bounded provider geometry. These are synthetic host-fact tests, not real providers, resources or pixels. Public Feedback/Rule author methods, joint contribution application, concrete Compiler backend lowering and all actual host lowerings remain the next implementation slices, followed by independent review and exact-head CI. The older private version 1 optical experiment remains separately identified during migration.

The same Core vectors also pass 29 finite Compiler front-end IR tests. This lowering preserves whole candidate/source data and tombstones; it selects no backend and emits no optical program. It is not full Prototype compilation. The previous private resolver's 26 tests and the catalog schema check also pass. Workspace TypeScript on this historical 15d base reports only the two existing Focus test reason-type errors already repaired on the newer Finf head; the shared material files have no reported type errors.
