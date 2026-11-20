# Liquid Glass preview local appearance

## Scope and observed mismatch

This continuation of the current-user LiquidGL optimization request starts from `84dde63fe3b35a7aedc22d2e57cec1ba99f1842a`. The preview's appearance observer already watches the scene scope and its original ancestors, but its theme resolver starts at the parent passed to `createPreviewMaterialScene`. For an owned scene, a `dark` class or `data-theme="dark"` on the returned scope is therefore observed but ignored. Its visible canvas and consumer `MaterialPaletteSnapshot` remain light even though the nearest explicit appearance is dark. Borrowed scenes do not expose this difference because the passed parent is the scope itself.

The bounded correction starts the existing resolver at the scene scope. The nearest explicit light or dark appearance keeps precedence; the existing system color-scheme fallback still applies only when the observed chain has no explicit appearance. This does not add a theme API, change numeric family colors, modify the optical shaders or source admission, or change conflict precedence between classes and attributes on one element.

The public Previewer resolves its CSS theme from its outer projection root. Changing only an internal scene attribute does not update those separate physical style inputs. If they disagree with the scene palette, the existing `external-foreground-mismatch` fallback remains correct. A browser probe for this specific repair can compare actual static canvas pixels against full-page light/dark reference captures; optical acceptance additionally requires the ordinary consumer theme inputs to agree. This correction does not claim a new public local-theme workflow.

The draft `P-LIQUID-GLASS-BUTTON`, `C-LIQUID-GLASS-COMMAND-INTERACTION-0001`, and `C-LIQUID-GLASS-MAIN-COMMAND-TINT-0001` continue to own the Button's visual and interaction boundaries. Apple's [Color HIG](https://developer.apple.com/design/human-interface-guidelines/color) and [Materials HIG](https://developer.apple.com/design/human-interface-guidelines/materials), retrieved 2026-11-21, inform the continued light/dark legibility review; the project's color values and independent Web implementation are not Apple-native material or a claim of platform equivalence.

## Executed evidence

Two parameterized regressions use real MutationObserver delivery for `class` and `data-theme` writes. They inspect the actual palette source passed by the preview provider to a stubbed sink and the actual source-lease revisions. Each checks a dark scope over a light parent, a light scope over a dark parent, removal back to the parent, and removal of the parent override followed by a system color-scheme change. No manual refresh or redraw masks observer delivery. The static scene keeps zero animation callbacks throughout.

Before the implementation change, both new cases failed at the local dark appearance while all eighteen existing scene tests passed. After the change, the complete scene file passes **20/20** with Node `v24.22.3` and pnpm `10.32.1`:

```sh
corepack pnpm@10.32.1 exec vitest run apps/www/src/components/PrototypePreviewer/preview-material-scene.test.ts --maxWorkers=1 --minWorkers=1
```

Focused Prettier and diff-whitespace checks pass. The existing ES2024/esbuild warnings remain. Canvas pixels, layout, frame time and preference values in these tests are controlled inputs; the tests establish palette/source invalidation and idle scheduling, not native contrast, GPU appearance, 120 Hz performance or input-to-photon latency. Real-browser local-theme observation is tracked with the coordinated browser measurement work rather than inferred from these tests.
