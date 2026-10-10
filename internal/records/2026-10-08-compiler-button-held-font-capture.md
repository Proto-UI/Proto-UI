# Compiler Button held-client font capture

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Red evidence and dependency

At `8e8c4ca21801378c11ea055f8f39796f86eeeda6`, the [exact native Compiler run 37816158073](https://github.com/Proto-UI/Proto-UI/actions/runs/37816158073) had 67/67 source checks and 20/21 browser journeys pass. The delayed journey stopped at `delayed-before.png`: Playwright waited 30 seconds for fonts before timing out. Its preceding snapshot records document `interactive`, visible 146.0625 × 39 geometry, radius 8px and `14px / 21px Arial, sans-serif`. That run did not prove the subsequent eight adoption frames or endpoint pixel equality.

The harness holds a parser-discovered deferred `/client.js` request until after the first screenshot. Playwright's `_preparePageForScreenshot` awaits `document.fonts.ready`. CSS Font Loading's [pending-on-the-environment rule](https://drafts.csswg.org/css-font-loading/#fontfaceset-pending-on-the-environment) includes an unfinished document. Thus a global ready wait depends on the same client release that the test intentionally performs only after capture. The fixture uses system fonts, not a downloadable-font request.

## Bounded repair

Only the delayed journey's two endpoint captures use native CDP viewport PNGs. They keep the original client network gate and defer tag. The font proof requires zero FontFace entries, computed-label availability, and nonempty actual system glyphs through `CSS.getPlatformFontsForNode`; a custom font or unavailable/incomplete evidence fails. The saved font JSON includes document readiness and whether the client has executed. The pre-release capture explicitly requires `interactive` and client absent. Endpoint font evidence must match, and all eight frame samples additionally compare computed font.

The strict native PNG SHA equality, visibility, radius, geometry, server-node identity and AX assertions remain. No timeout increase, global font-wait environment switch, font substitution, delayed-page-load workaround or product/SSR-profile change is included. All four public SSR profiles remain unavailable. The capture helper is a test driver, not generated product output; the ten-artifact allowlist and byte hashes are unchanged.

## Verification and limits

The source selection passes 68 tests (the existing 67 plus one test containing seven font negative cases). Controls reject web-font declarations, unavailable label fonts, absent labels, missing per-label CDP data, no glyph records, zero glyph counts and custom-font glyphs. Generated closure typechecking remains part of this selection. The final workspace TypeScript check passed with exit 0 after normal ignored stylesheet generation; `git diff --check` also passed.

An intermediate workspace typecheck caught three unintended replacements outside the delayed journey; those were restored before freezing. It also required the normal ignored stylesheet generator outputs in this new worktree. Native browser execution remains unavailable in this local sandbox due to its established socket restriction; no permission workaround was attempted. The earlier native red is retained, and exact-candidate official CI must supply all 21 native journeys, both new font JSON files, screenshots and eight-frame samples before claiming native green. Independent review remains required.
