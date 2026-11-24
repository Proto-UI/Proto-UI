# Keep the static image-preview entry frameless

## Native success and the remaining visual regression

This follow-up preserves the Content focus policy recorded in `2026-11-24-image-preview-content-focus.md` and the frameless image presentation requested in [#796](https://github.com/Proto-UI/Proto-UI/issues/796). It does not change any public Module, Adapter or Base semantics.

The exact-head native run [45429274246](https://github.com/Proto-UI/Proto-UI/actions/runs/45429274246), job `138569738748`, executed `1983c776cdfd92891b528ac5c3c5e4d2a75dd01c` and genuinely passed **34/34**, with no failed or skipped cases. Repeated pointer entry focused the actual Content host with `tabindex=-1`, while Close stayed unfocused and clipped. The original tests recorded Content's outline but did not reject it. This passing result remains intact.

The downloaded artifact `14936914412` is 9,607,907 bytes; its SHA-256 matches GitHub's `5ac96d69eba91bff5d96943d985327f5a82e6c4268fd23a429d54f371acfd635`. Its 300 ZIP entries passed CRC and extraction checks, including path traversal, duplicate path and symlink rejection. The original archive, job log, PNGs, sidecars and extraction receipt remain under `/tmp/proto-ui-image-evidence-b91f/1983/`.

The read-only data audit found **47 of 70 sampled Content entries with `outline-style: auto`, width `1px`, offset `0px`, and native `:focus-visible=true`**. Light captures used `rgb(16, 16, 16)` and dark captures `rgb(238, 238, 238)`. The other 23 observations had style `none`, width `3px`, and native visibility false; those observations do not show the same painted outline. The audit also rechecked 22 directional motion groups: maximum geometry error was 0.008825 px and maximum 220 ms opacity-step error was 0.000000910, within the unchanged thresholds. All 120 captured page-error lists were empty.

Rendered review by the coordinating agent inspected these actual repeated-pointer PNGs and rejected the visible double/bright image edge:

- `whitepaper-en-390-light-repeated-pointer.png`
- `whitepaper-zh-cn-320-light-repeated-pointer.png`
- `whitepaper-en-1280-dark-repeated-pointer.png`
- `reduced-motion-repeated-pointer.png`

The artifact audit is `native-audit.json`, SHA-256 `eb8e00900a36af190ad74bfe585a6c65c2645e8a0efaf86e71fcba6b2d8ac228`; the full job log is `github-job.log`, SHA-256 `517abc36513541aa2ddaed0da1edd2b925b8d825fcfb0e6edbb51bb54d80bc48`. A native test pass and a rejected rendered appearance are separate observations. Neither is rewritten by this repair.

## Ownership and bounded change

The outline belongs to the focused outer `[data-docs-image-content]` host. The inner public family Surface already uses `border: 'none'`; changing its border or fill cannot suppress its ancestor's UA outline. Existing styled Shadcn and Brutalist Dialog Content projections apply `outline-none` to their own hosts, while the image composition deliberately uses the public Base Content with its measured media geometry.

The accepted consumer adjustment is a static presentation rule in `documentation-image-zoom.css`, limited to `[data-docs-image-content][tabindex='-1']`. It sets `outline: none` and explicitly sets `outline-width: 0`. This selector identifies the nonsequential initial image entry. It does not select Close, the thumbnail, ordinary Dialogs or descendants. The file's scope comment now identifies this #796 UA outline reset in addition to measured geometry.

Actual focus remains inside Content. Native `:focus-visible` is still observable, and no focus fact, public expose, event handler, key policy or restoration path changes. The public Surface continues to own image fill and scrim presentation. Close and thumbnail feedback remain under their existing public family controls, including forced colors. No global Dialog, Focus or Adapter default is changed.

## Discriminating failure before the CSS repair

The pre-repair CSS had SHA-256 `a8836ce0aee97b069b25b79242132a915a42c57ec9cd380be9d10fdf29dae7bc`; the browser test had SHA-256 `a79fe0e44e377317eb6484ec1ed6e7887ad58a565be9862f75689e3cadcd4009`. Those source identities are preserved in `.tmp/image-zoom/outline-before.json`, with an original CSS copy beside it.

Before changing that CSS, an executable Node replay read the seven original repeated-pointer JSON captures. Each case first verified actual Content focus, `tabindex=-1`, native visibility true and the unfocused, clipped Close. It then applied the new borderless-outline expectation. All **7/7 failed** at actual `auto` versus expected `none`; the CSS hash remained unchanged throughout the replay.

```sh
node --test .tmp/image-zoom/outline-artifact-regression.test.mjs
```

This is a replay of recorded native facts, **not a new Chromium run** and not a passing result for the repaired CSS. The raw `.tmp/image-zoom/outline-artifact-red.log` has SHA-256 `e94f7f493001a57d48da07f4f3efd83d053a27edd56b52a8b9c61f497d4136e1`; the accompanying receipt records exit 1 and `freshNativeExecution: false`.

The real browser test now requires computed Content outline style `none` and width `0px` on initial and repeated entry, while retaining its actual-focus, Close, Tab/Shift+Tab, Enter/Escape and restoration assertions. All **234 prior `expect` calls remain**, now among 240 calls. `expectLinearImageMotion` remains byte-identical, SHA-256 `47d1b4125834f315f7783addf8b440b621553fadde0b3888d13bdba21f3a8c96`. The suite still has 34 cases.

## Local validation and remaining evidence

Five focused image files passed **93/93 with no skips**, including source safety, asynchronous ownership, geometry, trigger readiness and the real PUI DOM integration cases. The command selected `documentation-image-zoom.test.ts`, `documentation-image-preview.test.ts`, `documentation-image-geometry.test.ts`, `documentation-image-source.test.ts` and `documentation-image-trigger-readiness.test.ts`, with one Vitest worker. The raw `.tmp/image-zoom/outline-focused-image.log` has SHA-256 `99582f73143ef30f139334d45e4e6992d9f859c43512b86b86423a32bfe7da1c`.

The scoped TypeScript check used the repository's strict root compiler options and the Website's real path mappings: **805 source files, zero diagnostics**. This is not a full Astro application check. Its raw `.tmp/image-zoom/outline-scoped-types.log` has SHA-256 `0b352285b846ad09a8c37a28bd96efe99a8fd6af43c513e69d418b845b7c7a1b`. The bound source files were unchanged during both checks. Formatting, the scoped diff check, syntax and assertion-preservation checks also passed.

These local results do not prove the new native computed style or pixels. The repaired candidate still requires its own hosted 34-case native run and visual review, including the repeated-pointer states, keyboard Close, forced-colors feedback and unchanged source-to-contain animation. Whitepaper production captures remain independently bound to their own head. Screen-reader acceptance is unmeasured, and the withdrawn reading-size/pan claims remain withdrawn.
