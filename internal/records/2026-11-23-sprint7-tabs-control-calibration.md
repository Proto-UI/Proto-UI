# Tabs consumer control calibration, November 23

This completes the bounded reference-consumer calibration portion of [Issue #734](https://github.com/Proto-UI/Proto-UI/issues/734). It does not complete the proposed three-path model comparison or remove the 0.4 experiment's deferral. The [public recipe](../../benchmarks/interaction/knowledge-consumer/README.md) retains that distinction.

## Source and environment

Every original example file was compared with Git objects from `d0392fb31513b12f55b9e99b1fcf26a6338569c9` before execution. The original checker has SHA256 `7ca3d34d02f46f583d544d348d350e28b071e02e665cc3ca0226b4cebd73f4b0`; the repaired checker has SHA256 `76526bb90881a620321816540440e09fe6e49921ceb1b0bd1c73ba72eb728df0`. The repair restores only the automatic-control and event-reporting slice of preserved earlier uncommitted work; its wider historical source has SHA256 `af44c846044d334d669b56464bb2d151ef19c64056624dcbc7da21fe01e46e6b`. Other uncommitted experiment changes were not included or presented as newly completed work.

Execution used Node `v24.22.3`, npm `11.19.1` and Google Chrome for Testing `145.0.7632.6` on doesvm. The browser executable has SHA256 `481fea1516a1f2b76454664272f12cd9dd1f20117b21e1f1498e08bc7f872c00`. Both independent consumer directories used the same recovered lock, SHA256 `ecc57929f0f6759784f818c2405306ac8e2c1d10aa6f96b91bf555635c21dc66`, with React/react-dom `18.3.1`, Radix Tabs `1.1.13`, Vite `6.4.1` and Playwright Core `1.58.2`. Both ran `npm ci --ignore-scripts --no-audit --no-fund` and `npm run build` successfully. Dependency inventories and build identities were captured separately after execution.

## Defects and repair

The previous automatic control called `HTMLElement.click()` on focus. The installed Radix pin selects from primary mousedown or Enter/Space keydown; that synthetic click did not activate the focused trigger. The previous control therefore remained green and could not validate the manual-activation assertion. The repaired fault injector dispatches Enter on focus and records each injected event, including `isTrusted: false`, target and selection before dispatch. This is deliberate synthetic fault injection, not evidence of physical user input. All ordinary checker actions remain browser keyboard/pointer actions.

The first complete browser attempt also exposed an unrelated real fixture problem: Chromium requested `/favicon.ico`, the preview server returned 404, and the original `runtime-errors` assertion correctly failed. An explicit empty data favicon fixes the served fixture. The runtime-error guard was not filtered or relaxed. Both old and repaired checker conditions in the final comparison used this same fixed HTML. Its original SHA256 is `b73666c38f5587390061383f4bddd5d44ecc9e45edaf7f8ed5076ee8e0285636`; the repaired HTML is `d8b532b84e2134bce75b69cb099491ec3832a0607343c41c11b7a03333e8ba7f`. The final old/new consumer builds emitted identical JS, CSS and HTML bytes.

The 22 named checks, original 2.5-second state timeout, both specified positive viewports and the relationship/removal controls are unchanged. Negative runs stop at their first actual failed check and preserve the remaining checks as `not-run`.

## Actual results

The final run started at `2026-11-23T09:22:15Z` and ended at `2026-11-23T09:22:41Z`. [Machine-readable receipts](evidence/2026-11-23-s7-tabs-calibration/reports.json) retain command arguments, return codes, source hashes, the rejected setup attempts and both complete browser attempts.

| Cell | Viewport / scheme | Exit | Result |
| --- | --- | --- | --- |
| Original positive | 1280×800 / light | 0 | 22/22 checks passed |
| Original automatic control | 1280×800 / light | 0 | 22/22 checks passed; demonstrates the ineffective injection |
| Repaired positive | 1280×800 / light | 0 | 22/22 checks passed |
| Repaired positive | 390×844 / dark | 0 | 22/22 checks passed |
| Repaired automatic control | 1280×800 / light | 1 | 3 passed; `right-skips-disabled` failed with Details selected on focus |
| Relationship control | 1280×800 / light | 1 | 1 passed; `initial-selection` failed |
| Removal control | 1280×800 / light | 1 | 17 passed; `removal` failed |

All final cells have empty runtime-error and cleanup-error lists. The automatic mutation log records a synthetic Enter first on Overview and then on Details; the second activation changes selection while the normal Right-arrow journey should only move focus. The three intended failures validate their respective controls; they are not product passes or discovered product defects.

The wide/light and narrow/dark `02-focus-without-selection.png` captures were inspected. They show Overview selected with its panel visible while Details carries a distinct, unclipped focus outline. At narrow width the tab strip scrolls horizontally and both host action buttons remain visible in these captured states. This inspection does not establish all-state paint contrast, screen-reader behavior, other engines or physical-device acceptance.

## Preserved raw evidence

The raw archive `tabs-control-calibration-2026-11-23.tar.gz` has SHA256 `c064f25b53859a88472ce6b5bdb127bf019de629c464ac38eb871a150532f773` and size `6,345,510` bytes. It is retained beside the source execution on doesvm at `/tank/shared/projects/proto-ui-agent/seven-sprints-20261123-chvf1ono/s67-734-handoff-4deb/`. Integration should retain the same archive under `internal/records/evidence/2026-11-23-s7-tabs-calibration/` without changing its contents.

The archive contains attempts `s67-734-calibration-4deb`, `-02`, `-03` and `-04`, with their exact runners, source files, transitive locks, command logs, reports, focus/selection facts, accessible-role snapshots, HTML, PNG captures and Playwright traces. Attempts 01/02 failed during checkout setup and ran no browser. Attempt 03 preserves the favicon failure; attempt 04 is the controlled result above. Installed dependency inventories, emitted-asset hashes and a file inventory are also retained. Package caches and `node_modules` are excluded.

The original Issue still requires independently reviewed task/oracle admission and actual isolated, repeated three-path model work with its original measurement and interpretation requirements. These reference runs are not participant runs, evidence of model value, a cost result, an assistive-technology result or Sprint-wide acceptance.
