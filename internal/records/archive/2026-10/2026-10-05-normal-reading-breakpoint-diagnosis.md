# Normal desktop reading breakpoint diagnostic preparation

This is a bounded evidence change for [PR #816 review r4182944312](https://github.com/Proto-UI/Proto-UI/pull/816#discussion_r4182944312), prepared against `a4d045ae2abe40eb9c7698099317ba292aa3cabf`. It does not change website CSS, authored MDX, Base semantics, native document order or ownership.

## Observed evidence and remaining gap

The source-bound [matched-reference run 37298039897](https://github.com/Proto-UI/Proto-UI/actions/runs/37298039897) succeeded, with artifact `11340292893`, recorded source `a4d045ae2abe40eb9c7698099317ba292aa3cabf`, a clean checkout and four 1180×757 observations. Its JSON was inspected. These observations cannot establish behavior at normal 1279/1280/1281. The existing density runner checks normal 1024 and 1279 visibility; its separate 1440/200% case cannot substitute for the missing default-root boundary. No all-CI-success claim follows from this one workflow.

Source inspection identifies two facts to measure together: `TwoColumnContent.astro` uses inclusive initial-font viewport `min-width:80rem` and root-relative `docs-canvas max-width:80rem`; the query container is the full `.docs-shell` in `PageFrame.astro`, with `max-width:85rem` and inherited `.container-wrapper` inline padding from `global.css`. At the ordinary 16px root, the default 16px padding on each side means a 1281px border box has only 1249px content width before any classic scrollbar deduction. Consequently, a strict `width > 80rem` media condition alone would leave the neighbouring-width overlap. This arithmetic is a source inference, not captured browser geometry; actual padding, scrollbar, media match and container boxes must be inspected in the new report.

## Discriminating capture

The existing strict production runner accepts `--breakpoints` as a separate profile. The default four matched-reference cases remain 1180×757. The new profile captures 12 untouched-root cases (1279/1280/1281 × Quick Start/Radio Group × light/dark), then independent, explicitly labelled 1440/200% text controls for the same routes/themes. Every case gets a fresh context with DPR1, browser/visual scale1, the same 757px height, light OS color preference and native theme-button operation. Only the labelled stress cases set root font-size to 200%; this is text enlargement, not browser zoom.

`reading-breakpoints.json` and distinctly named original viewport/full PNGs retain the requested profile, actual root size, viewport/client/scrollbar widths, named-container content width, media match, every reading wrapper's rectangle and computed layout, visible native TOC link boxes, and Header control boxes. The read-only self-contained callback is serialized with the same keepNames transform in a unit check. Derived container comparisons are labelled as calculations, not direct browser query-match evidence. The existing `readReadingReflow` probe supplies actual native link and Header measurements.

Acceptance distinguishes normal 1279 hidden desktop TOC from normal 1280/1281 visible lateral TOC. Stacked default-root layout fails even if the enlarged-text control passes. Missing/hidden native TOC, normal root mutation, different viewport/zoom and fragmented enlarged links fail explicitly. Facts and real screenshots are saved before regression assertions; every case continues independently after a failure. The existing clean source, build-start/build-finish inventory, owned strict loopback production preview, no-follow response routing, blocked external requests and source/build recheck remain shared boundaries.

The workflow has a separate diagnostic step after the existing matched capture. It runs after a successful build even if matched capture fails, keeps nonzero regression outcomes, and retains both reports with `always()` artifact upload. Under unchanged CSS, expected normal-boundary regression failures must remain red rather than being relabelled as successful collection.

## Local verification and next action

- `node --test scripts/test/reading-reference-breakpoints.test.mjs scripts/test/reading-reference-evidence.test.mjs`: 29/29 pass. Predicate fixtures and source/transport tests, not browser layout evidence.
- `node node_modules/vitest/vitest.mjs run apps/www/src/content/docs/zh-cn/reading-reflow-evidence.test.ts apps/www/src/components/site-header-layout.test.ts --maxWorkers=1 --minWorkers=1`: two files, 15/15 pass.
- Initial local test runs exposed only new test wiring assumptions (unnamed workflow steps and hard-coded screenshot viewport), which were corrected without changing production behavior or the regression acceptance.
- Real new browser capture remains unrun: this environment's previously established Chromium AF_UNIX restriction and failed mount escalation are not retried or bypassed. No new screenshot or normal-boundary geometry success is claimed.

The patch remains for parent review before commit/publication. After review, run this exact-source profile in the admitted hosted browser, inspect normal screenshots and content-box/TOC measurements, then select the smallest justified CSS correction and repeat the same normal plus enlarged-text cases. The three exact normal widths prove only those widths; an eventual broader breakpoint change requires appropriate neighbouring-width coverage and renewed visual review.

## Independent probe review correction

Independent review found a false-green boundary in the shared `readReadingReflow` helper: bare `checkVisibility()` does not check opacity or CSS visibility by default. A visible TOC wrapper with hidden native links could leave `visibleTocLinks` nonempty and satisfy the new assertion. An executed VM option-gate counterexample is red before the fix; the shared filter now explicitly enables both `checkOpacity` and `checkVisibilityCSS`. Negative fixtures cover self/ancestor opacity and visibility at normal 1280/1281 and the separate enlarged control. This is collector correctness, not a browser reproduction of the reported layout defect and not a production CSS repair.
