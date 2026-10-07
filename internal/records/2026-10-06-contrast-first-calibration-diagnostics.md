# First native calibration timeout diagnostics

On published carrier `1243ba893a8249f925a379b94fa0b4697e4c3f2d`, native jobs `112328261836` and `112328262487` each passed 39/40 calibration tests and timed out after 5000ms in the first transparent/clipped-popup calibration. Neither job reached the family collector. This is separate from the recorded `30e605a4` Tooltip anatomy failure. The binary ZIP artifact `11421426829` has SHA-256 `5ed4188535e6a65bb6c7dcc536b783f6bf3259100dcf2c2b6c4d04617f259636`.

The binary log records browser-ready about 22640ms after setup began, but the first test previously exposed no context/page/fixture/install/read/close phase. A timeout alone does not identify a changed pixel assertion or prove a transient runner defect.

The narrow diagnostic addition emits elapsed time and existing create-only phase receipts for each of those steps. It also places context/page acquisition inside the existing cleanup scope. The 40 tests, all authored DOM/CSS, all visibility/paint assertions, default 5000ms test deadline and 30000ms setup deadline are unchanged. No warm-up, retry, exclusion or threshold increase is added. TypeScript transformation and formatting are checked locally; actual timing must come from the next exact-head native run because local Chromium is unavailable. Failed runs remain retained.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
