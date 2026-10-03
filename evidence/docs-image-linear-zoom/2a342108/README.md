# Initial borderless image-zoom evidence

Source: `2a3421088d20d601819032122c4bf0ffd17e16a1`, tree `92c909ceb0aee68e496f2779ccac8a1f4a674dea`, PR #797 / Issue #796.

Run: https://github.com/Proto-UI/Proto-UI/actions/runs/37119729747
Artifact: 11271789609; ZIP SHA256 `f3a6ea75da07b57426a28f09490b9b9e1be7e0160046b1f027088401755e27ee`.
Environment: Ubuntu runner, Node 24.21.0, Chrome 154.0.8037.57, public CJK font fixtures.

These four unchanged PNGs were read from the run archive and visually inspected. They show desktop/mobile contained media and two intermediate motion captures. The outline inside the raster test image is part of its pixels; the viewer's own border measured 0px, shadow none, with no persistent toolbar. The full archive also contains original 390px/1280px native videos and frame/geometry records.

Result at this source: 14 cases passed, then a source-fixture role/name lookup failed; eight later cases were not run under the initial fail-fast setting. Later diagnostics corrected the initial inert-background inference: the original media's visibility:hidden affected its content-derived accessible name. Subsequent commits repair the fixture, retain source naming through opacity, and address transparent-image contrast/return geometry; these captures do not claim to show those later revisions or a complete final pass.

No private reference, third-party photo, personal screen, credential or generated mock screenshot is included. This branch is evidence only and must not be merged into main.

Co-author by OpenAI Dots
