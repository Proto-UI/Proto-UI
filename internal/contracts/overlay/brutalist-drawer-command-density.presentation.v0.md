# Neo Brutalism Drawer command density (v0, proposed bounded presentation)

Status: independently reviewed bounded presentation direction, admitted for this local implementation on 2026-10-11. This uncataloged transitional presentation slice does not admit the full Drawer or Button. Draft `C-AS-HOOK-0001`, `C-FEEDBACK-STYLE-0003` and `C-AS-OVERLAY-0001` constrain composition, style intent and unchanged overlay ownership.

## Fixed source and scope

Use neobrutalism-components `3306a802724874a85f93079702b2795370a279d4`:

- [Drawer consumer](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/examples/ui/drawer/index.tsx) renders a default Button for Trigger and `noShadow` Button with neutral `bg-secondary-background text-foreground` overrides for Close. These are different paint recipes, not a shared shadowed control.
- [Button](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/components/ui/button.tsx) gives both omitted sizes `h-10 px-4 py-2`, with `text-sm font-base rounded-base`.
- [Theme](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/styling/globals.css) maps base weight500 and radius5px. The primitive Drawer wrapper alone does not supply this density.

This slice changes only both existing command recipes' density, weight, radius and explicit long-label adaptation. Preserve current color, border, focus and disabled state rules. Current paint is not claimed equivalent to upstream Trigger default or Close noShadow/neutral; resolving those role-specific color, shadow, hover, press and focus differences is separate work. Do not import a common structure/control token bundle that adds shadow.

## Presentation and ownership

Both commands contribute `min-h-10 px-4 py-2 rounded-base text-sm font-medium min-w-0 max-w-full whitespace-normal wrap-anywhere text-center`, replacing `px-3 rounded-none font-bold`. At root16 and one line, expected border-box height40px comprises line20px + block padding8px per edge + border2px per edge. Inline padding16px, font14px/line20px, weight500, radius5px. At root32 the minimum is80px, padding32px inline/16px block, font28px/line40px; the pixel borders remain2px per edge, so the natural76px border-box requirement settles at minimum80px. Radius remains the family5px variable, not a rem-scaled10px. Retain `inline-flex items-center justify-center` and border-box sizing. Explicit `text-center` centers each wrapped text line, rather than relying on native Button defaults or ancestor text alignment; this is part of the local wrapping adaptation. Font family and existing paint/state remain unchanged.

Upstream uses fixed height and no-wrap. Minimum height and wrapping are a Proto UI adaptation for the owner's narrow-screen/enlarged-text requirement, not upstream equivalence: constrained long or unbroken labels may increase command height; no clipping, ellipsis, fixed width or maximum height. `min-w-0 max-w-full whitespace-normal wrap-anywhere text-center` permits wrapping within available width. Width remains consumer-owned. Do not add an invisible expanded hit region or claim a 44px accessible touch target.

Keep exactly one `asDrawerTrigger()` or `asDrawerClose()`; no `asButton()`, new activation listener, DOM inspection, prop or public anatomy. Base behavior, controlled refusal, disabled logic, portal, gesture, focus, scroll and disposal remain unchanged. No Compiler, IR, Adapter or Focus changes.

## Acceptance

1. Independent contract-derived source/token expectations reject both old recipes and preserve existing paint/state tokens; assert no shadow/transform bundle was added and exactly one Drawer hook remains.
2. Real source-host contributions and complete-family normal Document and Shadow CSS lower minimum height2.5rem, inline padding1rem, block padding0.5rem, typography0.875rem/1.25rem, weight500 and radius `var(--pui-radius)` with family default5px, plus wrapping, without unsupported-token diagnostics. Distinguish CSS closure from native painted geometry.
3. Preserve existing request, controlled, disabled, focus, gesture and lifecycle regressions. Check single Trigger/Close request, reopen and final disposal. Do not weaken existing tests.
4. Before native visual acceptance, collect exact-source WC/React/Vue/Vue2 receipts in light/dark, normal/narrow320px, root32 and long/unbroken labels. Measure border-box, all border/padding/font/root metrics, min/max-height, rect/scroll/client sizes and Shadow visual surface separately; verify40px normal,80px root32 and unclipped constrained-label growth. Constrain the long-label command container to160px at root16 and240px at root32, both greater than inline padding plus borders; use a repeated sentence and an unbroken identifier. An arbitrarily narrower box below that physical floor has no absolute no-overflow guarantee. Root scaling is not browser zoom.
5. Native hit probes inside/just outside command edges, pointer open/close/reopen, Escape and exact-commit screenshots are independent evidence. Native/browser/GPUI not run remains debt, never inferred from source CSS or test registration.

Mapping: `packages/prototypes/brutalist/src/drawer/{trigger,close}.proto.ts`; planned `packages/prototypes/brutalist/test/drawer-command-density.test.ts`. No demo or Finf completion-count changes.

Agent: dot

## Separately authorized Website consumer follow-up (2026-10-11)

The original density-only implementation above excluded demo changes. Its subsequent official `6e82e3e8be3b9fc49ce8c9c173cc4a2d7bd41061` native run observed Trigger radius `5px` but portal Close radius `10px` at root16 and `20px` at root32 in all four runtimes and both schemes. Close inherited the page's `--pui-radius: 0.625rem` after leaving the family canvas. These 24 native failures remain baseline evidence; they do not redefine the expected family radius or prove later input steps passed.

This separately authorized consumer correction opts only the existing public Neo Drawer Content (`ref: 'panel'`) into the existing Website `previewTheme: 'portal'` API. The existing preview composition projects the complete selected family theme through the normalized surface channel, including updates while portaled, close/reopen and disposal. The missing consumer metadata is the defect; there is no new theme rule, public API, automatic inheritance guarantee, Prototype constant or Adapter/Compiler change. Existing paint tokens remain unchanged, although supplying their intended theme may change rendered colors as well as radius. Full upstream paint equivalence remains unclaimed.

The real public-demo four-runtime source-host regression checks the complete theme map, the independently expected `5px` radius input, light/dark updates, physical portal migration, reopening and stale API cleanup without mutating page theme variables. Those checks prove consumer ownership and realization inputs, not native computed paint. The native `5px` oracle stays intact; the repaired candidate still requires fresh official native evidence.
