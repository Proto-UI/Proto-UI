# Scroll Area corner evidence / PR #779

This branch contains evidence only and must not be merged into product code.

## Source and execution binding

- Baseline production source: `42aaca074eb4c1532545fe554d1ee9bc3d0a8891`
- Current candidate and harness: `b9cd3884591b033b39e07db1cebf4e63c7b125bb`
- [Passing baseline/candidate browser run 37106082004](https://github.com/Proto-UI/Proto-UI/actions/runs/37106082004)
- Both runs use Node 24, pnpm 10.32.1 and runner-provided real Chromium against the actual public documentation demo routes. Astro's official development-toolbar preference is disabled and read back equally for both subjects.
- Baseline capture-only does not claim candidate acceptance. Each PNG has an adjacent JSON with production SHA, harness SHA, family, runtime, state and document-space geometry.
- All 24 current-run images were visually inspected. They show only public Proto UI component surfaces. No private reference image or unrelated screen content is published.

## Measured comparison

For all four runtimes (Web Components, React, Vue, Vue 2), baseline Brutalist tracks overlap in a 16×16 CSS-pixel area and baseline Shadcn tracks overlap in a 10×10 area. Current candidate track intersections have zero area in both the initial and end-focused states. The rendered corner hit belongs to the Root and neither track. The current suite passes real pointer dragging to both scroll endpoints, hidden-track transitions, a 22.5px thickness change, dynamic overflow, and unchanged focus geometry.

Browse [baseline initial captures](b9cd388/baseline/) and [candidate initial/end-focused captures](b9cd388/candidate/). These are real captures, not mockups. A far-right and far-bottom scroll can naturally place short text rows outside the viewport; the end-focused image also shows the inherited focus indicator and both thumbs at their ends.

## Retained first-run result

[Run 37105594923](https://github.com/Proto-UI/Proto-UI/actions/runs/37105594923) used source/harness `0117043eb88ece2f72c2ec94de4c244981901558`. Its four Shadcn journeys passed. Brutalist WC's corner geometry/hit test passed but horizontal dragging failed with 216px remaining; its [initial capture](0117043/candidate/brutalist-wc-initial.png) visibly retains the Astro development toolbar over the horizontal Thumb. The [original captures](0117043/candidate/) remain bound to that earlier SHA and are not presented as current-head images.

## Remaining boundary

The corner suite is two family tests containing eight full runtime journeys. It is not a complete repository CI or accessibility certification. Full CI and independent GitHub acceptance are tracked separately in [PR #779](https://github.com/Proto-UI/Proto-UI/pull/779). The four-part Base anatomy and draft lifecycle remain; horizontal RTL normalization is not added.

Co-author by OpenAI Dots
