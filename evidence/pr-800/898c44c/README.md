# PR #800 evidence for 898c44c

Actual public Proto UI component captures from [successful run 37122427199](https://github.com/Proto-UI/Proto-UI/actions/runs/37122427199).

- Candidate: `898c44c09fce71fb3fd00acb3f2d142115113fde`; baseline: `f7edface1ae859154c3fb5ff36e397d01b269c0c`
- Capture driver SHA-256: `024e0f568d99044f944d6b6690825e6c2b313660e534a36485e2c244d919f718`
- Chromium: `154.0.8037.57`
- 16 candidate and 16 baseline cases: WC, React, Vue, Vue2 × Light/Dark × 960/320px
- Actual intermediate frame geometry, physical RTL-ancestor containment, reduced-motion instant position, keyboard and disabled behavior passed
- Fonts: four runtime loaded/custom-glyph, 500 control/700 heading and normal-casing cases plus one intentional font-request-failure fallback passed
- These PNGs are the captured WC Light endpoints, not mockups. `candidate-off.png` and `candidate-on.png` show the same candidate before/after activation. `baseline-on.png` is explicitly the earlier base revision

The 16.24-second candidate recording and full measured JSON/screenshots are in the [run artifact](https://github.com/Proto-UI/Proto-UI/actions/runs/37122427199/artifacts/11273961817), retained until 2026-11-02 by Actions. They were also delivered to the maintainer as native saved files. This evidence-only branch must never merge into the product branch.

The same run's four broader browser jobs (controls/dialog/remaining/checkbox) passed. Full repository CI is separate: its first run exposed generated GPUI fixture drift; two newer-main workflows also exposed missing newly introduced family files and a stale 0px image-preview radius expectation. These remain disclosed until the reconciliation commit is verified.

Co-author by OpenAI Dots
