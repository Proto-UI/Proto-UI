# Website visual review for candidate 1450ffd5

**All 100 captured images were inspected. No visual blocker was confirmed within this recorded matrix. This report is bound to `1450ffd549bce8da636f2ccd45044aff5121e6ad`; it does not accept subsequent PR heads.** During review, PR #1716 advanced to `9d0f47d4ef67bbc3676e4db24c7906f8721e5b42`. Its execution and image evidence must be assessed separately.

The reviewer, Codex / `s2_integration_review`, implemented the compiler text integration and Checkbox reset repair, but did not implement the website CSS, Sidebar, Tabs demonstration, Hero, or Hook documentation changes reviewed here. Independent source review of the compiler and Checkbox changes belongs to the separate final reviewer.

## Source and evidence

- Source tree: `15e67863a668e5e7a09af69731fd9c4c668ff9f1`; all 100 capture JSON files report source 1450ffd5, an empty tracked patch (`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`), and no untracked files.
- [Actions run 45183604935](https://github.com/Proto-UI/Proto-UI/actions/runs/45183604935), job `137723420016`, [artifact 14823732540](https://github.com/Proto-UI/Proto-UI/actions/runs/45183604935/artifacts/14823732540). Downloaded ZIP: 64,782,377 bytes; SHA256 `273454fef6331bebdc8b110699db3b8ffba885d4f1b29f3daac6576289220667`.
- [Bound test source](https://github.com/Proto-UI/Proto-UI/blob/1450ffd549bce8da636f2ccd45044aff5121e6ad/apps/www/src/content/docs/zh-cn/sprint2-site.browser.test.ts), Git blob `a38fba2095f07c62da8f7f7f941bee3e522c179f`.
- [Raw site test report](../hosted/site/report.json): 42 unique executed cases, all passed; B = 8, C = 24, D = 8, Hook = 2. SHA256 `2a4a2cf287cb70e8709f4eea64d1a674159b0dd21a3028c48bc92f5d9d644cc3`. [Raw site log](../hosted/site/run.log): SHA256 `66340c55ac95f47e48e6546a4715a604fd1d6fe0f581cea8fa89d7857a4e8fdb`.
- [Complete image index and individual review notes](index.json) links every original PNG and adjacent JSON, with both hashes, actual theme, preferred scheme, viewport, route, runtime, and test-bound script mode. There were no missing, duplicate, unexpected, or mismatched captures.
- Captured browser: Chromium `157.0.8103.78`. Desktop viewport: 1440 × 1000; mobile viewport: 390 × 1000.

Original PNG pixels were inspected through full frames, overview sheets, and relevant-area crops at native size. All 33 contact sheets used for this review have source/crop mappings in [the review process record](review-process.json). Captions were placed outside screenshot pixels. Original PNGs and JSON files remain the primary evidence.

## Inspected matrix

| Area | Executed cases | Images | Coverage |
| --- | ---: | ---: | --- |
| Tabs | 8 | 40 | EN/ZH × WC/React/Vue/Vue 2; five captured states per case |
| Desktop Sidebar | 16 | 32 | EN/ZH × light/dark × Shadcn/Brutalist × enhanced/failed scripts; group hover and group focus |
| Mobile Sidebar | 8 | 8 | EN/ZH × Shadcn/Brutalist × enhanced/no-JS; final leaf-scrolled frame |
| Hero | 8 | 18 | EN/ZH × light/dark × enhanced/failed scripts; hover/focus, plus two EN/light forced-colors frames |
| Hook evidence | 2 | 2 | EN/ZH historical R3 evidence prose |
| Total | 42 | 100 | Every listed PNG was visually inspected |

Actual theme mappings were preserved: enhanced light 39 / dark 32; failed-scripts light 13 / dark 12; all four no-JS mobile images requested light but rendered SSR dark. The last four provide dark SSR evidence. `failed-scripts` aborts network script resources from page loading while JavaScript remains enabled; it does not exercise an arbitrary failure midway through enhancement.

## Findings and mapping to the original #1488 conditions

The following decisions concern the evidence actually collected. They do not close the original B/C/D groups wholesale or alter historical C23/C24 red records.

| Original condition | Supported result at 1450ffd5 | Acceptance boundary |
| --- | --- | --- |
| B1 — presentation and wording | English and Chinese descriptions are legible and explicitly distinguish authored profile coverage from complete visual/accessibility acceptance. The live example displays Rhea, Nova, and New York v4 with matching labels and distinct geometry. | The screenshots cover these three exhibitions. They do not establish visual acceptance of all eight modern authored profile IDs or every static example further down the article. |
| B2 — same live instance | In all eight cases, the four keyboard profile changes retain the visible Password selection and panel; the executed assertions check active tab, original first child, tab/panel identity, and disabled Billing. The fifth operation uses the profile button after selecting Account. | There are five pictures: initial Rhea followed by four keyboard transitions. The later pointer step checks Account selection before the final profile click and then final Profile: rhea. It has no additional post-pointer identity assertion or image. Pointer focus follows normal browser behavior. |
| B3 — hosts and unsupported boundaries | WC, React, Vue, and Vue 2 render the same three exhibitions in both languages. WC/Vue request light; React/Vue 2 request dark. | This is not every runtime × theme combination. Unsupported compiler profiles, non-Web hosts, and broader compatibility need their separate compiler/runtime evidence. Website images confer no new host support. |
| C1 — family geometry across rendering modes | Recorded Shadcn group/leaf/focus entries use four 8px corners; Brutalist entries use four 5px corners. Both desktop enhancement modes and mobile no-JS retain the selected family geometry. | Selected families are Shadcn and Brutalist. No-JS mobile images are actual dark. The failure fixture exercises blocked network scripts from loading, not every partial-enhancement failure point. This is a bounded child result. |
| C2 — hover/current/focus/disclosure/hierarchy/labels/mobile | Hover fills and focus outlines are distinct. Hierarchy and visible longer labels, including wrapped English entries, remain legible. Desktop keyboard close/reopen, current-leaf identity and native hit assertions pass. All retained desktop target paint heights are 32px, mobile heights 44px; owner and paint widths agree exactly. Four enhanced mobile cases retain a trusted wheel delta of −32 and reach the recorded expected scroll position. | Group and leaf observations occur at different instants. A final mobile leaf-scrolled PNG can place the ancestor group outside the viewport. Desktop group pictures can likewise omit the current leaf. Mobile four-point observations are retained in JSON; desktop point assertions are established by the executed case. Arbitrary label strings, physical touch, OS input, and assistive technology are outside this record. |
| C3 — preserve family distinction | Shadcn keeps restrained rounded navigation. Brutalist retains its stronger borders, shadows, canvas/selection treatment, and 5px family geometry. Both remain visibly distinct in the inspected modes. | Established for the two selected families. It does not accept other family designs. |
| C4 — actual captures and computed geometry | All 100 image/JSON pairs match the bound source, routes, dimensions, browser preferences, and recorded actual themes. Their hashes and individual review notes are retained. The old square fallback and repaired rounded fallback are directly compared below. | Artifact review is source-specific. Later commits require their own source-bound execution and capture assessment. |
| D1 — intentional Hero pill | The pill remains a readable, rounded link with hover fill and one visible outer focus ring in all eight Hero cases. It is not visually treated as underlined prose. | This accepts the observed Hero treatment, not all homepage interactions. Failed-script frames leave the interactive demo area unavailable. |
| D2 — native href/name/keyboard/nonunderline | The source-bound cases check the native anchor, exact localized accessible name and href, absence of underline on text-bearing descendants, focus-visible outline, absence of competing inner focus paint, and Enter navigation to the corresponding preface. The images agree. Both EN/light forced-colors images retain visible focus. | These are actual Chromium/CDP inputs and accessibility-name assertions. They do not certify screen-reader or physical-device interaction. |
| D3 — bilingual/themes/fallback/enhancement/article comparison | Both languages and both actual desktop themes show the Hero in enhanced and blocked-script states. Ordinary historical-evidence links remain visibly underlined in the two Hook article captures. | Article comparison is a static observed prose-link check. The suite does not supply a full article-link hover/focus/keyboard matrix or arbitrary intermediate enhancement failures. Preserve the broader original condition unless independent evidence supplies those parts. |

### Brutalist regression comparison

The [comparison sheet](brutalist-historical-comparison.png) uses the actual Chinese/light group-hover PNGs from two source-bound runs. [Its mapping](brutalist-historical-comparison.json) identifies every source PNG, hash, and crop.

| Source | Enhanced corners | Blocked-script corners |
| --- | --- | --- |
| Historical d0392fb | 5px on all four corners | 0px on all four corners |
| Candidate 1450ffd5 | 5px on all four corners | 5px on all four corners |

The historical enhanced case was already rounded. The discriminating old defect is the square blocked-script fallback. The new fallback visibly follows the family radius. The old ZIP was downloaded again from artifact `14805214684` and independently checked against SHA256 `0ccd23e09406b369d3225015b599aacee721d8c15e0f5ff7ca1c30ee3c975eed`. The old PNG hashes match the earlier inspection.

The historical source d0392fb and original PR source 4a11517 both contain `apps/www/src/styles/site-library-family.css` at Git blob `026931d8c7f34acdbd1529038406966488a1507c`, independently read from both immutable GitHub commits. [Historical provenance and original PNG/JSON files](../historical-d0392fb/provenance.json) remain separate from the 1450 captures.

## CJK and Hook record

Chinese navigation, profile instructions, headings, Hero text and Hook evidence prose are legible. No missing-glyph boxes or unreadable CJK clipping were found in the inspected matrix. On no-JS mobile pages the fallback search label wraps in the narrow header; it remains readable. This review does not extend the navigation target measurements to every header control.

Both [English](../hosted/site/hook-evidence-en.png) and [Chinese](../hosted/site/hook-evidence-zh-cn.png) Hook captures visibly retain the R3 failure: missing Module declaration array, container exit 1, later freezing assertions not reached, and the original 13 generic conditions plus both original #1154 checkboxes still incomplete. Rendering this explanation does not execute or accept the historical Hook candidate, change draft lifecycle status, or close those conditions.

## Subsequent head

This completed record remains bound to 1450ffd5. PR advancement to 9d0f47d during review does not change any stored source identifier or convert these images into 9d evidence. New source-bound images can be assessed incrementally against these originals, with any changed pixels reviewed directly and unchanged image hashes recorded explicitly.
