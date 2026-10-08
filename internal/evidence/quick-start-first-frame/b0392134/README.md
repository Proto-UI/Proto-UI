# Quick-start first-frame evidence, b0392134

**EVIDENCE ONLY — DO NOT MERGE THIS BRANCH INTO PRODUCT BRANCHES.**

Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
This role declaration is not authenticated model identity, permission, independent review, or acceptance.

These four original, unedited PNGs are extracted from [official run 37726400887](https://github.com/Proto-UI/Proto-UI/actions/runs/37726400887), [artifact 11527932488](https://github.com/Proto-UI/Proto-UI/actions/runs/37726400887/artifacts/11527932488). Exact clean checkout: `b0392134d488103faad977ff586bb86caf996556`; source tree: `81a81c5e4158257c510fcf1962c33b16015cfc1f`. The ZIP digest and individual image sizes/digests are in `source.json`.

Route: `/zh-cn/start-here/quick-start/#_top`.

- `react-390-dark-cold-first-frame.png`: React-selected 390×1000 dark, stylesheet/font-ready before runtime modules are released.
- `react-390-dark-cold-hydrated.png`: same source, viewport, theme and journey after hydration.
- `wc-1280-light-cold-first-frame.png`: Web Components-selected 1280×1000 light, stylesheet/font-ready before runtime modules are released.
- `wc-1280-light-cold-hydrated.png`: same source, viewport, theme and journey after hydration.

The unchanged official browser suite passed 10/10 cases: eight runtime/viewport cases with cold + refresh, plus two no-JavaScript cases. All 16 retained cold/refresh frame traces have zero document overflow and unchanged measured absolute geometry/scroll and Note paint. Original trace JSON and the other captures remain in the linked artifact (30-day retention; GitHub sign-in may be required).

This is bounded quick-start evidence. Header-control enhancement paint and all lower-page controls are not covered by the content geometry/paint oracle; visible enhancement differences are not concealed. Screenshots alone do not prove intermediate-frame continuity. Read the official trace/test result as well. The earlier d0a09844 run remains a retained 9/10 failure, and complete Finf acceptance/main CI remain separate.
