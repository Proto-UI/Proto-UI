# GPUI compiler continuation validation — 2026-11-25

This receipt records the continuation after commit `59c18246275c9a5ed0ad313c6da2627956930597`. It supplements, and does not replace, the earlier GPUI receipts in this directory. The exact tested inputs and generated outputs are recorded in `continuation-20261125-input-hashes.json`.

## Executed checks

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript frontend → HIR → Rust AST target | 10 passed, 0 failed, 0 skipped | `continuation-20261125-ast.txt` |
| Actual GPUI native tests, Verdant fork | 13 passed, 0 failed, 0 ignored | `continuation-20261125-fork-native.txt` |
| Fork workspace and all targets, Cargo `--locked` | Passed | `continuation-20261125-fork-check.txt` |
| Expanded generated component, default upstream pin, Cargo `--locked` | Passed | `continuation-20261125-upstream-check.txt` |

The fork is `cyjin-yl/z3rm@e5f2f9db75e97613232b5c1946333e61fa3828ab`, taken from the inspected Verdant dependency. The default upstream dependency is `zed-industries/zed@62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`. They are independently compiled. The upstream `GpuiExpandedPinned` crate includes native children, created and resolved-watch callbacks, and range/step state policies. It is not counted as native execution against upstream.

The native commands use Cargo toolchain `1.98.1`. The final run sets `CARGO_PROFILE_DEV_DEBUG=0`; the native test workspace also specifies debug-free development and test profiles. External packages in the fork Cargo lockfile are unchanged from the preceding commit: the lockfile additions are generated local component packages. Build output retains Rust naming/dead-code warnings; no warning or type suppression was added.

## Implemented and observed behavior

- **Actual Base sources:** `packages/prototypes/base/src/text/root.proto.ts` and `packages/prototypes/base/src/surface/root.proto.ts` pass source type checking, extraction, target admission, Rust construction, native compilation, and GPUI text layout. Tests exercise their actual enum/bool props and fallback history. No prototype-name branch or replacement business implementation is present in the backend.
- **Host Root:** a separate native Root always exists. Template elements are children of that Root. Root event/feedback ownership and template-element styles remain independent. Empty fragments retain a Root; multiple anonymous slots are rejected.
- **Native children:** slot-bearing components expose `Child::Text(String)` and `Child::View(gpui::AnyView)` plus `set_children`. Actual mixed content reaches layout. A native child retains its Entity state across parent props and children updates. Removing the final owned child handle releases the Entity after frame references retire. A child click still reaches the generated Root handler.
- **Template snapshots:** state setters update live native state. A pointer-induced GPUI frame cannot expose it before a Proto update. `run.update()` captures props/state at the accepted request point and schedules native repaint; a successful native props commit captures its own new template snapshot. Child projection changes do not advance the Proto template snapshot.
- **Immediate rule feedback:** states referenced by rule conditions mark Root feedback dirty. The next native paint uses live state for the Root rule while template reads retain their committed snapshot. The native test observes an actual blue GPUI painted quad while text still shows `0` after a state-only increment. This is scene/paint-command evidence, not a raster screenshot.
- **Created and resolved props watches:** created runs once after hydration and before first render. Hydration does not trigger watches. Later resolved changes use `Object.is` semantics, including signed zero; keyed and all-prop callbacks share declaration order. Previous resolved snapshots are distinct from previous-valid fallback history. A failing watcher stops later callbacks and preserves earlier live effects and resolved values, while retaining the last successful template snapshot.
- **Numeric policies:** range clamping applies only to initialization. Invalid later writes retain the old value. Discrete options take precedence over bounds/step; a positive step uses the canonical integer quotient test. Signed zero, fractions, Infinity, NaN rejection, and ECMAScript numeric text formatting remain covered.
- **Action scope:** lowered helper calls become explicitly typed, immediately invoked Rust closures. An early return exits the helper invocation and the caller continues. All generated callback errors use ordinary Rust `Result` propagation.

## Admission and host boundaries

The target continues to construct explicit `syn` AST nodes and print them using `prettyplease`. There is no assembled Rust source parser, `quote!`/`parse_quote!` source template, or emitted Proto/HIR interpreter. The compiler driver is compile-time tooling. The generated component contains native state, props resolution, callbacks, and `gpui::Render`.

Update requests are currently admitted only when every path has at most one terminal request, with an optional trailing return. The checker composes handlers of the same event with independent return scopes and checks props watchers conservatively in registration order. Early or multiple requests require additional commit scheduling and produce a diagnostic. Created-time requests are also rejected because the constructor has no native instance context before initial render.

Mounted, updated, unmounted, and disposal callbacks remain unsupported. Context, expose, anatomy, raw watchers, semantic press/button behavior, unsupported styles, and any remaining unlowered source operation remain diagnostics. Successfully expanded authored hooks may use the same admitted operations; the backend does not substitute hook-specific runtime implementations.

These tests do not establish full Base corpus coverage or migration of the Verdant application. Base inventory/admission counts and actual consumer migration remain separate evidence. `PlatformTextSystem` records actual GPUI layout requests; the tests do not claim pixel, accessibility, focus, or complete lifecycle coverage.

## Files and reproducibility

The reproduction commands are recorded verbatim in each receipt and summarized in the parent README. The `.txt` files remove trailing whitespace only; matching `.txt.gz` files preserve each captured stage exactly. `continuation-20261125-full.txt.gz` preserves the full final formatter/test/build log. Generated `.rs` files are the printer output and are not manually formatted; only hand-written Rust and the owned TypeScript files were formatted.
