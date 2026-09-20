# @proto.ui/adapter-web-component

Translates Proto UI prototypes into Web Components component functions for use with Proto UI adapters.

## Purpose

Translates Proto UI prototypes into Web Components component functions that run through the Proto UI adapter contracts.

## Document theme

The default `colorScheme` reader follows root `class` / `data-theme` markers and then the system preference. Mounted colorScheme Rule consumers update their existing style contribution when that effective value changes; view detach and terminal disposal release their subscription.

The guarantee is limited to the default getter in same-document light DOM without intervening local theme markers. An explicit `getMeta` keeps sampled behavior; subtree, ShadowRoot and cross-document equivalence remain outside this slice. See [C-RULE-COLOR-SCHEME-0001](../../../spec/contracts/C-RULE-COLOR-SCHEME-0001.yaml) and [T-RULE-COLOR-SCHEME-0001](../../../spec/tests/T-RULE-COLOR-SCHEME-0001.yaml), both draft.

## Package Role

Adapter package intended to be used together with Proto UI prototypes and the shared runtime stack.

## Install

```bash
npm install @proto.ui/adapter-web-component@0.3.0-alpha.1
```

## Experimental Shadow split profile

The current source supports an opt-in experimental Shadow split profile. Its initial S1–S5 acceptance is complete, but the spec remains draft; this is not a claim about an earlier published package or general Shadow DOM compatibility.

| `shadow` option | Presentation |
| --- | --- |
| Omitted / `false` | Existing Light DOM; no split wrapper or Shadow stylesheet |
| `true` | Existing direct Shadow children; Root styles remain on the host |
| `{ mode: 'open', presentation: 'split', styleArtifact, colorSchemeSource? }` | Stable inner visual surface with explicit Shadow-local styles; host remains the logical boundary |

Split is explicit:

```sh
proto-ui tokens --input ./src/prototypes --out ./src/styles/proto-ui-tokens.generated.css --shadow-out ./src/styles/proto-ui-shadow-style.generated.js
```

```ts
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { checkboxRoot, checkboxIndicator } from '@proto.ui/prototypes-shadcn/checkbox';
import { protoShadowStyleArtifact } from './styles/proto-ui-shadow-style.generated.js';

const shadow = {
  mode: 'open',
  presentation: 'split',
  styleArtifact: protoShadowStyleArtifact,
} as const;
const Root = AdaptToWebComponent(checkboxRoot, { shadow });
const Indicator = AdaptToWebComponent(checkboxIndicator, { shadow });
const root = new Root();
root.append(new Indicator());
setElementProps(root, { defaultChecked: true });
document.body.append(root);
```

Generate the complete token closure of the prototypes you use (the `shadcn`/`brutalist` preset commands also accept `--shadow-out`). Import the matching theme variables on the document; the artifact does not duplicate theme declarations. Regenerate document CSS and the companion together. The synchronous v1 artifact must already be imported before registration; Promise/lazy inputs are rejected. `ShadowStyleArtifactV1` and `ShadowColorSchemeSource` are exported types, not runtime builders.

The default color-scheme source observes document theme/class and system preference. An optional `colorSchemeSource: { get, subscribe }` drives both the host marker and runtime `colorScheme`; other `getMeta` keys retain their original behavior. `subscribe` must return a cleanup function.

The stable inner surface exposes `part="surface"`. Normalized `surfaceStyle` and `surfaceClassName` target it, but document class selectors do not cross Shadow boundaries automatically. Theme inheritance, host overrides and slotted consumer content are not completely isolated. `::part(surface)` and raw CSS are explicit customization escapes: changing layout, font, border or padding can invalidate generated sizing parity. No arbitrary CSS metrics synchronization is provided.

Document resets also count as host CSS. For example, Tailwind preflight clears host padding/border and can override generated non-paint sizing contributions. Exempt your registered split tags from that reset layer (adapt the layer name to your stylesheet):

```css
@layer base {
  shadcn-checkbox-root,
  shadcn-checkbox-indicator {
    padding: revert-layer;
    border: revert-layer;
  }
}
```

This withdraws the application's reset; it does not calculate sizes or copy component tokens. It is not protection against arbitrary later consumer CSS. The demo includes a switch that removes this exemption so the boundary remains observable.

### Supported recipes and compatibility

The verified scope includes Badge/Checkbox, current Shadcn Button and Switch, Tabs, bounded Dialog composition, and the native text editors below. This is a list of validated slices, not automatic admission of every prototype. Unsupported declarations, unresolved/composite tokens without a recipe, and missing compiled recipes fail closed. Existing boolean profiles are unchanged.

Bounded Root motion supports the current Shadcn Button and Switch Root/Thumb. Regenerate the CLI companion before using them: Root translation/scale and `will-change-transform` target the boundary once, while `pointer-events-none` remains a separate boundary hit-testing responsibility. The surface and slot move with the instance; slot content stays consumer-owned. No author token prefixes are needed. Fixed-border sizing and motion transitions have scoped Chrome evidence; animated border-width changes still fail closed because their pixel-rounded widths need a different compensation recipe. Other unresolved transform-family values are not automatically supported.

`hidden` (whole-Root box participation) and `relative` (whole-Root positioning and descendant coordinate reference) target the boundary, not the inner surface. Regenerate the CLI companion: older recipes are rejected before either style target changes. Style hiding does not call `setPresent`, dispose the instance, or create a11y intent; existing Tabs `keepMounted` and legacy a11y behavior remain independent. Scoped Chrome evidence covers normal hit/Tab/AX exclusion, layout restoration, and absolute descendants. This does not admit all visibility/positioning tokens or arbitrary CSS overrides.

The static `inline-flex` + `flex-1` + `whitespace-nowrap` combination also needs a regenerated companion for intrinsic sizing. Its private one-child flex shell preserves the parent's automatic minimum and allocation instead of imposing an explicit content minimum. Conditional versions of these base tokens and explicit width/min-width/max-width/size constraints in that combination are not yet admitted. This bounded recipe does not change the general author token roles.

### Dialog composition

Bounded complete Shadcn Dialog composition includes Light, split and mixed Dialogs containing Tabs/settings, using the current public packages and matching CLI companion. It admits exactly `-translate-x-1/2` and `-translate-y-1/2` as whole-Root geometry and the governed fade/zoom recipe. The boundary carries geometry once; the surface carries paint. Older companions lacking the recipe are rejected. No author role prefixes are required.

The current default body portal inherits the physical destination's document theme, not variables from the origin's local ancestors. Logical Context/Anatomy remain distinct from CSS ancestry. Removing the origin subtree reclaims its portaled views and resources; synchronous connected moves retain the instance. Active Dialog Tab traversal uses a fresh open-composed-tree sample of projected tab stops, including Tabs entry fallback, while Focus retains scope policy. The sample does not prevent arbitrary external DOM `focus()` calls.

These are scoped Chrome composition results, not lifecycle promotion or general portal support. Nested modals, arbitrary portal targets, cross-document/closed-shadow trees and arbitrary transforms/animations remain outside the split admission. Native text editing has separate evidence below; it does not establish every Dialog/editor combination. Slots remain consumer-owned, and retained settings values belong to the demo's consumer model rather than automatic preservation of every descendant instance.

### Native text editing

The existing Base Input, Base Textarea and Shadcn Textarea are admitted. Regenerate the CLI companion: older v1 artifacts without the native recipe are rejected before registration. The single native editor is also the surface, directly inside the ShadowRoot with `part="control surface"`. It receives normalized surface props and existing text/focus/a11y projections; no second painted wrapper is added.

Native intrinsic sizing and `rows` are retained. The bounded native dimension recipe admits `w-full` and `min-h-16`; other dimension/aspect tokens are rejected rather than inferred. Native padding/border are painted and counted by the editor, without the ordinary div surface's negative-margin compensation. Existing ordinary Root recipes remain unchanged. Raw styles and document resets remain explicit integration escapes.

Ordinary updates retain editor identity and selection; view detachment removes the editor and revokes native subscriptions, while owner styles/environment remain. Reattachment renews subscriptions. Focus/blur enter through the actual editor once, preserving its native `:focus-visible` result rather than the Shadow-retargeted shell result. Terminal teardown/reconnect creates a new logical instance, so uncontrolled values are not promised across it.

The Light/split/mixed scene and public-dist Chrome journey cover controlled acceptance/rejection, uncontrolled edits, selection, synthetic composition, focus-visible, disabled/readOnly, rows, surface customization, Tabs epochs and named AX textboxes. Stage-level manual acceptance does not establish a complete browser/OS IME matrix. Use `ariaLabel` for this acceptance slice; arbitrary external `labelledBy`/`describedBy` IDREFs do not cross Shadow automatically and are not a cross-tree accessibility guarantee.

### Remaining limits and validation

Image View, Form/validation, rich text, auto-resize, new selection APIs, explicit author role prefixes, asynchronous style loading, strict CSP/nonce guarantees and arbitrary CSS sizing are not added. Closed Shadow and cross-document composition are not admitted. The separately tracked Dialog rapid-reopen issue [#645](https://github.com/Proto-UI/Proto-UI/issues/645) is not repaired by this feature.

The local Demo Matrix exposes `#shadow-split-s1` through `#shadow-split-s5` under `/zh-cn/internal/demo-matrix/` and `/en/internal/demo-matrix/`. These cover customization, settings, Tabs, Dialog and native editors respectively. Public-dist consumer scripts complement website tests; the S5 performance script reports measurements, not a cross-machine frame budget.

Canonical scope and evidence: [profile decision](../../../spec/decisions/D-WEB-COMPONENT-SHADOW-PROFILE-0001.yaml), [style delivery decision](../../../spec/decisions/D-WEB-COMPONENT-SHADOW-STYLE-0001.yaml), [Root role decision](../../../spec/decisions/D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001.yaml), and [profile tests](../../../spec/tests/T-WEB-COMPONENT-SHADOW-PROFILE-0001.yaml). These repository links are for source checkout; the package API remains the documented exports above.

## Source Layout

- `src/adapt.ts`
- `src/commit.ts`
- `src/debug/`
- `src/feedback-style.ts`
- `src/host-display.ts`
- `src/index.ts`
- `src/platform/`
- `src/props.ts`
- `src/runtime/`
- `src/slot-projector.ts`
- `src/style.ts`
- `src/types.ts`

## Related Internal Packages

- `@proto.ui/adapter-base`
- `@proto.ui/core`
- `@proto.ui/hooks`
- `@proto.ui/module-a11y`
- `@proto.ui/module-anatomy`
- `@proto.ui/module-as-trigger`
- `@proto.ui/module-boundary`
- `@proto.ui/module-context`
- `@proto.ui/module-event`
- `@proto.ui/module-expose-event`
- `@proto.ui/module-expose-state`
- `@proto.ui/module-expose-state-web`
- `@proto.ui/module-feedback`
- `@proto.ui/module-focus`
- `@proto.ui/module-hit-participation`
- `@proto.ui/module-image-view`
- `@proto.ui/module-overlay`
- `@proto.ui/module-positioning`
- `@proto.ui/module-props`
- `@proto.ui/module-rule-expose-state-web`
- `@proto.ui/module-rule-meta`
- `@proto.ui/module-scroll`
- `@proto.ui/module-test-sys`
- `@proto.ui/module-text-control`
- `@proto.ui/runtime`
- `@proto.ui/types`

## License

MIT
