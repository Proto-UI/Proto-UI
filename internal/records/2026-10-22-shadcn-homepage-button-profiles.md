# Source-bound homepage Button profiles

Date: 2026-10-22. Scope: #865 / #559, implemented in #926.

## Reference and decision

The user's homepage reference is not the documentation's Nova style. At fixed shadcn/ui [25af02b](https://github.com/shadcn-ui/ui/tree/25af02b1b467fcd53b63e0c6d6d324c57c16ef18):

- [Homepage card](<https://github.com/shadcn-ui/ui/blob/25af02b1b467fcd53b63e0c6d6d324c57c16ef18/apps/v4/app/(app)/(root)/cards/ui-elements.tsx>) imports base-rhea. [Rhea](https://github.com/shadcn-ui/ui/blob/25af02b1b467fcd53b63e0c6d6d324c57c16ef18/apps/v4/registry/styles/style-rhea.css) uses default/sm/lg heights 32/28/36px at a 16px root, 14px/20px medium text, 12px default inline padding, 6px default gap and radius-2xl.
- [Homepage hero](<https://github.com/shadcn-ui/ui/blob/25af02b1b467fcd53b63e0c6d6d324c57c16ef18/apps/v4/app/(app)/(root)/page.tsx>) imports radix-luma. [Luma](https://github.com/shadcn-ui/ui/blob/25af02b1b467fcd53b63e0c6d6d324c57c16ef18/apps/v4/registry/styles/style-luma.css) uses 36/32/40px and radius-4xl with the same default text/padding/gap. The first upstream hero link has a page-local 35px override. Proto deliberately retains the public 36px profile rather than creating a one-off height API.

The public direct Button defaults to Rhea and exposes `styleProfile: rhea | luma`. The family passive action composition shares these profiles, while the authored website hero explicitly requests Luma. It remains a real anchor with its original href, keyboard and navigation semantics. Product wording and destinations are retained. Secondary hero paint is the profile's gray secondary variant, not an outlined/minimal link or external-link icon. No page-specific height, radius or selection override is added.

## Boundaries

- Surface/Text expose an opt-in actionProfile, defaulting to none. Resetting props restores their generic atom recipes. No Base Link, role, tabindex or activation owner is introduced.
- The existing independent AlertDialog/Drawer shared paint remains pinned to its previous contract. Select, Input, Toggle, Switch and unrelated navigation dimensions are not migrated.
- Proto wrap remains an explicit multiline extension. The separately named 28px icon-compact remains unchanged; unsupported xs/extra icon sizes, nested SVG spacing, aria-invalid and asChild are not claimed.
- The existing Web projection accepts only the two named profile radius expressions and the exact secondary/foreground 5% color mix. Generic rounded-2xl stays unchanged; unknown arbitrary expressions remain rejected.
- Native target parity, true Shadow selection coverage, and an exact upstream 35px first CTA remain outside this increment.

## Verification and failure history

Tests compare both public profiles across supported sizes and wrapping, restore ordinary Surface/Text defaults, verify exact generated CSS and negative unsupported expressions, and maintain the independent CLI consumer oracle. Existing browser tests retain native-anchor selection/navigation, ordinary Button input, copy behavior, and motion checks while adding profile geometry. New browser evidence must be bound to the published commit; source inspection and local tests are not visual acceptance.

Local migration checks initially exposed stale New York ghost/outline, padding and consumer class-leak expectations. These were updated to the fixed Rhea/Luma declarations, not broadened to accept both contracts. The Happy DOM CSS matcher also needed an exact active-token prefilter because commas inside the quoted color-mix token are not parsed correctly by that test DOM; real browser projection remains separately required. Full CI and independent approval remain distinct gates.

Pre-publication review caught a genuine preset-closure omission: a nested profile/size map resolved at runtime but lost size tokens during static extraction. New tests first failed for both public profiles against the actual generated preset. The family tables now use supported flat profile-size keys, and generation plus the same public-instance tests include every active size/wrap token. The extractor implementation is not changed and no generated token is patched by hand.

The separate prototype-catalog gate remains red: the same checker run with parent `616f86137edfca8c3debe2416d5fc965cf905f37` inputs and this candidate produced the identical 492 undeclared-debt errors, with no added or removed error lines. This is distinct from the CI family/export catalog gate; neither is reported as green.

For the frozen candidate, isolated validation passed 100 focused tests, 82 CLI consumer-oracle tests, the generated 500-token Shadcn preset and 13 preset-check tests, bounded specification graph/lifecycle checks, workspace/docs type checking (958 files, zero errors), and a 651-page documentation build. Browser geometry, light/dark paint, actual selection and motion remain pending the new commit's CI.

## Additional Copy consumer oracle audit

The existing code-surfaces browser oracle also carried the old ordinary icon 36px/md contract. It now requires exactly Rhea 32px/size-8/named 2xl radius while retaining the explicit compact 28px/size-7/md branch and its independent glyph, centering, focus and backplate assertions. Rhea outline background is compared exactly to the resolved public background token in light mode and transparency in dark mode; a bounded 2s observation waits for that exact transition endpoint, with no sleep, tolerance or repeated interaction. The old unconditional nontransparent expectation was not valid for the fixed source's dark outline recipe.

After this additional test-only migration, the full workspace/docs type check again passed (958 files, 0 errors) and the 651-page site build succeeded. These are not substitutes for the pending new-head browser run.
