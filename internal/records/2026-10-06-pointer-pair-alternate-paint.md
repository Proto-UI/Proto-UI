# Pointer-pair alternate paint guard

## Scope and authority

- User-directed continuation of Proto-UI/Proto-UI #775; review finding 4194097156.
- Baseline: `5025496dbb20ec976e868e461835fd1ad15afb3e`.
- Existing draft criteria: `P-BRUTALIST-DROPDOWN-MENU-ITEM-INTERACTION` and `P-BRUTALIST-SELECT-ITEM-INTERACTION`. This repairs audit attribution, not product styles, semantics, lifecycle or thresholds.
- The existing pointer-pair observation combines same physical target, owner/lease checks, native hover/held state, expected fill/foreground tokens and supported paint. Reading only `backgroundColor` / `color` is insufficient when another target paint source replaces them.

## Reproduction and bounded repair

Six CSSOM controls leave expected tokens, geometry, supported ordinary visibility, hover and held flags unchanged. On the baseline serialized function all six incorrectly return `achieved: true`: target background image, alternate text fill, text shadow, nonzero text stroke, inset box shadow, and text-clipped background. The normal control retains an opaque target over an ancestor image/inset shadow and the target's external decorative shadow.

The target-specific pair predicate now withholds acceptance with an explicit paint limit for these six source classes. Effective target text values include inherited fill/shadow/stroke. Ancestor opacity/blend guards remain; unrelated ancestor backgrounds/inset shadows and target outer decorative shadows are not blanket-rejected. Stroke width/color join the existing style fingerprint. No ratio, expected color, physical-target or selection condition changes.

This is a finite simple target-color-pair support domain, not arbitrary CSS compositing or occlusion proof. Descendant glyph/text evidence remains separately recorded by the existing glyph/text readers; this repair does not add complete pseudo-element, arbitrary descendant overlay or external occlusion certification. Existing unsupported domains retain their own limits. The known-unsupported terminal exception remains restricted to declared ScrollArea rounded clipping; these pointer-pair failures cannot use it.

## Validation

- Baseline controlled reproduction: 7 tests, 6 expected failures and 1 positive pass. Every failure is the intended `true !== false`, not an import or fixture startup failure.
- Repaired serialized probe controls: 35/35 tests, no skips. This synthetic CSSOM harness tests the actual bundled predicate, not native rendering.
- Added nine native calibration cases: target image/clip/inset; target and inherited text fill/shadow/stroke. Each retains real mouse hover/down, expected token colors and ordinary visible classification, rejects only the alternate pair source, then passes after removing it. These are new-head CI evidence debt until executed; local Chromium is unavailable in this executor.
- Existing `5025496d` native checkpoint remains separately valid: 30 calibrations per shard; 790 raw / 782 achieved-matched / 8 explicitly unmeasured ScrollArea frames and 40 unexecuted targets. It is not relabeled as validation of this repair.
- Follow-ups #852 (three new interaction journeys) and #853 (rounded ScrollArea paint domain) remain open. No full paint/accessibility conformance or independent approval is implied.
