# Borderless linear image preview evidence

Application source: `5defd2cf11b81825ed43393e3fa9a2e0307f1e6e`; tree `1fa3de3de703a11850be40c1d682b8fbf9cdc1dc`. These unmodified PNG/JSON files were produced by that source, not by this evidence-only commit. Do not merge this evidence branch into the product.

Native Chromium run https://github.com/Proto-UI/Proto-UI/actions/runs/37123341871 passed 24/24. Artifact 11273378752 SHA-256: `09e4e79a7733a7ac0a407fbd316984ae9d739aa9bf8b5eee2b37c76c585fe38d`. The full artifact contains 72 PNGs, 78 JSONs, and two unique desktop/mobile WebM recordings (plus recorder originals); the recordings are 3.32s at 1280×900 and 3.6s at 390×900.

The whitepaper screenshots show a theme canvas only within transparent image pixels: zero frame, padding, border, shadow or persistent toolbar. The mountain SVG uses reduced motion; its static capture is not animation evidence. Opening/closing PNGs and the frame JSONs record actual native-input linear motion. The raster fixture's dark outline belongs to its original pixels, not to the viewer.

`matrix.json` includes width/theme/family axes, source accessible name/alt/opacity through before/open/leaving/restored, restoration of the original opacity transition, invalid-origin fallback, and bounded local request-policy probes. All moving source frames have opacity exactly zero. Request probes recorded one reused request per policy, not a separately observed preview request. The local fake fixture credential is not a user credential.

Limits: source geometry models the media element box, not arbitrary object-fit/clip-path crop parity; family/theme are injected axes, not a selector journey; admission remains the existing strict static SVG profile and does not close #563. Public screenshots contain only maintained project pages and generated fixtures.

Co-author by OpenAI Dots
