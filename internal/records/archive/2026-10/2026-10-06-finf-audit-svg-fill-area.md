# Finf bounded SVG fill-area evidence

This topic follows the independently frozen editor/decoration layer and addresses mandatory prior-pr.775 review4197650234. A positive stroked bounding box is not evidence of positive fillable area. The source reader now independently withholds fill ratios with `unsupported-svg-fill-geometry` unless the actual SVG geometry belongs to a finite positive-area subset: nonzero rectangles, circles, ellipses, or one absolute M/L/L triangle with optional explicit closure and nonzero finite signed area. Other paths, lines, polygons, relative or multiple-subpath geometry are conservatively outside this fill profile. Independent stroke evidence and original pixels remain retained.

The path proof reads effective computed CSS d rather than a presentation attribute that a stylesheet may override. The same d property joins the state fingerprint. Existing opaque-triangle calibration and translucent-fill/opaque-stroke counterexamples are retained unchanged; this is not a generic SVG renderer or path parser.

The actual glyph-reader loop against the preceding source produces6 expected failures/5 positives. Candidate complete serialization83/83 and full public/audit263/263 pass, no skips; probe/native TypeScript syntax and formatting/diff checks pass. One new native calibration retains original PNG/facts for line, one-segment path, collinear closed path, CSS d override, and positive triangle/rectangle/circle. Its native execution remains pending with the sole Finf integration owner; model controls do not certify rendered coverage.

The transparent-target criterion remains a separate following topic. No product styles, color thresholds, old assertion, timeout or known-unsupported terminal policy changes here.

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
