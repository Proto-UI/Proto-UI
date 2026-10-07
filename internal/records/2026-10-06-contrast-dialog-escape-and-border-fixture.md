# Dialog Escape attribution and the borderless calibration label

Date: 2026-10-06 UTC. Bounded continuation of #775 on `733397ae1b9f0776f9355d0cfeb8af5c071beccb`; this record does not assert new native success.

## Dialog's existing Escape transition

[Review 4190948729](https://github.com/Proto-UI/Proto-UI/pull/775#discussion_r4190948729) identified a remaining input-attribution gap. The original Dialog branch waited for Content to become hidden and then manually focused the Trigger. Real authored Dialog controls across WC, React, Vue and Vue2 confirmed normal closure/restoration. With only the Trigger host focus operation rejected, the original branch still returned successfully and its later focus seed could hide the missing restoration. Four proposed rejection assertions failed on the original branch; eight accompanying controls passed. An earlier fixture omitted the native pointer's initial Trigger-focus premise and its failed run is preserved separately.

Dialog now uses the same physical-popup/current-subject-lease Escape barrier already used by Dropdown Menu and Select. It waits without corrective input for the same Trigger to receive focus before continuing the pre-existing pointer/focus reset. The content-prototype mapping and criterion description include Dialog. Planned states, pointer journey, existing Dialog open observation, timeouts and other families' input behavior remain unchanged; Tooltip still preserves prior focus rather than receiving a new restoration rule.

The original eighteen controls remain. Added Dialog controls cover four real Adapter positive paths and four rejected host-restoration paths. Actual caller tests exercise the runner's Dialog mapping, the barrier before corrective inputs, and rejection of changed subject leases. The two complete focused files pass 458/458 (432 pipeline/caller controls and 26 popup controls), with zero skipped tests. The applicable Node controls pass 151/151. These are controlled DOM/host-input results, not new native browser evidence.

## Evidence-backed border fixture correction

The diagnostic source `733397ae1` retained the real calibration PNG and facts in audit run `37405507353`. The binary archive `11387750169` has SHA-256 `cc80fe502a5032e620b3a0beb4c69aa58abc901efff343bf4f5f1421dc64891e`; its PNG hash matches its source-bound metadata. The image and viewport are both 800 by 900 at DPR 1, without scrolling or coordinate scaling mismatch. All 84 recorded exterior pixels exactly match their PNG coordinates, and all 84 border-ratio decisions match the solid/unsupported domain.

Exactly one neighbor differs from the fixture's expected background: the zero-width sample's left point `(39,264)` is `[255,255,247]`, beside its original rectangle `(40,248,220,32)`. The adjacent source image shows the leading Z in “Zero width” against the left boundary; the pixel row transitions from white at x36–38 through that colored fringe at x39 and darker glyph pixels at x40–44. Both border ratios are already null, as required for zero width. This is the label intruding into the intended empty calibration neighborhood, not evidence that the non-solid border applicability correction is wrong.

Only that sample receives `text-indent:4px`. Its border remains zero; no sample point, numerical formula, contrast threshold or existing exact RGB/ratio expectation is changed. The other six samples retain their markup and styles. New native assertions lock all seven original rectangles, DPR 1 and the zero label's observed Text Range moving from x40 to x44. The original pure-white neighbor assertion remains the actual acceptance check. The retained diagnostic persistence continues to preserve future raw images and facts.

## Integration and remaining evidence

The first combined local focused and Node checks above pass. Whole-tree type/general validation and independent final integration review remain separate; subsequent results must identify their exact source vector. New native calibration must prove the unchanged white-pixel expectations after the label inset, and the full audit still has to execute its planned runtime/theme cases. The old 733 failures remain failures and are not relabeled as a native pass.

This audit correction does not privately change React or Focus. Any separately accepted shared-source repair is consumed through a normal upstream merge with its own tests and source identity. No broader Tooltip Group timing guarantee or full semantic conformance claim is introduced.
