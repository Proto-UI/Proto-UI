# PR #816 mobile interaction evidence

Public website screenshots only. This evidence-only branch must not be merged into product source.

## Captures

- `menu-before-ec6e5710-390.png`: exact pre-change ec6e5710d0aaeee6d5844f9c996c1d7ca594aa31, 390×844 CSS pixels, Chinese, light theme, normal text.
- `menu-after-70a2ff89-390.png`: actual candidate 70a2ff89148c1552c6df762188294aa4595c6904 under the same menu probe and viewport.
- `code-expanded-70a2ff89-390.png`: actual candidate 70a2ff89148c1552c6df762188294aa4595c6904, 390×1000 CSS pixels, Chinese, light theme, existing independent code-surfaces browser suite.

Source: https://github.com/Proto-UI/Proto-UI/actions/runs/37203687650 . The code-surfaces suite passed 7/7. In the mobile report, native menu journeys and the 320px/200% stress scenarios passed their checks, but the later source stage incorrectly awaited the deliberately hidden/deferred Copy before expansion. That probe failure is preserved and corrected in later evidence-only commits; it is not presented as an all-green browser matrix.

The primary images are mobile browser simulations, not physical device captures. No pixels were generated or altered. These images remain bound to their captured revisions even when later source-only/evidence-only commits exist. The new menu's measured bounds are left8/top61/right382/bottom836, with a 44px public Close target and 685px independently scrollable body; page horizontal overflow is zero.

Retention owner: PR #816 contributor. Keep this small evidence-only branch and immutable links for review; product changes remain on `fix/mobile-navigation-reading`.

## Matched code viewport comparison

The follow-up run https://github.com/Proto-UI/Proto-UI/actions/runs/37204472736 provides `code-before-ec6e5710-390x844.png` and `code-after-9e06e181-390x844.png`, both Chinese/light/normal-size 390×844 views of the same Transition example. Native expanded source viewport height is 144px before and 549px after; code retains its own horizontal scrolling and the whole page has zero horizontal overflow. The candidate screenshot includes the actual keyboard source-focus outline. Copy remains visible outside that scroll region.

These captures completed before an evidence assertion incorrectly read Copy state from its passive wrapper. That later assertion failure is retained, not labeled a successful clipboard test. Commit 833a789a fixes only the probe to read the actual public Button state. The images stay labeled with 9e06e181, their actual captured source.

## Corrected single-toggle menu (supersedes the first menu)

The `menu-after-70a2ff89-390.png` frame is retained as rejected historical evidence: it has duplicate close controls and unnecessary forced blank space. The user explicitly rejected both. `menu-corrected-ceb447d2-390.png` shows the corrected natural-height panel with only the original Header X. Captured at ceb447d298c9aeacaf428ed375e147e0dc9ab8c4, same 390×844 zh/light normal-text environment; run37205663893. Full eight normal viewport/locale/theme cases and two menu-pressure cases passed, with separate manual pixel review; dark Copy transparency found in that review remained a later fix.

## Actual sidebar density before/after

`sidebar-before-ec6e5710-1440-zh-dark.png` and `sidebar-after-ae6de7b6-1440-zh-dark.png` show the same `/zh-cn/start-here/what-you-saw/` page at 1440×1000 CSS pixels, dark theme, normal font size. Candidate is ae6de7b6ce8ef0b2a512c4c720a7c917545a70b8, baseline ec6e5710d0aaeee6d5844f9c996c1d7ca594aa31; run https://github.com/Proto-UI/Proto-UI/actions/runs/37207936466. Both images have been manually viewed. The candidate reduces desktop sidebar rows and weights, aligns the right TOC density, and reserves strong current styling for native aria-current. Column widths and body text are unchanged.

Important limitation: screenshot capture succeeded before the new measurement callback failed with `ReferenceError: __name is not defined` in both baseline and candidate. That TSX serialization defect is being fixed with explicit executable regression coverage. These actual images are not an all-green evidence claim. Header Select measured38/40 instead of36 is also recorded for repair, and 320px/200% code pressure still needs work.

## Header/directory and documentation rhythm: reviewed source-bound frames

The2a5592c11c383d19c92e01f208cb5cff02c9a802 Header/directory frame shows the restored public Brutalist structural atoms, aligned outer gaps and compact native directory projection. Capture run37215896823;1440×1000, zh-CN/dark, normal font. Both implementation author and coordinating reviewer visually inspected it.

The Quick Start pair is ec6e5710d0aaeee6d5844f9c996c1d7ca594aa31 before and20b64cda52261010c5757cbfbc8ee1c140936f14 after, run37216294687, same1440×1000 zh-CN/dark. Only public Text hierarchy and layout rhythm change; original authored prose, notices, commands and ordering remain. The390px dark code frame shows the same20b6 source with real React code tab, local horizontal overflow and opaque Copy. These original PNGs were manually inspected. They are historical source-bound evidence, not images of later performance or pressure-reflow commits.

The `failed-text200` frame is deliberately retained as FAILED pressure evidence, not accepted output:1440 CSSpx, rootfont32px/200%, English/light. Manual inspection caught an extremely narrow TOC, word fragmentation, unused right space and displaced Header commands despite the older probe passing.4894ddc8adfca944ddeaedd08a36eeec152abca9 attempts the container-reflow correction; its new capture/manual acceptance remains pending when this evidence entry is added. Normal size evidence must not imply pressure acceptance.

These are public project pages only, without browser chrome, private user feedback images or credentials. This dedicated evidence branch is never merged. Original capture files are unedited; SHA256 values follow.

- `header-directory-2a5592c1-1440-zh-dark.png`: `ede0b8c4e5a7cb268c2a05c7ef6d8e23081da04ae41b1d70241112bac188643a`
- `quick-start-before-ec6e5710-1440-zh-dark.png`: `2056a7c1500301c97cd1c5a2c7a09ee2ff8475fd646f6d6b06bbc2b1955e9961`
- `quick-start-20b64cda-1440-zh-dark.png`: `6f225488f38c0d74921b809a4fc752b1441adad6232009bfcbbcb61a7203c228`
- `quick-start-code-20b64cda-390-zh-dark.png`: `ebf39c05e5a71c801dc1249184528e1315ab49b886bbfdcc03b686edf326f4df`
- `failed-text200-20b64cda-1440-en-light.png`: `d010e0d431fe85525d3380fecf74fcd59b9ba3b51bc5d50764da680723f60079`

## Completed responsive reading visual matrix: d657

All58 original density frames and54 original mobile menu/code frames for source d657decc661be15903b8fd3938cb00edcad8445a, workflow37222895201, were individually viewed. Independent review additionally covered32 density frames and128 actual Header popup/focus/press/brand/nav frames from workflow37222895185, not all512 generated Header PNGs. No blocking issue remains in that reviewed scope.

The final-menu/final-code pairs use the same ec6e5710d0aaeee6d5844f9c996c1d7ca594aa31 baseline and d657 candidate at390×844, zh-CN/light, normal root text. Baseline menu remains the old narrow anchored form; candidate has one original Header X, natural content height and safe-width scrolling. Expanded source shows the actual height increase and local scrolling. Its inner gray rectangle is the focused native code viewport's keyboard ring, not a second decorative shell; Copy focus has its own ring.

The two final-pressure frames are1440×1000 English/light with actual root32px/200% text: initial reflow retains the original TOC at832px, then the actual Overview anchor brings the title below the232px Header with32px clearance. They are different deliberate journey states, not a fabricated equal-scroll pair. This is stress evidence, not the normal mobile design or a physical device claim.

Lower-priority observations are retained: full-homepage tail space; larger200% TOC-to-title gap; weak dark borders/unchecked control outlines; normal mobile decorative code gutter; adjacent pre-existing Base Transition dark status contrast. At320px+200% the code viewport remains narrow but its own scroll and Copy remain reachable. Some Quick Start initial captures precede stable TOC current highlighting; separate selected-anchor journeys establish that state.

Subsequent bba4cd06 changes only the isolated Node test fixture/record; fbd90df0 merges the synchronized nativeGPUI/CI base with no apps/www, public Prototype or Web Component Adapter source difference. PNGs retain d657 identity and are not relabeled as those heads. Current integrated CI remains separately required.

Original unedited public-project captures and SHA256:

- `final-menu-before-ec6-390-zh-light.png`: `a41823a54c32d17af6f61b4ba5106c6fb20825c719a8668b9d64cae4eaab48eb`
- `final-menu-after-d657-390-zh-light.png`: `b04b83b6d9a5674b83910e4ddcc31c419d4775e1bd851b74124a3a4a991f2d81`
- `final-code-before-ec6-390-zh-light.png`: `9372e4b59e51bfb9493036bf182752ef90a0b2af59c56e55247ede02d3eea8e1`
- `final-code-after-d657-390-zh-light.png`: `e180c7fdc34df2b7fb91e3f5071a19097a3f38c24a9ae14ca68ae5fdfd8b70dc`
- `final-pressure-d657-1440-en-light.png`: `2142d78fc949583dad869573d99bd4d867d01655e1333da1deac19b2bdf05b5e`
- `final-pressure-anchor-d657-1440-en-light.png`: `1c561746abc83053f0d83d1b0c6add384380bbb8c85e3b19262932c98830622b`
- `final-header-directory-d657-1440-zh-dark.png`: `ede0b8c4e5a7cb268c2a05c7ef6d8e23081da04ae41b1d70241112bac188643a`