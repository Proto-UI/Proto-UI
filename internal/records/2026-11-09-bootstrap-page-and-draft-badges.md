# Bootstrap page contrast, navbar and draft badges

Agent: dot, acting for cyjin-yl under the current user-directed repair request.
Base: `0607c6c5c386b8a932ab850e92a8873b2121dc45`.
Scope: existing Bootstrap 2.3.2 visual projection, website Header and native action links, and draft sidebar labels. This is not full-family stable admission, a release, or a claim on the separate Compiler/IR or docs Popover workstreams.

## Observed problems and decisions

The supplied screenshots show dark page text and navigation painted with `#333`, a family label wrapping its status to a second line, rectangular CTA links unlike the ordinary Button, and inline parenthetical draft markers. Source tracing confirmed that Bootstrap `THEME.dark` was identical to light; native action links fell through the Shadcn action recipe; Header had no Bootstrap navbar frame and allotted only 7.5rem minimum to its family selector.

- Preserve the original light palette and add an explicitly named Proto UI dark adaptation. Bootstrap 2.3.2 did not supply a standard dark page theme. Pair readable page/surface ink with its actual background. White historical Checkbox/CheckboxGroup/Slider surfaces explicitly retain `#333` rather than inheriting the new light-on-dark ink. Select and editor controls retain paired light surface paint. Composed Dialog/AlertDialog/Drawer use semantic background/foreground throughout so nested Form/Field/Label/Text cannot inherit light-on-dark ink on a fixed white container. Popover titles, Calendar today/hover/press, and selected DataTable rows also use paired semantic fills. The light Popover title changes from #f7f7f7 to the secondary #f5f5f5; the today fill uses muted #e6e6e6.
- Muted Text uses the family semantic muted foreground rather than hard-coded `#999`. Fieldset supporting descriptions also use semantic muted ink. Accordion, Collapsible and HoverCard hover/focus retain underline and use readable semantic foreground instead of the light-only historical `#005580` (2.250:1 on the dark page).
- The website Header uses the official 2.3.2 static-top navbar frame: vertical gradient, bottom border and restrained shadow. It uses family-owned palette values, independent of the preserved Shadcn staging bank. At ordinary desktop width the complete runtime and family names receive 12rem each; the existing responsive disclosure/reflow still owns narrow screens and enlarged text.
- Native CTA anchors retain their href, focus, browser navigation and modified-click semantics. The Bootstrap public passive action recipe reuses ordinary Button dimensions and state paint, with no nested Button and no page-specific paint substitute. Existing Shadcn/Brutalist recipes remain unchanged.
- All 161 `(Draft)`/`（草案）` sidebar labels use a separate `Early draft` badge through the existing Starlight pipeline. Names, URLs and order are preserved. WIP and Experimental labels remain separate states. Counts: Base 31, Shadcn 34, Brutalist 35, Bootstrap 30, Liquid Glass 31.

## Sources

- https://getbootstrap.com/2.3.2/components.html#navbar
- https://getbootstrap.com/2.3.2/base-css.html#buttons
- https://github.com/twbs/bootstrap/blob/v2.3.2/less/navbar.less
- Existing Apache-2.0 attribution: `packages/prototypes/bootstrap-2-3-2/THIRD_PARTY_NOTICES.md`.
- Applicable draft identities: `P-BOOTSTRAP-2-3-2-SURFACE`, `P-BOOTSTRAP-2-3-2-TEXT`; native anchors remain consumers of passive Surface/Text, not new semantic prototypes.
- Related existing tracking: #1148, #1161, #792. No full-family checkbox is earned by this bounded repair.

## Actual validation and remaining debt

Development evidence, before a final commit, in the dot environment with Node 24.22.1 and pinned pnpm 10.32.1:

- Sidebar, existing controls and projection-theme suites: 24 tests passed.
- CTA, ordinary Button, Thumbnail, native link recipe and homepage-runtime suites: 72 tests passed after correcting one test argument's structural type.
- New theme suite: 6 tests passed, including WCAG 2.2 1.4.3 normal-text contrast >=4.5 for page/secondary/navbar text pairs. This is not a full historic Button palette accessibility claim.
- Dialog/AlertDialog/Drawer: separate modal record documents 35 passing tests and catalog validation.
- Combined Bootstrap family and affected website tests passed 210 cases before the additional composition review fixes; the later full Bootstrap family suite passed 143 cases. These counts describe distinct runs, not an additive total.
- The Header bank/layout contract tests passed 2 cases.
- Final frozen combined candidate: 23 Bootstrap/affected website files, 187 tests passed with one worker. Canonical style generation and check passed (13 checker tests), lifecycle authoring checked 16 changed catalog inputs after reconciling the HoverCard draft hover-color criterion with the semantic dark adaptation, and prototype catalog passed with 7 checker tests. The shared frozen Bootstrap + Select + homepage candidate passed workspace TypeScript and Astro check (1184 files, 0 errors, 0 warnings, 25 hints) with a 6 GiB heap. These are local results, not GitHub CI or native visual acceptance.
- Canonical style generation initially rejected unsupported arbitrary ring colors in CloseIcon. These were replaced with existing ring tokens; `styles:preset:generate` then succeeded. Generated files were not hand-edited.
- Initial default-heap type checks exhausted the approximately 2 GiB JS heap; the retry uses 6 GiB. Workspace TypeScript then passed with no diagnostics. Astro check inspected 1183 files with 0 errors, 0 warnings and 25 hints. Do not treat the original OOM as a successful check.
- A real Astro local homepage returned HTTP 200. Chromium could not launch: `process_singleton_posix.cc:297 socket() failed: Operation not permitted`. A single platform-reviewed `require_escalated` attempt produced the same failure. No browser page rendered and no screenshots were captured. No security settings or sandbox restrictions were changed.

Browser acceptance remains open: desktop/mobile and enlarged-text Header fit; every dark/light composed surface; CTA hover/focus/press; Dialog/AlertDialog open/close/interruption and native focus; badge wrapping and contrast in each family. CI and independent technical review are separate exact-head results, not implied by these local tests. Independent scoped code review identified and reconciled two P1 and two P2 dark-composition regressions. The final review found no remaining code blocker in Bootstrap and badge scope; it was not browser acceptance or a GitHub APPROVE.

Only the user's own project source and trusted registry tooling ran; fixed Bootstrap upstream sources were read statically, not executed.
