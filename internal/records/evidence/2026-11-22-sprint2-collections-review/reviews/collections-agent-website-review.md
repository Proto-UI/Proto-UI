# Independent local review: Sprint 2 website slice

Reviewer: `/root/collections` (no implementation changes to the reviewed website slice).
Execution: human-assisted / current-user. Review class: local source and executable-consumer review; no GitHub review submission or whole-PR approval is claimed.

## Source binding

- Repository worktree: `/workspace/scratch/44c416809288/Proto-UI`.
- Base at review: `1746acca3fd5068afcf7e702536640a32fa437d2`.
- The candidate consists of the website changes on that base, not just the base commit.
- Original file hashes: `collections-agent-website-review-source.json` (18 files).
- Reviewed correction hashes: `collections-agent-website-review-source-r2.json` (20 files, observed 2026-11-22T11:14:58Z), including both Hook documentation routes and the corrected browser test.
- Hero focus correction hashes: `collections-agent-website-review-source-r3.json` (four files on integration head `f5de20585de610f777d3542c2176686d970d196d`, which includes the published website slice `4b3a9c84ff9b04fa6005f82ebe412332432ad43a`), independently reviewed as source; corrected native screenshot remains pending.
- Scoped test-environment correction hashes: `collections-agent-website-review-source-r4.json` on integration head `947524510b0df8cb936e28824cbd940811cfd946`, covering the native-controls test and the existing pinned Happy DOM observer keepalive helper.

## Scope and conclusions

Reviewed #1488 B/C/D and #1154's current rendered-document evidence child, including the root package/lock dependency change. Original Issue snapshots, `AGENTS.md`, `pui-review`, `P-SHADCN-STYLE-SCOPE` and `P-SHADCN-TABS` were read; the style guarantees remain draft and the review does not promote them.

### B: live profile consumer and actual Code

The new public DemoSpec updates the existing inner `profileScope` props. It does not replace the Tabs root, assign a new key, swap children, or copy a behavior state machine. The explicit modified shortcut permits a profile change while the tab retains native focus; profile button clicks retain their ordinary focus behavior. Cleanup removes the authored shortcut and rejects late changes. Static comparison descriptions are corrected in both locales.

The executable tests observe actual Base value/selected handles, public instance identity, focused node, child and content identity, disabled trigger and zero behavior changes while the visual profile changes. Separate actual host-boundary cases reject unknown profile IDs rather than allowing a fallback. The four displayed Code strings are parsed/built and executed against actual built package exports, without DemoRenderer or source aliases. `@vue/compiler-sfc` is now explicitly declared at the existing Vue compiler version in package.json and lockfile.

No source defect was found in this scoped implementation. Native page execution/captures must still be read at the final candidate.

### C: native navigation geometry

Group and leaf radius choices now share the selected family's public Surface values (`md` for Shadcn, `default` for Brutalist). The unenhanced Brutalist selector uses the existing generated `--site-brutalist-radius` instead of imposing Shadcn's radius. Existing native `summary` / `details`, anchor identity, current state, pointer ownership and text content remain the owners of interaction; the new change is passive presentation.

Unit assertions preserve hover/current, native disclosure identity, focusability and exact child restoration on release. The native runner covers enhanced and failed-script desktop presentation plus enhanced/no-JS mobile targets in both locales, and records computed paint/native target geometry. No native result or visual verdict is inferred from the token assertions; actual matrix results and captures are pending review.

### D: native Hero pill

The explicit `pill` appearance reaches both the HomeActions source and the common link resolver. Only ordinary `nav` / `text` appearances request underline, so real prose links retain their existing decoration. The Hero's actual native `a` retains its href and accessible text, receives a visible focus outline, and uses the existing non-underline background hover response. The ordinary-text-link negative control is present.

The later independent native screenshot review found duplicate focus paint in the enhanced Hero pill (SITE-REVIEW-002 below). The native journey assertions passed despite that visible defect because they required the native anchor outline in both fallback and enhanced modes without checking the passive Surface's simultaneous paint.

### #1154: rendered historical evidence

This scope verifies the current public projection; it does not rerun or accept the historical generic Hook candidate. The corrected pages retain the exit-1 R3 failure, unexecuted later assertions, 13 incomplete original conditions, and original checkbox boundary. The full-SHA linked JSON exists in Git and its `actualFixtureR3Disposition1112` records that same selection/failure boundary.

## Findings and reconciliation

### SITE-REVIEW-001 — P2, high confidence — corrected source; native rerun pending

Original location: `apps/www/src/content/docs/zh-cn/sprint2-site.browser.test.ts`, Hook evidence case, originally lines 408–414; corresponding EN/ZH `specifications/as-hook.mdx` R3 sections.

**Expected:** The rendered evidence section links to the real retained source-bound record, and the test distinguishes preserved historical failure/unaccepted conditions from mere mention of the issue and test IDs.

**Observed:** The original new test required a link containing `issue-1154-container-preparation`, but neither locale source contained one. The test would count zero and fail in both routes. Its keyword assertions (`13`, `R3`, issue ID) would also allow text falsely reporting historical acceptance.

**Impact:** The new browser gate could not complete, readers lacked a direct R3 source link, and the stated historical-boundary assertion was weak.

**Correction reviewed:** The implementation owner added the exact `dc3b184ba10b0de53e40359c52d012b204b2cd01` preparation JSON link in both R3 sections and added explicit rendered exit-1, unexecuted-freezing-assertions, and still-incomplete-conditions clauses. Git object/readback and both source paragraphs match. Final native rerun remains necessary; the original failing run must remain historical evidence.

A separate integration note was resolved: after accepting the collection recipe and slider-values demo, the Shadcn demo inventory expected count was updated from 76 to 78, and the actual inventory suite passes.

### SITE-REVIEW-002 — P2, high confidence — corrected source; native rerun pending

**Location:** New Hero focus rule in `apps/www/src/components/override/Hero.astro`, new `pill` appearance in the common site link recipe, and existing enhanced Homepage outline-owner reset in `apps/www/src/styles/site-native-links.css`.

**Expected:** The intentional pill has a coherent, visible non-underline keyboard-focus response, with one responsible focus-paint layer. Fallback native focus and forced-colors behavior remain available.

**Observed:** The actual r4 screenshot `site-r4-captures/hero-zh-cn-light-enhanced-focus.png` shows a rounded outer focus outline around the pill and a second rectangular focus frame around its inner text Surface. The new `a:focus-visible` rule paints the outer native anchor; the new `pill` appearance is absent from the existing enhanced Homepage duplicate-outline reset. The passive Surface still receives `focusVisible: true`, and the pill currently reaches the non-row/non-framed `radius: none` branch, explaining the inner rectangle.

**Impact:** The requested intentional pill presentation acquires competing focus geometry. The new browser test asserts a native-anchor outline even for enhanced mode, so it passes while preserving the visible double frame.

**Requested correction:** Choose and verify the single focus-paint owner for enhanced pill presentation, preserve native fallback and forced colors, and make the browser assertion distinguish those ownership modes. This is an implementation-owner change; the independent reviewer has not modified the source.

**Correction independently read:** The implementation owner suppresses the inner passive Surface's optional focus paint only for the pill appearance, preserving the actual native anchor as its single outer focus-paint owner. The existing rounded two-pixel anchor outline remains, and a forced-colors rule explicitly selects Highlight. Other appearances retain their prior Surface focus behavior. The native test now rejects any descendant outline or box shadow in normal and forced-color modes, while still requiring actual anchor focus, accessible name, href and Enter navigation. This distinguishes the reported double frame. No new source defect was found in that correction; a repaired capture and native assertion result are still required.

The owner retained a genuine red control (`hero-focus-red.log`, three family cases failed / 20 existing cases passed). The first follow-up file named `hero-focus-green.log` is **not a green result**: it contains 33 passes and one existing header-navigation assertion failure after clearing `aria-current`. The three new pill assertions passed. This failure remains in the evidence.

The owner traced that header failure to Happy DOM 15.11.7's internally weakly held mutation forwarding callback being collected between the two real mutations. I independently reran `observer-gc-probe.mjs` with `node --expose-gc`: without the keeper only the first `aria-current` mutation is observed; with the existing keeper both are observed. The test now installs that repository helper only in its Happy DOM lifecycle and restores it afterwards. Source review confirms that it retains the installed implementation's forwarding closures without replacing mutation notifications, records, filters or scheduling; disconnect releases its retention. The original product assertion is unchanged. The subsequent `hero-focus-green-r2.log` records **2 files / 34 passed**. This is a corrected test-environment prerequisite, not an assertion waiver or browser pass.

## Native evidence inspected

The implementation owner reports r4 **40/42 passed**, with the two historical Hook source-link cases failing exactly as SITE-REVIEW-001 predicted. These are results from the archived r4 website snapshot based on `dc3b184`, not final integrated-head evidence. The JSON has not yet been delivered to this reviewer.

Three original r4 PNGs were independently opened with the image viewer:

- `site-r4-captures/hero-zh-cn-light-enhanced-focus.png`: Chinese/light/enhanced homepage; pill text and arrow are visible, no ordinary underline, but competing outer rounded and inner rectangular focus outlines are visible (SITE-REVIEW-002).
- `site-r4-captures/sidebar-en-dark-brutalist-enhanced-focus.png`: English/dark/Brutalist/enhanced desktop; the focused Brutalist native group row is fully outlined, with consistent small-radius geometry and no clipped focus. The original anchor/disclosure identity and measured hit target still depend on the corresponding JSON assertions.
- `site-r4-captures/tabs-en-react-rhea.png`: English/dark/React live Rhea demo; Password remains visibly selected, Billing is visibly disabled, the retained content says “Change your password here,” and the profile readout says Rhea. One image does not establish the complete three-profile transition or identity/focus lifetime; the other state captures and JSON remain necessary.

Mobile, failed-script/no-JS, same-owner three-state comparison and corrected final-source captures remain pending independent review.

## Independently executed verification

- `vitest` of `site-native-controls.test.ts`, `tabs-profile-switch.test.ts`, `tabs-profile-switch-code.test.ts`: **3 files / 24 passed**, no skipped or failed cases. Log: `collections-agent-site-review.log`.
- Shadcn demo inventory/policy: **1 file / 100 passed**, including the two newly integrated demo IDs. Log: `collections-agent-site-policy-review.log`.
- Public documentation inventory: **passed**, 305 bilingual primary routes / four library inventories.
- Git object/readback of the pinned #1154 evidence JSON: **passed**; the historical R3 selection, array failure and later unexecuted assertions are present.

Existing ES2024 target warnings and Vue development notices were retained in the logs; no warning was suppressed to produce these results. The bounded deterministic tests do not establish browser layout or AT.

## Remaining review inputs

This is a partial local review, not a clean final-head acceptance packet. A native r4 subset has now been inspected and disclosed SITE-REVIEW-002; its source correction is reviewed but the native correction is pending. Remaining matrix JSON/captures and the corrected final candidate are not yet available to this reviewer. Exact final source/CI/DCO/platform-review bindings remain the integration owner's responsibility. The retained header-navigation failure has now been independently explained and its bounded follow-up result read back. Complete the native reruns for both findings and read the missing native evidence before reporting the in-scope acceptance as finished. The remote tool reached its monthly quota after a later run started; that run's inaccessible final receipt is not counted as a pass.
