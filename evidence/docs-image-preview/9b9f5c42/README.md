# Documentation image preview evidence

Code revision: `9b9f5c425a7b1e1518435cdd1d6758c034edde8f` (PR #787 / Issue #780).

Actual Chromium captures from [run 37109211650](https://github.com/Proto-UI/Proto-UI/actions/runs/37109211650), Chrome 154.0.8037.57 / Node 24.21.0 / Ubuntu 24.04 with fonts-noto-cjk 1:20230817+repack1-3. Artifact ID 11268664329; ZIP SHA-256 d0a7b8f4688a1bf09d7b70bd560f79525d87823a846c47f368dd7ba612262814. Captures were inspected as actual pixels before publication; no private references, credentials or unrelated UI are present.

- whitepaper-zh-cn-1280-light.png: actual Chinese whitepaper, Shadcn, 1280x900, light, fitted diagram
- whitepaper-zh-cn-390-dark.png: actual Chinese whitepaper, Shadcn, 390x900, dark, fitted diagram
- 390-dark-brutalist-fit.png: maintained public raster fixture, actual Brutalist facades, 390x900, dark

Evidence disposition: partial. This run passed the 12 viewport/theme/family cases, MDX media/error/links and four bilingual whitepaper cases (17 passed). It failed the network fixture's assumption that the same image URL must produce two requests; the browser reused the existing image resource and one request was observed. Reduced-motion/no-JavaScript was not reached under fail-fast. These images establish the shown states for this exact revision only, not a clean complete matrix or later-head evidence.

This is a dedicated evidence-only branch and must not be merged into product source. PR #787 owns retention/context and subsequent exact-head evidence. No depiction is simulated or AI-painted.

Co-author by OpenAI Dots
