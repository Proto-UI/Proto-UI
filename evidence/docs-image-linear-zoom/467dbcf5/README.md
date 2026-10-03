# Image canvas evidence

These unmodified screenshots were captured from application commit `467dbcf5af559d267538cf6f7e7b474f2111b8a7`, not from this evidence-only commit or a later PR head. This branch must not be merged into the product.

- Browser run: https://github.com/Proto-UI/Proto-UI/actions/runs/37121562166 (23/23 passed)
- Complete CI: https://github.com/Proto-UI/Proto-UI/actions/runs/37121562233 (success)
- Artifact 11273244455 SHA-256: `de5d13955fb007abe9d257bfac3b8eef107b765c46f7c4030f74b045399853e8`
- `whitepaper-zh-cn-1280-light.png`: Chinese whitepaper diagram, 1280 px, light theme
- `whitepaper-zh-cn-390-dark.png`: Chinese whitepaper diagram, 390 px, dark theme

The theme canvas belongs only to the image's transparent pixels: no surrounding padding, border, shadow, toolbar or frame. Source SVG and request policy remain unchanged. This commit preceded the source opacity/accessibility follow-up; its screenshots do not establish the later source-media transition fix. The source media element's box is modeled; arbitrary object-fit/clip-path crop parity is not claimed.

Co-author by OpenAI Dots
