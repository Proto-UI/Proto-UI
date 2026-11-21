# Select published demo footprint spacing adjustment

This bounded change starts from f0b502704b825b5b644639522555d13e3d64231e. Native run 44956263999 / attempt 1 remains a failed historical observation attached to that exact source. The changed demo has not yet received native validation.

## Change

Product source change is limited to `apps/www/src/content/docs/demo-liquid-glass-select.demo.ts`: shared Content `sideOffset` 8 → 16, and the uncontrolled scene heading margin `mb-2` → `mb-4`. The disabled, controlled and RTL heading layout, public prototypes, behavior and browser test bytes are unchanged.

## Evidence and mechanism

The recipe is the published en/zh-cn Liquid Select demo, not a test-injected canvas. Its original file is byte-identical between e775 and f0 (Git blob 321b4a0a4be6e497304c8118cf998feab47fecd4). Upstream a2a09d817 introduced fixed full contact paint bounds at rest/held/release; f0 includes that behavior without changing this demo spacing.

All eight runtime/theme failure records in artifact 14728171685 show the Trigger already `opaque-fallback / source-overlapping-content` before open, with a `self-optical / rendered` popup Surface after open. The original Trigger `self-optical` assertion fails. Seven of these case identities passed on e775; the previous WC dark failure remains a failure with a different current public reason. No later selection, RTL or long-label assertion is established by this run.

The native Trigger is 93.8125 × 38px, so the existing formula `ceil(max(width,height)*0.08 + 1)` yields a 9px footprint. Its preceding heading and opened popup each have an 8px gap, producing a 1px positive intersection with the conservative footprint. The new nominal 16px spacing predicts 7px clearance for this measured size.

Source admission uses the expanded host border box and strict positive overlap. `contactCarrierBounds` returns the ordinary candidate border box from `getBoundingClientRect` unless its visibility is hidden; a registered private carrier uses its owned paint bounds. Source enumeration also excludes `display:none`, opacity-zero elements, the canvas, the host, and host ancestors/descendants. Therefore a nonempty visible heading box is an eligible geometric candidate even where its individual glyphs do not cover the overlapping pixels. This is not a glyph-alpha test.

The recorded public snapshots and formula establish these intersections; they do not expose the private loop's exact first-hit node or an identical internal read frame. The bounded change addresses the demonstrated scene geometry without claiming that it excludes every other cause or supports every font size, viewport, long label or collision placement.

## Validation boundary

The original browser test is byte-identical to f0, including Trigger optical quality, Surface ownership, selection, RTL, long-label and bounded waits. `git diff --check` passes. No literal-mirror test was added for two style literals, and no native browser was launched locally. Root will validate the changed source through the existing `select-draft-projections-evidence.yml` native workflow.

Machine-readable provenance, exact source and diff hashes, and all eight geometries are preserved in the adjacent `2026-11-22-select-demo-footprint-clearance.json`. The original native records and the bounded two-line diff are retained in the scratch evidence directory identified by that record.
