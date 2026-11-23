# Website visual acceptance for 9d0f47d4

**The recorded 100-image website matrix is visually accepted at `9d0f47d4ef67bbc3676e4db24c7906f8721e5b42`. No visual blocker was confirmed within that matrix.** All 100 current capture/metadata pairs were verified. Forty-four changed PNGs were inspected again; 56 PNGs are byte-for-byte identical to the previously inspected 1450 captures, so their prior actual pixel inspection is explicitly reused. Some identical frames also appeared in the new contact sheets.

`currentPrVisualAcceptance: true` in the index is limited to this source and matrix. It is not a platform approval, a blanket closure of the original #1488 B/C/D conditions, or acceptance of the historical Hook candidate. Historical C23/C24 red records and the original incomplete Hook conditions remain intact.

The reviewer, Codex / `s2_integration_review`, implemented the compiler text integration and Checkbox reset repair but did not implement the website CSS, Sidebar, Tabs demonstration, Hero, or Hook documentation changes. Independent review of the compiler and Checkbox changes belongs to the separate final reviewer.

## Source and evidence

- Source tree: `0c9d31e5bb05d3af79932ec3c62a61480197f9eb`. All 100 metadata files bind source 9d0f47d4, an empty tracked patch (`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`), and no untracked files.
- [Actions run 45188583301](https://github.com/Proto-UI/Proto-UI/actions/runs/45188583301), job `137740608739`, [artifact 14826253625](https://github.com/Proto-UI/Proto-UI/actions/runs/45188583301/artifacts/14826253625). The archived ZIP was independently hashed again: 64,794,471 bytes; SHA256 `48ffcfc5a814d129d1cefa8faed91b4dc5529b5a1677c7d752faa12210519781`.
- [Bound website test source](https://github.com/Proto-UI/Proto-UI/blob/9d0f47d4ef67bbc3676e4db24c7906f8721e5b42/apps/www/src/content/docs/zh-cn/sprint2-site.browser.test.ts), Git blob `f47918043971225f8db2971a0e73a9e0f47c7aa8`. Direct comparison with 1450 shows one change: the Brutalist radius assertion now requires exactly `5px` instead of merely a nonempty value. [Exact fixture diff](fixture-source.diff).
- [Raw site report](../hosted/site/report.json): 42 unique executed cases, 42 passed, zero pending or failed; the executed names exactly match 1450. SHA256 `655e8ca755f5cbdf71aa7cd527b4eed6e8629087d1ce990226847ea023ac0eee`. [Raw site log](../hosted/site/run.log): SHA256 `43332d2a1d56c86eade04eb6400d1d3ffa728c025cf675c5906db32ae6586fdd`.
- [Complete 100-image index](index.json) retains every original PNG/JSON hash, route, runtime, actual theme, preferred scheme, source-bound script mode and individual visual decision. No captures were missing, duplicated, unexpected, or mismatched.
- [Image comparison](pixel-comparison.json) records exact old/new hashes and changed-pixel bounds; [measurement audit](measurement-audit.json) records the current source measurements and executed site names. These summaries do not add new functional test cases.
- Browser in all 100 metadata files: Chromium `157.0.8103.78`. Desktop viewport: 1440 × 1000; mobile: 390 × 1000.

## Review method and matrix

The [1450 review](../../2026-11-23-sprint2-final-1450ffd5/visual-review/README.md) remains a separate source-bound record. Its index SHA256 is `4d8da8092316a2893fd715bbf65d9c77ec1cf42e22dee5b2ae48889ab79770a6`. No old metadata was relabeled as 9d metadata.

For changed images, 17 detail sheets, five full-frame overview sheets, and three individual full frames were actually displayed and inspected. [Review process](review-process.json) records all 22 sheet source/crop mappings and the original views. Captions lie outside screenshot pixels. Display used lossless WebP copies of the existing PNGs; original PNGs were not modified. The final six streamed views additionally verified that decoded RGB pixels exactly matched their source PNG.

| Area | Executed cases | Current PNGs | Changed PNGs re-inspected | Byte-identical PNGs with prior inspection reused |
| --- | ---: | ---: | ---: | ---: |
| Tabs: EN/ZH × WC/React/Vue/Vue 2 | 8 | 40 | 22 | 18 |
| Desktop Sidebar: EN/ZH × light/dark × Shadcn/Brutalist × enhanced/failed scripts | 16 | 32 | 11 | 21 |
| Mobile Sidebar: EN/ZH × Shadcn/Brutalist × enhanced/no-JS | 8 | 8 | 0 | 8 |
| Hero: EN/ZH × light/dark × enhanced/failed scripts, plus EN/light forced colors | 8 | 18 | 9 | 9 |
| Hook historical-evidence prose: EN/ZH | 2 | 2 | 2 | 0 |
| Total | 42 | 100 | 44 | 56 |

Actual theme mappings remain: enhanced light 39 / dark 32; failed-scripts light 13 / dark 12; no-JS mobile four requested-light / actual-dark images. Those last four establish dark SSR observations. A preferred light browser scheme does not turn them into light screenshots.

The failed-scripts fixture aborts network script resources during page loading with JavaScript still enabled. It does not exercise an arbitrary failure midway through enhancement.

## Mapping to original #1488 conditions

| Original condition | Supported finding at 9d0f47d4 | Acceptance boundary |
| --- | --- | --- |
| B1 — presentation and wording | English and Chinese descriptions are readable and explicitly distinguish authored source coverage from full visual/accessibility acceptance. Rhea, Nova and New York v4 labels agree with their visibly distinct geometry. | The live exhibition captures three profiles. This does not visually accept all eight modern authored profile IDs or all static examples further down the article. |
| B2 — same live instance | All eight cases show stable Password selection and panel wording through the four keyboard profile changes. The executed assertions retain the original tab, first child and panel identity, and disabled Billing. | Five images mean initial Rhea plus four keyboard transitions. The later fifth, pointer-driven switch checks Account selection before the final profile click and then Profile: rhea; there is no additional post-pointer identity assertion or image. No five-step equivalence is claimed. |
| B3 — hosts and unsupported boundaries | WC, React, Vue and Vue 2 render the exhibition in both languages. WC/Vue request light; React/Vue 2 request dark. | This is not every runtime × theme combination. Unsupported profile rejection, non-Web hosts and broader compatibility depend on their separate compiler/runtime evidence. The images introduce no new host support. |
| C1 — selected-family geometry across modes | All retained Shadcn group/leaf/focus paint entries have four 8px corners; Brutalist has four 5px corners. Selected family geometry survives enhanced desktop, blocked-script desktop and mobile no-JS. The current fixture independently requires exactly 5px for Brutalist. | Shadcn and Brutalist are the selected families. No-JS images are actual dark. Blocked loading scripts do not represent every partial-enhancement failure point. This remains a bounded child result. |
| C2 — hover/current/focus/disclosure/hierarchy/labels/mobile | Hover fill and focus outline are distinct. Visible hierarchy, disclosure indicators, longer wrapped English labels and Chinese labels are legible. Desktop native keyboard close/reopen, current-leaf identity and hit assertions pass. Current metadata records 32px desktop and 44px mobile targets with zero owner/paint width difference. All four enhanced-mobile wheel observations are trusted, traverse the scroller, and reach their expected scroll position. | Group and leaf observations occur at different times. A final leaf-scrolled mobile PNG can place its ancestor group offscreen, and desktop group frames can omit the current leaf. Mobile four-point observations are retained in JSON; desktop points are established by executed assertions. Arbitrary labels, physical touch/OS input and assistive technology are not accepted by this record. |
| C3 — preserve family distinction | Shadcn retains restrained rounded navigation. Brutalist retains stronger borders/shadows, its canvas and selection treatment, and 5px family geometry. | This establishes distinction for the two selected families, not acceptance of every family design. |
| C4 — actual captures and computed geometry | All 100 new source-bound PNG/JSON pairs and all 42 executed site cases were verified. Exact byte comparisons, 44 changed-image decisions, 56 explicit reuse decisions and current geometry observations are retained. | Acceptance is specific to 9d0f47d4. A later source requires its own execution/metadata and image assessment. |
| D1 — intentional Hero pill | The bilingual pill remains rounded, legible and visibly nonunderlined in the recorded enhanced and blocked-script modes. Hover fill and outer focus treatment are clear. | This accepts the observed Hero treatment. The blocked-script pages still show unavailable interactive demonstrations; their whole-page interactivity is not accepted. |
| D2 — native href/name/keyboard/nonunderline | Source-bound cases verify native anchors, exact localized accessible names/hrefs, text-bearing descendant nonunderline, a visible outer focus outline, absence of competing inner focus paint and Enter navigation to the corresponding preface. Images agree; both EN/light forced-colors frames retain visible focus. | These are Chromium/CDP actions and accessible-name assertions, not physical-device or screen-reader certification. |
| D3 — bilingual/themes/fallback/enhancement/article comparison | Both languages and both actual desktop themes cover enhanced and blocked-script Hero hover/focus. Both Hook article frames retain visibly underlined prose evidence links, distinct from the Hero treatment. | Article comparison is static. The suite does not provide a complete article-link hover/focus/keyboard matrix or arbitrary intermediate enhancement failures. Broader original conditions remain open unless separate evidence supplies those parts. |

### Geometry and historical comparison

The current metadata contains 80 retained paint entries: 40 Shadcn and 40 Brutalist; 64 desktop and 16 mobile. Some group-hover values appear again in later focus metadata, so these are **not 80 independent tests**. All desktop entries are 32px high, all mobile entries 44px, and every owner width equals its paint width.

The four enhanced mobile wheel observations retain trusted deltaY −32 and include the actual scroller. Shadcn EN/ZH expected and actual scrollTop are 690; Brutalist EN/ZH are 2216. All 16 mobile group/leaf hit records contain four matching-owner points. These observations are kept separately from what a final PNG shows simultaneously.

[Chinese/light Sidebar detail](9d-sidebar-detail-zh-cn-light-brutalist.png) shows the current family treatment in enhanced and blocked-script modes. The [historical d039/1450 comparison](../../2026-11-23-sprint2-final-1450ffd5/visual-review/brutalist-historical-comparison.png) remains explicitly bound to those older sources: enhanced was already 5px, while the old blocked-script fallback was 0px and the repaired fallback became 5px. The current Chinese/light blocked-script group-hover PNG is byte-identical to the inspected 1450 counterpart, and its new 9d metadata records four 5px corners. The old PNG has not been substituted for the new source artifact.

## CJK, Hero and Hook observations

Chinese navigation, profile instructions, headings, Hero labels and Hook evidence prose remain readable. No missing-glyph boxes or unreadable CJK clipping were found in the observed matrix. The no-JS mobile fallback search label wraps in the narrow header; the prior inspected pixels are identical at 9d. Navigation target measurements do not extend to every header control.

[Chinese/light Hero detail](9d-hero-detail-zh-cn-light.png) retains the intentional pill and one outer focus outline in both recorded modes. The native interaction claims are supported by the source-bound executed cases, not inferred from screenshots alone.

The [English Hook image](../hosted/site/hook-evidence-en.png) and [Chinese Hook image](../hosted/site/hook-evidence-zh-cn.png) were both displayed at full original size. They clearly retain the actual historical R3 failure: missing Module declaration array, exit 1, later order/identity/required-field/freezing assertions not reached, all original 13 generic conditions and both original #1154 checkboxes still incomplete, and no draft or target-profile promotion. Rendering that explanation does not rerun or accept the historical candidate.

## Disposition

Accept the **recorded website visual matrix at 9d0f47d4**, with the boundaries above. Preserve original B/C/D requirements not covered here, historical C23/C24 red records, and the incomplete historical Hook conditions. Code review, the rest of the Sprint 2 acceptance queue, platform approvals and the final PR state are handled by their separate evidence and owners.
