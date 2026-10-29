# Header control composition — static candidate, not verified delivery

Base: `9ab0fcad0fd9b5b49513a6b335e5007abea2d844`. Current user-directed scope: visible Select border/background, consistent neighboring command buttons, language always a Select, navigation ghost feedback and coherent alignment.

## Ownership and decisions

- Latest user direction supersedes the earlier framed-extension proposal: Header Select uses the public Rhea default (its own input background/border), while Search/theme/menu remain actual Buttons using native Rhea secondary. Search is never repurposed as Select, and no ghost/transparent paint layer subtracts either control's native background. No Select prototype/default changes remain in this candidate.
- Composition selects profile/variant; public prototypes own radius, colors, focus and interaction states. surfaceStyle only provides wrapping and the common2.75rem target. The shared layout does not repaint these controls.
- Runtime/family settings use a single visual row with retained Trigger accessible names. The Header's shared centered4.5rem desktop row then provides block breathing room without positioning labels at the viewport boundary.
- Header navigation uses the public minimal action appearance inside real anchors. Hover/current background replaces the shared nav/text underline; current remains an application route fact, and body text links keep underline.
- Locale routing is application policy. The shared Select composition must preserve locale routes, current values, focus, state retirement and query/hash.

## Evidence and limits

Static official upstream inspection: shadcn/ui `3d98900e9b73c45f035f8109e9d41ba6a51685e7` `apps/v4/components/main-nav.tsx` uses ghost Button/asChild; style-rhea.css separates form/control recipes. Current screenshots were privately inspected, not copied to public evidence. No borrowed upstream source was executed.

Authored tests cover explicit header recipes, preserved body-link decoration, four-Runtime composition anatomy/accessibility and native profile selection. Tests, types, formatting, generated presets, browser screenshots and full CI have **not run** on this candidate. No native acceptance, pixel-equivalence, independent approval, lifecycle promotion or merge claimed.

Required next checks: source-to-generated-token closure using the real generator; both profiles and Field invalid precedence; both families/four Web runtimes; 16/20/24px root fonts, 200% text, 320/390/1280 widths; real hover/focus/disabled; locale fallback/focus and live generation changes. Header popup Presence/motion, Tabs spacing (#909), Command anatomy (#907), and Progress/Slider profile (#910) are separately coordinated follow-through, not delivered by this first slice.

## Full-width chrome composition (20:45 UTC direction)

Header is a sibling of the reading canvas, not its child. This removes the 85rem PageFrame cap and nested82.5rem cap from Header only; reading columns stay bounded. Shared Header uses a 1–2rem safe edge gutter, 4.5rem desktop row and unchanged2.75rem control targets; compact3.5rem row remains. The old homepage end-alignment label-row compensation is removed because controls expose names accessibly in one row. These are shared composition layout responsibilities, not per-page paint overrides. Existing measured header offset stays authoritative; startup desktop/medium estimates follow the larger row. Browser acceptance must cover widths320/390/1280/1920 plus root enlargement, sticky scrolling, anchor clearance and compact popup positioning. No browser result is claimed yet.

## Theme startup consistency

Docs ThemeToggle and homepage native theme fallback now snapshot the same public Header Button recipe as enhancement. All three paths share icon target geometry (2.75rem), avoiding a32px SSR/44px live difference. The WC registrar seeds full props in the adapter's existing WeakMap before define upgrades connected hosts. This prevents the initial mount from consuming default primary Button props. Static source confirms the old ordering gap; no assertion is made that it alone explains the reported black square, because no continuous-frame candidate browser capture has run. Focus-visible rules are untouched.

## Isolated verification update — 2026-10-29 21:54 UTC

The preceding “not run” paragraph records the earlier static stage, not the current verification status. The maintainer explicitly approved isolated execution of fixed patch SHA256 `5c87fd519cc0e71e572e6edad2521b8fdac2f3d2b9557a13203337c4ff0b228d` at 21:25 UTC. All 11,761 base source blobs were checked against the exact Git tree before applying it. Original Node 24 / pnpm 10.32.1 locked tooling ran in an empty-HOME, no-account environment with Internet sockets denied.

| Check | Actual result |
| --- | --- |
| Governed orient / trace / validate resolver | Unblocked, executed |
| Focused Vitest, 11 files | 152/153 passed; one existing Luma action radius oracle failed |
| Exact-base recipe/test control for that failure | Same `rounded-lg` expectation failed; this is not a full pristine baseline suite |
| Original styles preset generator and preset check | Passed; motion palette 13 tests passed |
| Original website style generator | Passed, 990 style tokens resolved |
| Workspace type check | Passed |
| Catalog check | Failed: 497 uncataloged entries on unchanged catalog/prototype inputs; not waived or painted green |
| Original formatter and diff whitespace check | Passed; formatter-only derivative of approved production source |
| Local real-browser admission | Blocked before any page: Unix socket EPERM, then platform sandbox setup failure on the one permitted escalation |

The existing registered Header browser probe has been updated for native Rhea input paint, translucent Rhea Surface and 44px targets. It additionally records shared width/locale anatomy at 320/390/1280/1920 and consecutive docs theme-button startup animation frames. This test-source addition is **not locally browser-executed**; the original hosted workflow is the next evidence route. Historical flat negative stays bound to its original immutable SHA. Popup contrast checks use both black/white backdrop extremes for a conservative translucent-surface bound, not raw translucent RGB claimed as composited pixels.

No candidate screenshot, first-frame visual fix, keyboard/pointer acceptance, no-JS navigation or green full suite is claimed. Missing browser captures remain pending and must bind the actual published development commit. Root-font enlargement, 200% text, slow loading and remaining acceptance breadth are also pending; these cannot be inferred from unit tests. Search input/results (#1038), density (#1039), Sidebar persistence/order (#1040), outer columns (#1041) and docs completeness (#1042) remain separate.

## First exact-head hosted result and bounded follow-up

Header workflow [40962297157](https://github.com/Proto-UI/Proto-UI/actions/runs/40962297157), head `818fa3cd6f89c96d34e181265d7c06fafbac3708`: family matrix actually executed, **16 home cases failed / 2 docs startup cases passed**. The eight docs width/theme journeys recorded 108–115 consecutive observable frames each, including both undefined and defined custom-element states; all sampled target sizes were 44px and corner radii 18px. This covers the measured ordinary-load window, not every possible cold/slow-loading condition. Artifact [12936397804](https://github.com/Proto-UI/Proto-UI/actions/runs/40962297157/artifacts/12936397804), SHA256 `a07af18a9fe1a4290aae6aba96eb934ede450e0885bed9b6214df13659b2e5e6`, contains 349 files. Actual inspected captures include docs light1920 ready, docs dark320 DOMContentLoaded, Shadcn WC light failure and Brutalist React light320 failure. Header expanded edges and native control paint are visible; this is not a passing whole-home journey. These images bind only 818fa3cd, never the follow-up source.

Home failures exposed an actual composition error: Select's governed `accessible.nameFromContent()` clears the attempted manual `aria-label`; compact labels were removed from semantic content. The follow-up places exactly one visually hidden label inside Trigger content, preserves its independent selected Value, and stops writing the competing attribute. Browser assertions now use the complete actual accessible name (stable field-label prefix plus current option) for both families/four runtimes, not attribute presence.

Two 320px cases additionally measured document scrollWidth382 while the Header itself remained at0–320. The follow-up keeps a hard Header overflow oracle and records document-wide overflow plus culprit bounds as an unresolved #933 gallery/page defect; it does not claim the full page fits or conceal overflow with CSS. The original failure evidence is retained. The startup sampler also fails if its frame bound is exhausted before completion.

Other exact-head results are independent debts: docs build completed654pages, then the preview artifact admission failed its existing100MiB expanded-size limit; V2 optical native-window-blur observation failed. Neither is silently waived or asserted to be a reproduced baseline failure. The follow-up is statically reviewed; new source/probe results remain pending the next original CI run.

The existing visual-density candidate-only desktop oracle also still expected36px. Its single target-height assertion follows the accepted44px Header contract; the immutable historical baseline and all other visual-density checks stay unchanged. The independent homepage-composition suite remains4 Shadcn-host failures/7passes for whole-document horizontal overflow, so separating Header-specific measurements does not remove the full-page gate.

The same first run’s historical-flat job also failed8/8 at hover displacement (-4px versus its expected0), before the intended focus-ring negative. The follow-up restores its original visible-label native-click preparation instead of applying the new compact-label outside-click procedure to the old source. The immutable source, displacement oracle and intended negative remain unchanged; no successful historical reproduction is claimed until rerun.

## Follow-up: actual 818 homepage overflow at the intermediate breakpoint

The original hosted homepage-composition artifact12937945321 (run40962297376, exact818fa3cd) was downloaded and its WC Shadcn failure PNG personally viewed. Its JSON records viewport1180, documentWidth1182; the Search label/shortcut visibly escape the compact button. The homepage grid switches to a44px Search column at 79.999rem, while the old shared copy-hiding rule only switched at68.749rem. This is a Header composition inconsistency, not a reason to attribute all whole-document overflow to Gallery. Old4-host failures remain preserved.

The responsive grid owner now supplies width/padding/alignment/copy-display/margin inputs together, consumed by the same startup/enhanced Search Button composition. No prototype paint, accessible name, Dialog behavior, or generic Rhea default is changed. Browser coverage adds1099/1100/1180/1279 to existing widths, checks Search own scroll containment and44px/hidden decorative copy in compact modes. The whole-page homepage-composition overflow assertion remains intact.

Only source review and the original locked formatter ran locally on this new increment. It has not been executed as UI locally; original hosted CI must validate the new exact commit. The818 screenshot is failure evidence, not a new-candidate effect screenshot. d8fa CI remains separately pending.
