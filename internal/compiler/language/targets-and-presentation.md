# Target profiles, presentation, and shader declarations

This document specifies current target-profile boundaries, the private Flutter capture limit, and native Web lowering for presentation and bounded material shader declarations.

## Scope & Limits

- Documents current compiler emission boundaries for private source profiles; target presence does not claim complete 0.3/0.4 consumer acceptance or stable spec promotion.
- `C-FEEDBACK-PRESENCE-PRESENTATION-0001`, `HC-FEEDBACK-PRESENCE-PRESENTATION-0001`, `C-FEEDBACK-SHADER-PRESENTATION-0001`, and `HC-FEEDBACK-SHADER-PRESENTATION-0001` remain `draft`.

## Implemented vs. experimental target profiles

| Profile | Registry status | Key admission notes |
| --- | --- | --- |
| React DOM, Vue3, Vue2, Web Components | Implemented public source profiles | Native JS lowering for `includes`, `String`, `Object.assign`, getters, `Array`/`Set`/`Map`, Rule document leases, `run.lifecycle.setPresent`, `feedback.style.presence`, `feedback.material.shader`. |
| GPUI | Implemented source profile | Admits scalar `String`/`Number`/`Math`/`.length` (`C-COMPILER-SCALAR-0001`) and ordinary recursion fixtures; rejects `includes`, `Object.assign`, getters (`PUI4003`), Rule Meta, and shaders. |
| Qt, Flutter, SSR | Unimplemented in public registry (private experiments) | Reject scalar `String`, `Object.assign`, getters (`PUI4001`), Rule Meta, and shaders; Flutter enforces the capture boundary below. |

## Private Flutter capture boundary

The current Dart host represents an authored-hook result as an opaque `Object` (usable for identity comparisons, aliases, and ordinary returns, with no capture methods).

The direct Flutter emitter explicitly diagnoses capture lookup (`getState`, `getMethod`, `getAsHook`, `getAsHookHandle`), custom handle projection, repeated/configurable hook modes, invocation options, and setup installation-API parameters because the Dart host currently only invokes hook setup with its owner parameter.

## Presentation declarations (`feedback.style.presence`)

- **Contract & ownership**: Follows draft `C-FEEDBACK-PRESENCE-PRESENTATION-0001` and `HC-FEEDBACK-PRESENCE-PRESENTATION-0001`. The four Web source profiles retain same-owner Presentation references and nominal State/Observed/Borrowed endpoints; emitted host support returns only binding/attempt/target receipts (no Transition component logic).
- **Physical Web profile**: Owns neutral-baseline `translate` and `opacity` channels. Semantic styles apply before measuring typed affine units, cold samples require a real frame acknowledgement, reversals resume from the last applied sample, and a separate deadline bounds each attempt.
- **Lifecycle & inclusion**: Replacing a view or `Document` retires callbacks and owned writes while preserving external CSS writers. Generated host support is included only when a declaration is reached.

## Bounded material shader declarations (`feedback.material.shader`)

`feedback.material.shader` (`C-FEEDBACK-SHADER-PRESENTATION-0001` / `HC-FEEDBACK-SHADER-PRESENTATION-0001`) is a setup-only operation registering one immutable, budgeted graph on the existing material channel with an explicit opaque fallback.

### Graph admission and lowering

- **Supported passes**: Versioned `copy` and `tint` passes over top-left, linear-sRGB, premultiplied RGBA8 data. Author shader text, raw host textures, page capture, and implicit history are rejected.
- **Compile-time graph proof (Web)**: Accepts inline graphs and proved immutable aliases (including pure finite-data factories across imports/re-exports, static args, defaults, finite records/arrays, unary ops, selected conditionals, constant returns). Add `ShaderPresentationDeclaration` when discriminants need annotation.
- **Exclusions**: Container mutation, escaping sibling aliases, effectful/recursive helpers, mutable cells, getters, unknown callees, and arithmetic/scalar intrinsics inside the shader-specific proof.
- **Thin native emission**: Lowers directly to `upload`, `copy`, and `tint` calls in dependency order with reached WebGL2 host atoms and verified first-party kernel digests (no graph interpreter, no Runtime/Adapter imports, unreached kernels stripped). Multi-entry builds verify every original support file against its closure before sharing reached kernels.
- **Exclusivity**: Currently mutually exclusive with shared/private material and presence/resident-motion declarations until atomic paint ownership is defined.

### Owned-scene host capability (`owned-scene`)

```ts
// Application configures the host capability explicitly; ordinary exports keep opaque fallback.
const host = createWebShaderHost({ ownedScenes: { mainScene: canvasBackdropLease } });
```

- An owned-scene source declares `{ kind: 'owned-scene', slot: 'mainScene' }`.
- Native scene modules export `createShaderHost` and `createComponent(optionalHost)` only when scene capability is reached; host capabilities are never Props, attributes, serialized IR, or Context payloads.
- The first scene provider borrows the read side of `CanvasBackdropLease` (copies opaque sRGB8, decodes/quantizes to linear premultiplied RGBA8, enforces extent/texel/pass budgets, tracks composed shadow-root ancestry/reparenting/revocation, unsubscribes on cleanup without disposing the app lease).
- Ordinary Adapter bundles omit the scene provider, and ordinary physical paint omits diagnostic readback (`createWebShaderDevice` keeps its explicit read API). Current browser/cost receipts live in [`2026-11-24-sprint4-owned-scene-shader.md`](../../records/2026-11-24-sprint4-owned-scene-shader.md).
