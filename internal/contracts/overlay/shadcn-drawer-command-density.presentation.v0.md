# Shadcn Drawer command presentation (v0, bounded New York migration)

Status: proposed bounded presentation migrated on 2026-10-13 under the owner's fixed-reference direction. This is not full Drawer or Button acceptance. Draft `C-AS-HOOK-0001`, `C-FEEDBACK-STYLE-0003`, `C-FEEDBACK-STYLE-0004` and `C-AS-OVERLAY-0001` constrain composition and unchanged ownership.

## Reference and history

The current reference is shadcn/ui `02cad61166c4c20edbc8a3f71bd720eed4c1f49b`, New York:

- [Drawer demo lines 69–74 and 126–131](https://github.com/shadcn-ui/ui/blob/02cad61166c4c20edbc8a3f71bd720eed4c1f49b/apps/v4/registry/new-york-v4/examples/drawer-demo.tsx#L69-L131) composes Trigger and Close with outline Button, omitting size.
- [Button lines 6–41](https://github.com/shadcn-ui/ui/blob/02cad61166c4c20edbc8a3f71bd720eed4c1f49b/apps/v4/registry/new-york-v4/ui/button.tsx#L6-L41) supplies rounded-md, text-sm/font-medium, h-9 px-4 py-2 and nowrap. Outline uses border, background and shadow-xs, with separate hover, focus and dark paint.

The preceding 2026-10-11 contract used Base/Nova `c2a67849…` (32px, 10px inline padding, rounded-lg). That historical recipe and its 112 native density receipts do not certify the current New York migration. Git history retains the original definition and evidence.

## Ownership and presentation

Each command composes exactly one existing asDrawerTrigger or asDrawerClose. It consumes shared passive New York Button token constants from `packages/prototypes/shadcn/src/button/paint.ts`; no second asButton, activation listener or host inspection is introduced. Root open/request ownership, controlled refusal, disabled suppression, focus and disposal remain unchanged.

Default `wrap=false` uses fixed 2.25rem border-box height, 1rem inline and 0.5rem block padding, font 0.875rem/1.25rem and weight 500. Its rounded-md intent is preserved. Default height is 36px at root16 and 72px at root32; do not replace it with min-height plus py-2, which creates a different natural bordered box. The existing family theme realizes radius-md as radius minus 2px; that coincides at root16 with the upstream app demo's global radius times 0.8 but diverges at root32. The installable neutral theme only defines radius itself; selecting and migrating the shared radius mapping remains separate.

The explicit local `wrap=true` extension uses the shared Button wrap recipe: min-h-9 h-auto px-4 py-1 whitespace-normal min-w-0 max-w-full wrap-anywhere text-center. A sufficiently constrained multiline label grows beyond 2.25rem. Its smaller block padding is intentional local behavior, not an assertion of exact upstream fixed-height equivalence. Switching either way removes stale fixed/minimum height and no-wrap/wrap contributions.

Hover uses the existing hovered State, focus the existing focusVisible State, and disabled the existing disabled State. Bounded shared paint includes outline shadow, hover accent, ring-3/ring-ring/50, and disabled opacity/pointer suppression. Dark outline paint, icon-specific padding, invalid state, reduced-motion handling for generic transition-all and full Button equivalence remain unverified or incomplete.

## Acceptance

1. Independent source oracles reject the former Nova default and establish one behavior owner, shared passive paint and no component-specific host logic.
2. Source-host default and explicit wrap contributions lower in Document and Shadow without unsupported tokens. Toggling wrap restores the correct recipe. Test one activation request, controlled refusal, disabled state, reopen and terminal cleanup.
3. Exact-head native density cases must now measure 36/72px defaults and separately request wrap for constrained long/unbroken labels. Do not reuse the former 32/64px receipts. Keep actual radius/paint gaps visible and retain the Brutalist family's independent recipe and oracle.
4. Native hit testing, actual text fit, light/dark paint, screenshots and GPUI remain separately required. Source/CSS closure is not native acceptance or a 44px target guarantee.

Mapping: `packages/prototypes/shadcn/src/drawer/trigger.proto.ts`, `close.proto.ts`, `types.ts`, `packages/prototypes/shadcn/test/drawer-command-density.test.ts`, and `apps/www/src/content/docs/zh-cn/finf-drawer-command-density.browser.test.ts`.

Agent: dot
