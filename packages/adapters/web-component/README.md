# @proto.ui/adapter-web-component

Translates Proto UI prototypes into Web Components component functions for use with Proto UI adapters.

## Purpose

Translates Proto UI prototypes into Web Components component functions that run through the Proto UI adapter contracts.

## Document theme

The default `colorScheme` reader follows root `class` / `data-theme` markers and then the system preference. Mounted colorScheme Rule consumers update their existing style contribution when that effective value changes; view detach and terminal disposal release their subscription.

Fresh portal projections in a visible document keep the existing host reveal guard through a rendering opportunity, including descendant transitions in their light-DOM subtree. This lets mounted-callback theme changes reach the first visible paint without interpolating from the unpublished recipe. Authored Presence keyframes remain enabled; transitions resume after the guard. Projection revocation, terminal disposal and document visibility loss cancel its pending frames and remove the guard immediately; an initially non-visible document adds no reveal frame dependency. Ordinary surfaces outside that subtree keep their transitions.

The guarantee is limited to the default getter in same-document light DOM without intervening local theme markers. An explicit `getMeta` keeps sampled behavior; subtree, ShadowRoot and cross-document equivalence remain outside this slice. See [C-RULE-COLOR-SCHEME-0001](../../../spec/contracts/C-RULE-COLOR-SCHEME-0001.yaml) and [T-RULE-COLOR-SCHEME-0001](../../../spec/tests/T-RULE-COLOR-SCHEME-0001.yaml), both draft.

The separate draft `preference.*` and `styleSupport.*` namespaces use mounted sources paired to the instance's actual Runtime getter, including the split-profile wrapper. Default sources follow `ownerDocument`: adoption retires old subscriptions, binds destination facts, and requests Rule style reconciliation. Terminal disposal releases them; remount creates fresh sources. Explicit `getMeta` does not install these default sources, so these namespaced Rule inputs remain unknown without a paired provider. Native browser regressions cover light, direct Shadow and split consumers with controlled media/CSS-support facts; they do not establish OS preference delivery, alpha/blur material fidelity, or broader `colorScheme` equivalence. See [C-RULE-PREFERENCES-0001](../../../spec/contracts/C-RULE-PREFERENCES-0001.yaml) and [C-RULE-STYLE-SUPPORT-0001](../../../spec/contracts/C-RULE-STYLE-SUPPORT-0001.yaml), both draft.

## Focus entry observation

Adapter-owned caller relocation captures focus before staging caller nodes. Its private transport boundary admits removal-induced focus loss only during the actual synchronous DOM move of the captured subtree; Chromium can dispatch that loss before the subtree becomes disconnected. An explicit blur before the DOM move still cancels restoration, as does focus directed to another control. Restoration retains the existing destination, document, logical-owner, readiness, receipt, disabled and inert checks and does not replay selection over author focus handlers. This implements the draft [owned-target contract](../../../spec/contracts/C-FEEDBACK-STYLE-OWNED-TARGET-0001.yaml); native acceptance uses `scripts/feedback/owned-caller-relocation-evidence.mjs` alongside the cancellation controls in `test/owned-slot-relocation.test.ts`.

Descendant-first focus entry projects the region's self fallback from current descendant eligibility. For sibling-position conditions such as `:first-child` and `:nth-child(2n+1)` on a relational selector subject, the current source retains shallow child-list watches on direct parents in its bounded external chain. These dependencies survive an initially nonmatching subject or a selector list that cannot use scoped negated-subject observation. Prepending, removing or reinserting a hidden preceding sibling can then refresh the fallback without a resize.

While the region or a composed ancestor is natively inert, entry observation follows the ancestry and defers descendant and CSS dependency discovery. Removing the inert barrier or moving the chain resamples the fallback and rebuilds its dependencies from the current DOM and stylesheets. The dormant interval releases the descendant, resize, motion, radio and late-upgrade watches.

Owned portal projections also contribute their actual position parents at registered same-document destinations. Dependency discovery reads stylesheets in each projection's containing open ShadowRoot, so destination selector attributes can refresh descendant eligibility while logical ownership stays at the origin.

Native `CustomStateSet.add`, `delete` and `clear` join the existing shared window invalidation subscription while entry observation is active. Membership changes coalesce into an entry refresh; native return values, argument conversion and exceptions are retained. Repeated adds, missing deletes and empty clears do not request a refresh. The last subscriber releases the method hooks using the existing ownership checks.

The parent watches share the existing entry-observation lifetime. Refresh rebuilds their dependencies; stopping observation disconnects them, and generation checks prevent stale callbacks from changing a newer projection. Ordinary descendant-only negation retains its scoped subject observation. The [Focus Entry capability](../../../spec/host-caps/HC-FOCUS-ENTRY-0001.yaml) and [entry eligibility mutation case](../../../spec/tests/T-FOCUS-SCOPE-0001.yaml) remain draft; this bounded mutation coverage does not establish general CSS selector or consumer coverage.

## Package Role

Adapter package intended to be used together with Proto UI prototypes and the shared runtime stack.

## Install

<!-- proto-ui-release-status:start -->

> **Unpublished release preparation:** `0.3.0` has not been published. The command below is an example for use after publication; it is not currently an installable version.

<!-- proto-ui-release-status:end -->

```bash
npm install @proto.ui/adapter-web-component@0.3.0
```

## Styling the composed host

`AdaptToWebComponent` registers the custom-element tag supplied through `registerAs`; that tag is the DOM host that document CSS styles. Some composed families add a wrapper whose public tag differs from the raw prototype name. The Shadcn switch is the current example: the generated facade exports `ShadcnSwitchElement` as `<proto-ui-shadcn-switch>` (Root plus Thumb), while the raw adapter target is separately registered as `<proto-ui-shadcn-switch-root>`.

Track geometry belongs on the tag used in your markup. For a default-size, left-to-right compact composition, keep the Root dimensions, Thumb dimensions and checked travel together:

```css
proto-ui-shadcn-switch {
  width: 2rem;
  height: 1.25rem;
  padding: 0;
  border-width: 2px;
}

proto-ui-shadcn-switch > proto-ui-shadcn-switch-thumb {
  width: 1rem;
  height: 1rem;
  border-width: 0;
}

proto-ui-shadcn-switch > proto-ui-shadcn-switch-thumb[data-checked] {
  --pui-translate-x: calc(100% - 4px);
}
```

CSS that targets `proto-ui-shadcn-switch-root` does not reach the composed instance. Thumb-only rules can still apply, leaving a custom Thumb inside the unchanged profile's track. See [#1720](https://github.com/Proto-UI/Proto-UI/issues/1720) for the measured half-travel case. The raw Root remains a valid separate composition target when that is the tag in your markup. The custom geometry above is a single default-size LTR example; use the family recipes for other sizes, directions or optional drag behavior.

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

The experimental v1 companion is a trusted, same-source CLI output and must be consumed without hand-editing. Its per-rule receipt detects stale or accidental edits; it is not authentication for adversarial or independently authored CSS. The Adapter additionally compares the bounded recipes that cross the split boundary (including the admitted native sizing recipes) against trusted canonical declarations and rejects missing or stale generated evidence before mutation. Other self-consistent receipts do not prove that a rewritten declaration is the CLI's canonical recipe. If a companion is changed, regenerate the document CSS and companion together instead of recomputing receipts.

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

For a split Root with owned decorations, withdrawing the final Rule `opacity-0` token can transition back to default opacity `1` under the retained `transition-opacity` or `transition-all` recipe. The temporary zero phase is eligible only while the exact native CSS transition created by that owned write remains pending or running on the same surface. Identical updates retain the caller, decoration and owner identities. Completing or externally replacing that transition removes its zero-opacity allowance; external concealment remains rejected. The native closeout regression covers withdrawal without an explicit positive opacity token alongside the existing explicit-opacity case.

Leaving an owned native hover selector after opacity settles to zero can start the same return to default opacity without a projection write. This path records the complete owned conditional selector matching during trusted pointer entry/movement, then consumes that observation at trusted pointer exit. Only that exit can acquire the exact surface's native opacity `CSSTransition`, from `0` to `1` at native progress `0`, with the owned transition recipe still active. The observation cannot be reused for later foreign stylesheet withdrawal; projection writes and disposal clear it. Retention requires the same pending/running transition and rejects competing opacity effects. The closeout fixture uses an optimized official hovered Rule, trusted pointer movement, zero delay, two updates and exact view/owner identities. Its negative controls include a sole foreign `0` to `1` transition while the pointer stays outside, external concealment, and another animation; disposal checks removal of ownership membership. These cases await validation and retain the draft profile boundary.

The hover observation binds native input and transition identity; it does not expose winning CSS-rule provenance. A foreign cascade change in the same pointer-exit task before the Adapter observes the exit can be indistinguishable through the native animation API. Proving that stronger source claim requires a separately bound generated opacity channel or bounded cascade-source admission; timing or an inactive token alone cannot establish it. Focus/state-only selector exits are not covered by this hover observation, and existing Rule-write capture remains separate.

`hidden` (whole-Root box participation) and `relative` (whole-Root positioning and descendant coordinate reference) target the boundary, not the inner surface. Regenerate the CLI companion: older recipes are rejected before either style target changes. Style hiding does not call `setPresent`, dispose the instance, or create a11y intent; existing Tabs `keepMounted` and legacy a11y behavior remain independent. Scoped Chrome evidence covers normal hit/Tab/AX exclusion, layout restoration, and absolute descendants. This does not admit all visibility/positioning tokens or arbitrary CSS overrides.

The static `inline-flex` + `flex-1` + `whitespace-nowrap` combination also needs a regenerated companion for intrinsic sizing. Its private one-child flex shell preserves the parent's automatic minimum and allocation instead of imposing an explicit content minimum. Conditional versions of these base tokens and explicit width/min-width/max-width/size constraints in that combination are not yet admitted. This bounded recipe does not change the general author token roles.

### Dialog composition

Bounded complete Shadcn Dialog composition includes Light, split and mixed Dialogs containing Tabs/settings, using the current public packages and matching CLI companion. It admits exactly `-translate-x-1/2` and `-translate-y-1/2` as whole-Root geometry and the governed fade/zoom recipe. The boundary carries geometry once; the surface carries paint. Older companions lacking the recipe are rejected. No author role prefixes are required.

The current default body portal inherits the physical destination's document theme, not variables from the origin's local ancestors. Logical Context/Anatomy remain distinct from CSS ancestry. Removing the origin subtree reclaims its portaled views and resources; synchronous connected moves retain the instance. Active Dialog Tab traversal uses a fresh open-composed-tree sample of projected tab stops, including Tabs entry fallback, while Focus retains scope policy. The sample does not prevent arbitrary external DOM `focus()` calls.

These are scoped Chrome composition results, not lifecycle promotion or general portal support. Nested modals, arbitrary portal targets, cross-document/closed-shadow trees and arbitrary transforms/animations remain outside the split admission. Native text editing has separate evidence below; it does not establish every Dialog/editor combination. Slots remain consumer-owned, and retained settings values belong to the demo's consumer model rather than automatic preservation of every descendant instance.

### Non-split native full-width contribution

Withdrawing a Root contribution removes only that source's ownership. An overlapping token already supplied externally on the boundary remains; an external owner can still explicitly remove its token while the Adapter is active.

The default non-split native Input/Textarea projection retains all visual tokens on its physical editor. Canonical Root `w-full` additionally contributes the same percentage-width token to the Custom Element boundary so width is evaluated against the logical parent's allocation rather than only an intrinsic wrapper. This bounded contribution preserves original provenance and lowered conditions, retracts with the final style result, and never copies paint, padding, border, `grow`, `min-w-0`, or raw surface customization. Without `w-full`, native intrinsic behavior is unchanged. It is not a general flex/dimension mapping and does not change the separately governed Shadow split recipe below. Simulated-DOM transport tests do not establish native layout acceptance.

### Native text editing

The existing Base Input, Base Textarea and Shadcn Textarea are admitted. Regenerate the CLI companion: older v1 artifacts without the native recipe are rejected before registration. The single native editor is also the surface, directly inside the ShadowRoot with `part="control surface"`. It receives normalized surface props and existing text/focus/a11y projections; no second painted wrapper is added.

Native intrinsic sizing and `rows` are retained. The bounded native dimension recipe admits `w-full` and `min-h-16`; other dimension/aspect tokens are rejected rather than inferred. Native padding/border are painted and counted by the editor, without the ordinary div surface's negative-margin compensation. Existing ordinary Root recipes remain unchanged. Raw styles and document resets remain explicit integration escapes.

Ordinary updates retain editor identity and selection; view detachment removes the editor and revokes native subscriptions, while owner styles/environment remain. Reattachment renews subscriptions. Focus/blur enter through the actual editor once, preserving its native `:focus-visible` result rather than the Shadow-retargeted shell result. Terminal teardown/reconnect creates a new logical instance, so uncontrolled values are not promised across it.

The Light/split/mixed scene and public-dist Chrome journey cover controlled acceptance/rejection, uncontrolled edits, selection, synthetic composition, focus-visible, disabled/readOnly, rows, surface customization, Tabs epochs and named AX textboxes. Stage-level manual acceptance does not establish a complete browser/OS IME matrix. Use `ariaLabel` for this acceptance slice; arbitrary external `labelledBy`/`describedBy` IDREFs do not cross Shadow automatically and are not a cross-tree accessibility guarantee.

### Remaining limits and validation

The same admission boundary commits buffered `createVisualSink` frames before mounted delivery, including ordinary-style fallback when the provider returns `null`. A rejected fallback cannot publish mounted or focus readiness. This implements the draft SPLIT-ATOMIC direction without promoting its lifecycle status.

Initial split effects and any pending visual frame are admitted before the Adapter reports the mounted phase or notifies focus readiness. Runtime then schedules mounted delivery through the configured scheduler. A synchronous mounted callback failure still propagates through the connection transaction with its original thrown value. Deferred delivery retains Runtime's existing completion behavior. A retained projection failure rejects acquisition before mounted delivery. The existing cleanup path retires a failed initial owner.

If an ordinary split element rejects its initial owned-decoration publication after successfully restoring a changed caller projection, the failed owner and its view resources are retired. Rollback restores caller light DOM child identities and order, including empty nested elements. The permanent ShadowRoot then retains an unstyled default slot for the restored default-slot caller content. Named-slotted caller children are not covered. Other initial failures retain the empty failed-state ShadowRoot. This recovery slot has no Runtime or Module authority and is removed before a later connection acquires a new owner. Restored caller controls can re-enter a surrounding focus scope's ordinary descendant sampling; no failed-owner focus authority survives. Native text, image and link projections do not use this recovery path.

Caller file inputs are compared by their ordered `File` identities, including secondary files when the browser's synthetic `value` is unchanged. Rollback reconstructs the original selection through native `DataTransfer` and `.files`, independently of `value`, and retains the same-document guard. The source-level regression cases in `test/shadow-closeout.browser.test.ts` require native `File`, `DataTransfer` and writable `HTMLInputElement.files`; simulated DOM file data does not establish this behavior. Native acceptance requires these cases to pass in a real browser.

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
- `@proto.ui/module-axis-input`
- `@proto.ui/module-boundary`
- `@proto.ui/module-context`
- `@proto.ui/module-control-label`
- `@proto.ui/module-event`
- `@proto.ui/module-expose-event`
- `@proto.ui/module-expose-state`
- `@proto.ui/module-expose-state-web`
- `@proto.ui/module-feedback`
- `@proto.ui/module-focus`
- `@proto.ui/module-hit-participation`
- `@proto.ui/module-image-view`
- `@proto.ui/module-native-link`
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
