# Actual DOM optical-carrier experiment

Refs #793 and #792. This isolated experiment answers whether one measured Chromium version actually samples and spatially displaces its DOM backdrop through an SVG reference filter. It does not implement Liquid Glass, introduce a Prototype material API, or admit an Adapter/Compiler profile.

The source has ordinary non-periodic red and green DOM lines and mutable DOM text. There is no backdrop image, screen capture, canvas copy or cloned scene in the effect. The browser supplies `SourceGraphic`; `feFlood` supplies a known, owned constant displacement input. PNG decoding is **test observation only**, after rendering. It is never fed back into the displayed effect.

## Discriminating observations

Run `node experiments/material-optics/backdrop-probe.mjs` with `CHROME_PATH` and `OPTICAL_EVIDENCE_DIR`. The bounded workflow does this on the exact PR head, Ubuntu 24.04 and the installed Chrome, with read-only contents permission.

- No effect and zero scale agree on non-periodic marker centroids
- Positive and negative scale cause opposite 10px sampling displacement
- Sharp marker contrast survives displacement; blur alone spreads the marker without moving its centroid and cannot satisfy this oracle
- Foreground label pixels stay unchanged
- A 23px mutation of the actual DOM source moves the filtered and unfiltered marker, and the underlying DOM text changes
- Moving/resizing the surface preserves screen-space sampling positions
- Pixels outside the surface clip remain unchanged
- Returning to zero samples the current source; page errors remain empty

Each stage emits its actual pixels and measured centroids. The report records source SHA, engine, Node and scope and preserves failed or unavailable observations. Source `14bc1088859b5901335d569be44802b432bfa709` passed the [read-only Chromium run 37135910044](https://github.com/Proto-UI/Proto-UI/actions/runs/37135910044), including seven numeric model tests, signed x/y markers and same-geometry branch controls. Local browser execution was not performed. A carrier failure remains useful evidence and must not be hidden by weakening displacement assertions or substituting a captured backdrop.

## What remains after a carrier pass

A constant translation is not lensing. The shape/liquid scene below derives spatially varying displacement and highlights from shared shape geometry and includes bounded shape/light/interaction probes. These experiment results do not establish a portable material API or production resource ownership. Finite host-neutral intent and resource-lifetime contracts, target-specific compilation and real host integration still require their own evidence. A compiler must specialize that intent into each actual backend, not rename a runtime CSS interpreter as AOT. Material groups, morphing, adaptive legibility, host fallback quality and performance each require additional evidence.

No screenshot can establish cross-engine or native support. The current WebKit reference-filter work is still tracked upstream; Flutter shader image filters require Impeller; Qt needs an explicit scene texture; this repository's GPUI root Feedback and scene-sampling paths need their own evidence. Unsupported backends must remain explicit.

## Primary sources

- [Apple: Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)
- [Apple: Applying Liquid Glass to custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views)
- [CSSWG draft: actual Backdrop Root input and clipping](https://drafts.csswg.org/filter-effects-2/#BackdropFilterProperty)
- [W3C: displacement sampling and scale-zero behavior](https://www.w3.org/TR/filter-effects-1/#feDisplacementMapElement)
- [WebKit reference backdrop filter issue](https://bugs.webkit.org/show_bug.cgi?id=245510)

All optics in a future independent model are our model parameters, not Apple's private numeric values or proprietary shader. No Apple asset is included.

## Shape/liquid experimental scene

`heightfield.mjs` is an independent numeric model, not Apple's private optics. It derives both displacement and highlights from the same rounded-shape field. A smooth union combines approaching shapes before one backdrop sample, and press/menu state changes that same geometry and rim strength. `liquid-demo.html` displays the actual live DOM background, never its screenshot. Only the owned normal/highlight field is generated in a canvas.

`liquid-demo-evidence.mjs` captures source-bound screenshots and zero-displacement, signed-axis and branch-removal controls. `liquid-demo-record.mjs` independently records actual input-driven motion to WebM in a fixed viewport with zero screenshot calls. Each requested capture records its **actual** state/frame: screenshot latency may skip a requested animation threshold, so five requested captures do not automatically establish five different intermediate states. Inspect both the video and recorded states before making a temporal conformance claim. The interrupted press chain retires after an unsuccessful animation generation; this is still an experiment, not complete production interruption semantics.

The original carrier proves horizontal marker displacement and no leakage beyond the outer rectangular clip. It does not by itself establish vertical sampling, rounded-corner pixels or a pixel-level assertion of updated backdrop text. The shape unit checks are mathematical evidence, not a substitute for observed browser fields. Adaptive contrast, accessibility policy, group ownership and portable Prototype/Compiler admission remain separate work.

## Layered single-control experiment after visual rejection

Both recorded candidates (`c643b9f2` and `5ab54cab`) were visually rejected: proof of refraction was insufficient to resemble the requested material. Actual official, same-control video comparison identified a structural problem in the second candidate: blurring the whole input before displacement erased the sharp, content-dependent rim, while the uniform light overlay read as a frosted plastic surface. Those results and the earlier 26/146 changed-pixel failures remain historical evidence, not accepted quality.

The next independent model splits the **same live compositor backdrop** into a sharp displaced rim and a separately scattered body. Complementary field weights blend those contributions once; they do not stack glass surfaces or reconstruct the backdrop. Fine directional light/dark edges are distinct from the outer shadow. Local press changes the optical thickness, displacement profile, specular response and body scattering as well as the silhouette. These are original model decisions, not Apple's private formulas.

Evidence keeps the original diagnostic checker and adds two isolated, non-periodic DOM markers. At identical geometry, positive/zero/negative displacement must produce bounded, oppositely signed x/y centroid movements. A global changed-pixel count is only an effect-existence check, never a visual-quality score. Same-backdrop negative controls replace the sharp rim with the body branch, remove body scattering, and disable press optics while retaining the pressed silhouette. Unit checks cover complementary weights and sampled 2D source-map Jacobians for the bounded single-control poses; they do not prove every possible field is fold-free.

The pure fixed-viewport recording is now focused on one regular button and its menu. It remains separate from screenshots, always runs after an optical-test failure, and reports `recorded-not-accepted`. The fusion experiment remains available for research but is not used to distract from this single-control material review. Native cross-platform Prototype/Adapter/Compiler admission still requires a finite intent/resource contract and target-specific implementations.

The layered candidate `69624dc7` passed its physical probes but exposed a visible nested inner panel. Same-head negative images retained that contour with either the sharp rim or scattering removed, isolating the concentrated white-tone transition. The repair decouples body tone from the narrow rim/body crossover and integrates it continuously over the surface depth. A constant real DOM background and tone-removal capture isolate this regression; the y-marker crop also excludes the foreground label. This is a specific observed defect repair, not visual acceptance.
