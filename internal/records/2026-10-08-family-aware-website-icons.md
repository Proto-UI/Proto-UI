# Family-aware website icon projection

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and authority

Current human direction: replace decorative character substitutes with appropriate real icons, Shadcn using Lucide and other families retaining their own visual language. Base: PR #872 head `8e8c4ca21801378c11ea055f8f39796f86eeeda6`. This is a website projection change, not a new core icon contract. Existing Base controls intentionally leave artwork to consumers; Lucide fixed icon factories provide the current governed SVG capability. Bootstrap checkbox's existing catalog explicitly uses independent artwork rather than Glyphicons.

## Coverage and decisions

- Gallery source/author and CTA arrows, and library overview detail arrows: static decorative SVG through `StaticFamilyIcon.astro`. Base/Shadcn/Lucide use the existing Lucide shape factories; Bootstrap uses original compact filled arrows, Brutalist original heavy square-ended arrows, Liquid Glass original rounded arrows. These original website drawings are not official Glyphicons or SF Symbols assets. No icon font or new package dependency.
- Hero whitepaper arrow uses the existing Lucide arrow-right factory through the same SSR/runtime home-action artwork mapping. The link remains named by readable text; decorative SVG is hidden from accessibility and unfocusable.
- Lucide gallery close action uses real Lucide X. Initial letter and failure exclamation placeholders become complete icon names; no-script explains preview/search/copy requirements, loading remains lazy, failure is indicated in a localized title and card accessible name.
- Homepage action feedback replaces check/dash pseudo-icons with localized explicit Activated / On / Off state text, preserving the existing polite status owner.
- Base Select demo and its WC/React/Vue/Vue2 snippets now use the existing Lucide chevron-down prototype; one fixed-icon loader is added, no full catalog import.
- Audited Shadcn, Brutalist, Bootstrap and Liquid Select / Accordion indicators and existing checkbox indicators: already real SVG or Lucide; no rewrite. Liquid has no checkbox package in this base.
- Preserve actual flow arrows, dimension multiplication signs, and brand text. Shared Gallery modifications are confined to the three link glyphs; the separately authored Liquid Card consumes the same frozen component API.

## Verification and cost

101 tests across 10 focused files pass, including Astro syntax/SSR compilation, icon dependency boundaries, actual homepage WC/React19 integration, all four runtime dialog/focus integration, and native host rendering. An initial broad run failed because this fresh worktree lacked package-local dependency links; after linking installed workspace dependencies, four remaining Chinese-language expectations were corrected from English Activated to 已触发. Final run passes all 101 cases. Tests use Happy DOM; this is not a native browser paint claim.

Astro check first reported five missing generated shadow-style modules; after the normal style generator, final Astro check passes: 619 files, zero errors, zero warnings, nine hints. Initial workspace tsc also lacked package-local links and generated style artifacts; after the normal setup, final workspace tsc passes. Final integration owns aggregate verification.

Measured isolated `home-action-icons.ts` browser ESM with installed esbuild, bundling/minification and Node gzip: base 856 raw / 518 gzip bytes; candidate 5694 raw / 2136 gzip bytes, delta +4838 raw / +1618 gzip bytes. This honestly includes the actual fixed Lucide module graph, not only the SVG path. It is not a claim about whole-site production delta; final integrated production graph remains to measure. Static Astro arrows add HTML/CSS, not a hydration bundle. No numeric budget was changed.

## Evidence debt and handoff

No screenshot is attached to this local-only commit. Fresh source-bound desktop/mobile, no-JS and family-card visuals must be captured against the integrated exact head, including Hero, gallery, overview, Lucide loading/error and Base Select. Do not reuse prior screenshots. Full production build, official CI and independent review remain required. No remote push or PR comment was performed here.
