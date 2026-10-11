# Finf bounded nontransparent paint witness

This independent third topic follows the reviewed editor/decoration and SVG-area layers. It addresses mandatory prior-pr.775 review4197650211: positive layout bounds and unit opacity alone do not establish paint on an otherwise fully transparent target.

The former geometry/opacity/clip reader remains intact as paintedBoxVisibility. Only already-supported geometry additionally needs one supported paint witness within the target's composed subtree: an opaque solid background in a supported fill box, opaque solid border without border-image replacement, actual nonempty nonzero-font Range ink through its composed slot/ancestor clipping chain, a proven SVG fill area, or finite-length opaque solid SVG stroke. Ancestor background is never borrowed. Native/replaced-element fallback DOM text does not prove UA, canvas, raster or embedded paint. Unsupported standalone shadows/outlines, gradients, partial-alpha-only ink and unverified replaced paint remain explicitly unsupported; they are not declared hidden. Existing supported facts/raw pixels and geometric bounds remain recorded.

Opaque alpha recognition for resolved non-sRGB source colors establishes only paint existence. It does not change the separate strict sRGB numeric parser or produce new contrast ratios. Stroke dasharray joins the fingerprint because it is now a witness input. Existing unsupported geometry returns its original limits unchanged, including the sole declared rounded-overflow known-unsupported profile. No additional terminal exception or green skip is introduced; unexpected paint absence still fails target acceptance.

Baseline against the preceding SVG topic:104 serialization controls produced19 expected failures/85 passes, including transparent-target, empty/whitespace/zero-font, effective transparent fill, ancestor-only paint, overridden border, native fallback, hidden descendant/slot, transparent SVG, actual passive caller and dasharray-binding counterexamples. Candidate104/104 and full public/audit284/284 pass with no skips; syntax, formatting and diff checks pass. Existing rounded-clip safe positives, strict unsupported boundaries, alternate pointer-pair paint and independent SVG stroke/fill controls remain.

One new native calibration preserves original PNG/facts and covers fully transparent, empty and hidden targets, direct and descendant Range ink, assigned-slot visibility, solid border/background, non-sRGB opaque existence without a numeric ratio, and SVG-only stroke. Native execution and actual family coverage remain pending at the sole Finf integration head. This source witness is not a general renderer, raster-alpha sampler, occlusion proof or full accessibility approval. The original41 native results do not certify this new layer.

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
