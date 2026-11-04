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


## 23:35 UTC public Select author-name correction

Actual Header038 run40967859499: flat job success; family16fail/2pass. All home cases stopped at absent combobox author names. The real accessibility snapshot contained selected text but no name. WAI-ARIA1.2 combobox has Name From: author (https://www.w3.org/TR/wai-aria-1.2/#combobox); the earlier sr-only content-derived repair was insufficient.

Optional Base SelectTrigger `accessibleLabel` is now proposed through the existing accessibility name state. Header Runtime/family/locale pass a stable field label; Value retains the selected content independently. Field labelledBy retains standard precedence. Empty/absent author labels intentionally do not invent a name or turn the selected value into a label. No raw DOM attribute restoration, new Field holder or selection/open owner.

Migration scope: ordinary Select's previous nameFromContent projection already cleared raw aria-label attributes. The new empty-name projection preserves that physical behavior; consumers that previously supplied only raw aria-label or selected text must adopt the public author label or Field composition. This patch repairs the Header consumers, not every existing Select demo or the full-family accessibility debt. Existing non-Header consumers require a separate source/actual accessible-tree sweep. Field tests establish both attributes/relationship target; real native Field name precedence and all-host current-value exposure remain browser acceptance debt, not proven by DOM attributes alone.

Exact038 artifact12940913189 downloaded and inspected; docs-dark-1280-ready.png viewed. Source-bound failure images remain available; no image is attributed to this newer candidate. Current candidate Base/composition tests are authored but unexecuted locally; T author-name implementations stay planned. Search original hosted suite20fail/10pass remains independently diagnosed, not absorbed or waived here. No main merge or complete Header acceptance claimed.

## 2026-11-04 family-specific current navigation projection oracle

The decision recorded above — "Header navigation uses the public minimal action appearance inside real anchors. Hover/current background replaces the shared nav/text underline; current remains an application route fact, and body text links keep underline" — is now enforced as an executable, family/role-correct oracle instead of a shared underline expectation.

Why this changed: `apps/www/src/content/docs/zh-cn/site-native-links.browser.test.ts` asserted `underline` in the current projection for every family. The authored Rhea minimal navigation recipe (`apps/www/src/components/site-link-recipes.ts`, `linkTextProps`) projects `weight: 'semibold'` with `decoration: 'none'` for a current Shadcn navigation row, and `linkSurfaceProps` maps that row's `current` fact onto the public ghost background (`hovered: facts.hovered || facts.current`). The Brutalist navigation row keeps its own underline on hover/current. The unconditional assertion therefore contradicted the authored recipe for one whole family.

What the oracle now states, per family and role:

- Shadcn navigation current: `font-semibold` weight, no text underline, and the ghost background (`bg-muted`) on the passive Surface.
- Brutalist navigation current: `font-semibold` weight, `underline` decoration, and a decoration change against the non-current baseline. Every pre-existing Brutalist assertion is preserved unchanged.
- Body text links keep their underline; only the navigation role is family-specific.

The wrong-fact negative control is explicit rather than implied. `apps/www/src/components/site-link-recipes.test.ts` and `apps/www/src/prototypes/site-link-surface.test.ts` each build the current projection with the `current` fact removed and assert that the family contract fails (no `font-semibold`, no `underline`), then build it with the fact present and assert that only the owning family's contract holds. A wrong family fact is rejected the same way, so neither family's contract is satisfiable by the other's projection.

The physical matrix in `site-link-surface.test.ts` is corrected for the two role facts it previously conflated: the Shadcn navigation row is a public Rhea action profile and therefore shares the action press envelope (`translate-y-px`) and `ring-3` focus token with the other Shadcn action appearances, and the dense Sidebar/navigation-group rows legitimately carry no bottom margin (`0px`) while inline rows keep `1px` and Brutalist raised rows keep `0.25rem`. Both corrections match the authored recipe; neither weakens an assertion, and every Brutalist expectation is retained.

Evidence and limits: the affected light suites (`site-link-recipes.test.ts`, `site-link-surface.test.ts`) pass locally at 44/44. No browser, native or heavy run was executed for this repair, so no native acceptance is claimed; the native current-projection assertion remains browser acceptance debt for the owning native lane. `site-native-controls.initial-props.test.ts` and `site-native-controls.test.ts` still carry their own stale-owner expectations for the same Rhea profile and remain open in this branch; they are not weakened by this change and are not claimed as fixed here.

## 2026-11-04 dedicated Card evidence owner restored before integration

The exact-head GitHub review of `a4d38a66894331c965f914f535a8de6eeff3cdd8` identified a real composition regression: this child removed the `shadcn-card` matrix group, its browser-suite dispatch and its ten-case report admission, although the runtime inventory still excluded that suite from ordinary shards and named the representative-features workflow as its dedicated owner. The integration preflight detected the newly arrived review and stopped before any merge write.

The existing parent workflow's Card group, `PUI_SHADCN_CARD_EVIDENCE_DIR`, dispatch to `demo-shadcn-card.browser.test.ts`, and complete report validator are restored without changing the suite or its acceptance. A Node 24 smoke parsed the actual YAML and executed the actual selection shell: the old source had no Card group and selected the generic suite; the repaired source admits Card, selects the dedicated suite and binds its screenshot directory. The extracted real validator accepts all ten exact case identities and rejects pending, skipped, wrong-case and wrong-suite reports. This is workflow/report-boundary evidence, not a browser run or a claim that ten native cases passed.

The composed Rhea source had passed six focused suites, **159/159**, before this workflow-only repair. The subsequent Node 24 scheduling/planner command reported **18** scheduling-policy passes but its planner file did not finish within the 120-second command deadline (**one cancelled file**); it is not a successful combined run. The bounded workflow smoke receipt is `/tmp/release03-pr1275-card-owner-smoke-20261104.json`. All prior native, control-suite and full-cycle acceptance debt remains open; the historical GitHub thread is not silently marked resolved.

## 2026-11-04 ordinary Rhea Switch native-oracle correction

The parent integration guard stopped before a write when the exact-head review of `124378c0e78d811d12d8615610de4a404b77cae3` identified another migration mismatch. The ordinary Switch documentation now selects the public Rhea scope, but `demo-composed-style-isolation.browser.test.ts` still consumed the explicitly New York-only height fixture and labeled its receipt with the New York source. This is a stale consumer oracle, not permission to change the Switch implementation or its definition.

The draft `P-SHADCN-SWITCH-RHEA-SURFACE` specifies 20×32 and 16×24 at a 16px root font. The native consumer now expects Rhea default/small heights of 1.25rem/1rem, retaining both widths, both Thumb sizes, all named cases, runtimes, press trajectories and numeric tolerances. Its receipt identifies `styleProfile: rhea`, the cataloged `3d98900e9b73c45f035f8109e9d41ba6a51685e7` source, `styles/style-rhea.css` and its cataloged Git blob. The shared New York fixture, its source pin and compatibility expectations remain unchanged for its actual consumers.

A disposable Node 24/tsx smoke loaded the actual Switch DemoSpec: all five ordinary Switch Roots inherit its real Rhea scope and declare no leaf override. It loaded both old and repaired oracle modules without running browser callbacks, demonstrated the old source-unit mismatch at 16px and 32px root fonts, and checked the repaired values against the cataloged Rhea dimensions. `/tmp/release03-pr1211-switch-rhea-oracle-smoke-20261104.json` retains those modeled comparisons. They are not measured geometry or a passing native run; native four-runtime, visual and full-cycle acceptance remains open. The original review and unresolved thread remain retained, not falsely marked approved or resolved.
