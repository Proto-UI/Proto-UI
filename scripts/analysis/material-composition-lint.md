# Report-only material composition lint

Run against an actual public preview recipe, without mounting it or executing its source:

```sh
corepack pnpm@10.32.1 lint:material-composition apps/www/src/content/docs/demo-liquid-glass-accordion.demo.ts
corepack pnpm@10.32.1 test:material-composition-lint
```

The JSON report binds every inspected source to SHA-256. Diagnostics include severity, certainty, composition/ref path, source start/end span, factory call sites where available, and the declaring ancestor's evidence location. Output is a diagnostic artifact, not a new normative definition or a browser receipt. Keep generated reports outside Git.

## What this checks

This tooling belongs beside the existing `scripts/analysis` diagnostics. It does not participate in Compiler/IR lowering, alter Prototype semantics, change an Adapter or weaken source admission. It adds no dependency: the repository's existing TypeScript parser is used to read syntax, never to transpile or run the inspected program.

The first bounded input format is the existing public `DemoSpec` data tree. Literal objects/arrays, const references, relative imports/re-exports, aliases, string concatenation, template substitutions, known conditional expressions and pure local data factory calls can establish a composition. The actual Accordion recipe imports its shared factory; this tool reads that factory rather than maintaining a second manually copied ancestry tree. The factory call-site chain and input hashes make that relationship reviewable. A renamed component needs no rule update.

Public `definePrototype` definitions supply setup declaration facts. The scanner recognizes imported `definePrototype`/`tw` aliases, constant token values, handle aliases and bounded same-file/relative composables. It does not execute hooks. External package hooks, destructured/unsupported bindings, dynamic values, recursive helpers, mutations, runtime Rules, loops and conditional setup remain unresolved. Uncalled helper bodies and statements after a definite return do not contribute facts.

Two warning rules are currently available:

- `static-painted-ancestor`: a public composition places an in-app-backdrop material declaration below an authored background-paint declaration. The recognized paint subset is the finite semantic role fills and black/white (including nonzero alpha suffixes). This is **declared paint**, not proof of opaque final CSS. Unknown colors, arbitrary background utilities and variants get `needs-runtime-style` instead. The surface's own fallback fill is not an ancestor conflict.
- `static-nonneutral-transform`: a material host declares a supported nonzero numeric translation/rotation/skew or non-identity numeric scale candidate. Neutral-looking tokens such as `translate-x-0`/`scale-100`, arbitrary values and variants instead get `needs-runtime-transform`. Mathematical identity does not imply that the current source guard accepts the resulting computed transform.

These warnings are conditional on using the conservative Web canvas-backdrop profile represented by the exported `inspectCanvasBackdrop` in `packages/adapters/base/src/material/source.ts`. That implementation is evidence of one profile, not a portable restriction on every material backend. A nearer source scope, final style ownership/patches, external CSS, hidden presence, portalling or reparenting can change whether the declared relationship exists in the physical host. The diagnostic never claims that this guard actually ran, that its first rejection reason is known, or that a visible material is optical.

## Unknowns are not passes

Every report remains `status: needs-runtime`, including a report with no warnings. The tool does not establish final normalized style provenance, overlapping Rule conditions, resolved palette colors, portal/DOM ancestry, provider/profile support, source leases/bounds/occlusion, preference/contrast state, committed paint, optical quality, motion behavior or native/Compiler coverage. Runtime-specific facts must be collected at those owners' public evidence boundaries. No private DOM objects are read to invent business rules. Liquid glass is never replaced with generic blur.

Applicable authority is draft `C-FEEDBACK-MATERIAL-0001` (PROVENANCE, SAFETY, QUALITY) and draft `HC-FEEDBACK-VISUAL-SINK-0001` (EVIDENCE). Both require the separation of intent, eligibility and committed output. An intentional opaque fallback is legal; unknown support must still fail closed at runtime.

Unsupported composition expressions produce a `needs-runtime-*` diagnostic; syntax, I/O, ambiguous prototype identities and bounded-reader exhaustion are incomplete analysis failures (exit 2). Inputs outside the supported public DemoSpec subset are not silently interpreted as a different framework. An empty result is not complete coverage of arbitrary JSX, render functions, package hooks, CSS or applications.

## CI and regression evidence

`lint:material-composition` is report-only: warnings and unresolved facts return exit 0. It has no `--strict`/`--fail-on-fallback` switch and is not inserted into the global blocking checks. `test:material-composition-lint` runs only deterministic regression fixtures and can be selected as a blocking tooling check. It does not make application fallbacks CI errors. A future blocking application policy needs a separately accepted, exact profile and input scope plus a reviewed baseline for intentional fallbacks.

Tests include the actual public Accordion recipe/current source, a clearly labelled reverted-paint test control, transparent ancestor/own-fallback negatives, alias and composable equivalents, dynamic source/Rule/props/children, lexical scope, dead code, mutation, unsupported module effects, unknown style, bounded recursion and spans. The repaired recipe must have no Item-origin warning, while nested Triggers below Content retain their declaration-level fallback risk. These are static tests; they do not replace browser GPU/source or optical screenshots.
