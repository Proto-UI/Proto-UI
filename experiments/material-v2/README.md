# V2 Web optical source and emitted-runtime consumer

This fixture uses the actual Previewer renderer and actual four Web Adapters. It compares the source package graph with an emitted public-package graph, while retaining the explicit private Liquid Glass Prototype source. That family is not represented as a published package. The packed build rejects any accidental public-package `/src/` input and records its complete package input graph plus bundled-asset hash.

The background is the visible app-owned canvas, not a DOM screenshot or hidden texture. The same fixed audited shader version used by #809 is selected through the V2 host interface. This test does not reinterpret V1 as V2, grant arbitrary capture access, exercise native rendering or claim full Compiler equivalence.

Build with `node --import tsx experiments/material-v2/build-browser.mjs /tmp/pui-material-v2-source`. Build emitted public dependencies first and add `--packed` for the second graph. Run through the existing repository browser harness with `node --import tsx experiments/material-v2/browser.test.mjs <fixture-dir> <evidence-dir>`. The page permits only its localhost origin, has no account data, and is not deployed. The official `V2 Web optical artifact evidence` workflow retains exact-head screenshots and result metadata.

Local source and packed bundles have compiled. Actual GPU execution is pending official CI; the existing local Chromium socket restriction is not bypassed. The separate website material fixture owns deeper zero-refraction/opaque image comparison, >16-surface performance measurements, context loss, source overlap, DPR and preference controls. Neither fixture alone establishes subjective material quality; inspect the actual evidence before acceptance.
