# Toast style token closure repair — 2026-11-25

## Finding and disposition

After integrating main `59bbed9b38ed2426633e26e5c95687878348bca1`, the official preset generators produced the current Shadcn, Brutalist and draft-family token manifests. The next GPUI fixture freshness check failed. Regenerating that fixture initially produced 13 `noDeclarations` entries, including nine real Toast utilities. A freshness-only check then passed despite the missing declarations.

The native style vocabulary treats every `noDeclarations` entry as an intentionally ignorable selector marker. Merely committing that generated snapshot would therefore conceal the nine missing style implementations. This repair adds their existing CSS meanings to the CLI's finite token table and strengthens the fixture tests so another such refresh fails.

The final fixture records 1051 total tokens, 1046 with declarations, four true selector markers and one explicit unsupported selector. The four markers remain `group/brutalist-button`, `group/brutalist-dialog-trigger`, `group/brutalist-toggle` and `peer`. The unsupported selector remains `hit-envelope-translate-1`.

## Existing authored vocabulary

The current `packages/prototypes/shadcn/src/toast/root.proto.ts` uses the stack levels, pointer policy, duration, ease, opacity and shadow; `toast/recipes.ts` uses the description line height. These source inputs already existed at the integrated main revision. Their CSS values were cross-checked against the project's installed Tailwind 4.2.2 compiler using the nine exact candidates.

| Authored token | Preserved CSS meaning |
| --- | --- |
| `duration-300` | `transition-duration: 300ms`, plus the existing Proto UI animation-duration variable convention |
| `ease-out` | `transition-timing-function: cubic-bezier(0, 0, 0.2, 1)` |
| `leading-[1.4]` | Unitless `line-height: 1.4` |
| `opacity-95` | `opacity: 0.95` |
| `pointer-events-auto` | `pointer-events: auto` |
| `shadow-[0_4px_12px_rgb(0_0_0/10%)]` | A 0/4/12px black shadow at 10% alpha, using the existing ring-plus-shadow composition |
| `z-0`, `z-20`, `z-30` | The respective integer stacking levels, including zero |

The production change is confined to `packages/cli/src/services/proto-style-css.ts`. It reuses the existing duration convention, shadow composition and shared rendering paths. Document, Shadow and split-Shadow output receive the same admitted meanings; nearby unadmitted values remain unsupported. Native parsing and painting implementations, generator classification and the existing Unknown/unsupported-selector behavior are unchanged.

Compiler SHA-256 before the repair: `9ca05f468467ab01394ef6a2f3f32ec638d184473f75df9538c2573dd1139567`. Compiler SHA-256 after the repair: `4b8b15c7a46eebb6f6b5aeaa70b6283b12df631774ee49e4680e2bed6a0a38e1`. Final GPUI fixture SHA-256: `ec3fe947e723479a08e66b59016d149abfad3339063b055a9a45ef249a0e7f5e`.

## Current native inventory boundary

The previous main fixture emitted `inset-inline-start: 1rem` only through `start-4`. The current prototype closure no longer contains that token, so the property is absent from every newly generated declaration. The native `EXPECTED_UNMAPPED` inventory therefore changes from 87 currently emitted properties to 86. This is a source-vocabulary change, not newly implemented native support.

Following the existing direct `text-transform` boundary test, `style_map.rs` now supplies `("position", "relative")` together with `("inset-inline-start", "1rem")` directly and requires exactly one `UnknownProperty`, incomplete mapping, accepted relative positioning and unchanged physical left/right insets. Native production code is unchanged, and no synthetic token was added to the generated fixture. The native boundary change received independent source review (STYLE-001). It has not been run through Cargo in this audit; execution remains with the integration owner.

## Concurrent source work

During this bounded repair, [PR #1854](https://github.com/Proto-UI/Proto-UI/pull/1854) independently introduced the same nine utility meanings together with broader Toast anchor and recipe changes. Its head at review was `dfb0077f7a2d8c40524032106d5029fde64795f6`; the shadow alpha is expressed as the equivalent `10%` rather than `0.1`. This record and its negative tests describe the independently reproduced candidate based on main `59bbed9b`, not acceptance of that other PR. That PR did not include the GPUI fixture, its marker guard or the native emitted-property inventory correction. Integration must retain one utility implementation, preserve the independent regression coverage and regenerate from the actual combined source; copying one branch's manifests over different Toast inputs is not a valid reconciliation.

## Negative evidence and verification

The new CLI test consumes the real public Toast source entry through `collectProtoStyleTokens`, checks its generated preset membership and renders all three CSS targets. It also verifies that explicit duration/easing/line-height declarations follow the composite defaults in the cascade, that the shadow retains focus-ring composition, and that nearby or malformed recipes remain unsupported. Before the production fix, this file reported six failed positive cases and three passing rejection cases. The failing output named the missing utilities in the compiler's Unsupported diagnostics.

The new GPUI fixture test failed before the fix because `duration-300` had no compiled declaration. It requires all nine utilities to retain declarations and cascade order, and rejects non-marker entries in `noDeclarations`. This protects the boundary that the former freshness check alone did not cover.

| Verification | Observed result |
| --- | --- |
| `pnpm styles:preset:generate` on integrated main | Passed; Shadcn 1,104 tokens, Brutalist 742, draft families regenerated |
| `pnpm check:styles:preset` | Passed, including all 13 motion-palette tests; its source-token and canonical-theme inputs were unchanged by the subsequent CSS table repair |
| First `pnpm check:gpui-style-fixture` after preset generation | Failed: style fixture stale, themes current |
| First GPUI regeneration without compiler repair | Freshness passed, but 13 no-declaration entries exposed the nine missing utilities |
| New CLI Toast tests before repair | Six failures, three passes |
| New GPUI marker-boundary test before repair | Failed on missing `duration-300` declarations |
| `pnpm gpui:style-fixture` after repair | Passed; 1,046 compiled, four true markers, one unsupported selector |
| `pnpm check:gpui-style-fixture` after repair | Passed; style and theme fixtures current |
| `node --test scripts/gpui/test/style-fixture.test.mjs` | All 14 passed, including stale/missing-fixture and unsupported-selector negatives |
| CLI style regression run | Exit 1: 96 passed, four full-family cases timed out at their unchanged 120,000 ms deadline; total duration 502.43 s |

The CLI regression command is:

```sh
pnpm exec vitest run packages/cli/test/proto-style-css.test.ts packages/cli/test/toast-style-closure.test.ts packages/cli/test/family-style-closure.test.ts
```

The four timed-out cases were the Shadcn, Brutalist, Bootstrap 2.3.2 and Liquid Glass full-family inherited closure tests. The other four cases in that file passed, along with all 83 existing CSS tests and the nine new Toast tests. No assertion result from the timed-out cases is treated as passing. Their cause has not been established by a control comparison; this record does not attribute them to machine failure or to the production repair. The next verification is the existing test command on an isolated GitHub runner, retaining its deadlines and acceptance assertions. The full failed local output is preserved.

The full family-closure checks exercise the generated presets and their actual inherited Base style inputs. The result establishes source collection and CSS/fixture delivery. Existing native property support and browser interaction/visual acceptance retain their own gates; recorded declarations do not claim native rendering support for every CSS property.
