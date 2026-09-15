# 2026-09-05 shadcn Tooltip provenance boundary

> Internal record. Not normative. Stable semantics remain governed by `spec/**`.

## Pinned comparison source

- Repository: `shadcn-ui/ui`
- Revision: `f31ed81983653919dd4fe77aee4b4859f610f1dc`
- Path: `apps/v4/registry/new-york-v4/ui/tooltip.tsx`
- License: MIT (`LICENSE.md` at the same revision)
- Repository attribution: `packages/prototypes/shadcn/THIRD_PARTY_NOTICES.md`

The revision is a frozen comparison baseline, not a claim of API, DOM, or exact visual equivalence and not an upstream endorsement. Later upstream changes do not alter this draft automatically.

## Observed and transformed material

The projection follows the public Tooltip/TooltipProvider/TooltipTrigger/TooltipContent family shape. The Content recipe adopts `rounded-md px-3 py-1.5 text-xs` from the pinned source and combines it with Proto UI-local `border bg-popover text-popover-foreground shadow-md overflow-hidden` choices. Group `inline-flex` and Trigger hover, focus-visible, and pressed feedback are local Proto UI presentation.

No React component implementation, Radix call, prop spread, className merge, data-slot, Portal/Arrow JSX, animation recipe, icon, image, font, or other static asset is copied. Base Tooltip, modules, Runtime, and Adapters own open state, delays, disabled behavior, accessibility, presence, renderer Portal, Escape, and anchored positioning.

## Compatibility boundary

The pinned Provider defaults delay to 0ms; Proto UI keeps Base 700/100/300ms defaults. Pinned Content defaults `sideOffset` to 0; Proto UI keeps Base 4. Portal remains renderer-owned, and Arrow is omitted until a separately governed geometry channel exists.

## Contribution disclosure

The replacement of PR #534's Tooltip slice was materially assisted by OpenAI GPT-5.6 through Oh My Pi for current-main reconciliation, implementation, tests, spec, documentation, and validation. No employer, client, proprietary, or other private source code was provided. DCO remains the signer's responsibility; AI disclosure does not replace provenance or license review.
