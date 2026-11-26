# Website native-link visual Prototype

## Revised direction

The current user direction requires website control styling to dogfood existing Proto UI components or an explicitly website-owned Prototype. This supersedes the CSS-only visual endpoint recorded for #559 and repeated in `2026-10-02-homepage-dogfood-refresh.md`; it does not supersede native link semantics or admit a public Base Link API.

The prior decisions remain historical evidence:

- https://github.com/Proto-UI/Proto-UI/issues/559#issuecomment-5457587011
- https://github.com/Proto-UI/Proto-UI/issues/559#issuecomment-5481388500

## Bounded experimental composition

`apps/www/src/prototypes/site-link-surface.proto.ts` is an application-owned passive visual Prototype. A real native anchor remains the only navigation, accessibility-name, tab-stop and activation owner. Its child Prototype owns shape, fill, family tokens and controlled visual feedback. It does not use `asButton`, `asTrigger`, `asFocusable`, `asChild`, synthetic activation or a new native-property channel in Template.

The host bridge observes hover, native focus-visible, primary press and current-route facts and supplies a complete visual-props bag. Every update retains family, appearance, emphasis and icon identity; the WC adapter's raw-props replacement is not treated as an implicit merge. Disposal revokes listeners and clears transient presentation facts. A stale homepage generation ignores preference side effects without intercepting native link activation; its existing inert/reveal boundary remains responsible for staging.

The four social glyphs share one visual contract and one glyph source for SSR and runtime rendering. Homepage social links join the existing four-runtime transaction. Static documentation header links use the same passive Prototype through the existing WC adapter. Primary navigation, compact icon links, branding, and emphasized hero actions may retain distinct density and emphasis within a shared family language.

The website token generator unions package and app-owned Prototype tokens into the existing single generated stylesheet through the CLI's token compiler. It does not append a second global reset or hand-author a parallel visual CSS recipe. Native-anchor CSS contains composition/layout resets only. Native SSR destinations remain complete if JavaScript is unavailable; client Prototype registration is not presented as SSR Prototype rendering.

Review found that `whitespace-normal` had no CLI lowering and that the base `whitespace-nowrap` would remain effective. The bounded correction keeps `nowrap` only on non-text appearances; current text-link hosts retain normal document wrapping. A collector-to-compiler regression rejects unsupported website tokens and checks text/non-text token switching. No public compiler or semantic-merge behavior is expanded. The initial homepage props bag also carries native `aria-current` truth before the staged generation permits host-event updates; a staged-to-active test checks current presentation without user input.

## Existing contracts remain unchanged

`C-TEMPLATE-0001` keeps returned Template children distinct from the host root. `C-TEMPLATE-0003` keeps ordinary Template props style-only: `renderer.el('a', { href, target, rel }, ...)` is not an admitted path. The website host-composition renderer already supports an actual native `a` containing a passive Proto child. No official Adapter or Base Prototype contract, package export, lifecycle or compatibility guarantee changes here.

## Remaining work is explicit

This slice does not complete the entire website dogfood program. The docs `SiteTitle.astro` brand link has not opted into the bridge, unlike the homepage brand. Sidebar links and disclosure summaries, TOC/in-view links, pagination links, WIP badges, the settings panel shell, Search trigger/close/retry, native dialog presentation and Pagefind input/result controls still have CSS-owned visuals. Search service/indexing ownership does not exempt website-owned command controls from migration. Markdown typography, page layout, routing, native link activation and existing current-route/scroll truth retain their existing owners.

The browser suite `site-native-links.browser.test.ts` covers four-runtime/family identity, social visual geometry, native input/new-tab semantics and no-JavaScript destinations. Its assertions distinguish baseline hard shadow from actual focus-ring width/color/offset and unclipped target geometry; compare hover/press/current paint before and after host facts; and inspect a trusted native context-menu event's final `defaultPrevented` value. Current-route changes in this test are explicitly host-attribute fixtures, not proof of route-selection behavior. The native anchor's separate browser outline is recorded for rendered-image review rather than silently removed. Local headless Chromium is unavailable under this task's sandbox; browser acceptance and exact-commit screenshots must come from the managed GitHub Actions path. Source/shape or happy-dom checks alone are not visual acceptance, and #559/#420 remain open until their broader evidence and integration conditions are satisfied.

Co-author by OpenAI Dots
