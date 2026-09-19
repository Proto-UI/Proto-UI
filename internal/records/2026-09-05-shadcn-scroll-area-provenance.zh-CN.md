# 2026-09-05 shadcn Scroll Area provenance boundary

> Internal record. Not normative. Stable semantics remain governed by `spec/**`.

## Pinned comparison source

- Repository: `shadcn-ui/ui`
- Revision: `f31ed81983653919dd4fe77aee4b4859f610f1dc`
- Path: `apps/v4/registry/new-york-v4/ui/scroll-area.tsx`
- License: MIT (`LICENSE.md` at the same revision)
- Repository attribution: `packages/prototypes/shadcn/THIRD_PARTY_NOTICES.md`

The revision is a frozen comparison baseline, not a claim of API, DOM, or exact visual equivalence and not an upstream endorsement. Later upstream changes do not alter this draft automatically.

## Observed and transformed material

The projection follows the public Root, Viewport, Scrollbar, and Thumb family anatomy. It transforms the pinned public recipe into Proto UI style intent: Root `relative`, full-size rounded Viewport, inherited focus-visible ring/outline feedback, Scrollbar flex/touch/orientation geometry, and Thumb `relative flex-1 rounded-full bg-border`. Root `overflow-hidden`, `rounded-md` rather than inherited radius, absolute edge placement, transparent two-pixel track borders, and explicit composed preference are current Proto UI deltas.

No React component implementation, Radix call, prop spread, className merge, data-slot, Corner JSX, icon, image, font, or other static asset is copied. Base Scroll Area, the Scroll and Move modules, Host Capabilities, Runtime, and Adapters own position, extent, surface negotiation, pointer routing, focus participation, lifecycle, and accessibility.

## Contribution disclosure

The replacement of PR #534's Scroll Area slice was materially assisted by OpenAI GPT-5.6 through Oh My Pi for current-main reconciliation, implementation, tests, spec, documentation, and validation. No employer, client, proprietary, or other private source code was provided. DCO remains the signer's responsibility; AI disclosure does not replace provenance or license review.
