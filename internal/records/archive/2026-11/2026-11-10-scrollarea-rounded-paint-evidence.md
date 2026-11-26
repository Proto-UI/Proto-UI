# ScrollArea rounded-overflow evidence candidate

Date: 2026-11-10. Issue [#853](https://github.com/Proto-UI/Proto-UI/issues/853), original source [#775 review 4193495831](https://github.com/Proto-UI/Proto-UI/pull/775#discussion_r4193495831). This is an observation-tool repair in human-assisted/current-user mode. No product test, browser capture, build, formatter, install or publication ran during its preparation.

The source baseline is `0607c6c5c386b8a932ab850e92a8873b2121dc45`. `P-BRUTALIST-SCROLL-AREA`, its Base Root/Viewport relations and `T-BRUTALIST-SCROLL-AREA-0001` remain draft. The Root's `overflow-hidden rounded-base border-2` source and both theme tokens declare a 5px radius with a 2px border. Consumer dimensions remain in `demo-brutalist-scroll-area.demo.ts`. This repair does not change those sources, a contrast threshold or a lifecycle.

## Declared domain and evidence identity

The existing known-unsupported result is retained only for ScrollArea rest in its declared Web runtime and light/dark theme. The classifier requires observed 5px corner radii, 2px border widths, hidden overflow on both axes, the owned Root's physical node identity, its actual border/client rectangles, and the measured target's actual rectangle. It recomputes the central safe rectangle and requires real interior overlap while rejecting a wholly central target mislabeled unsupported. Bounds, including interior overlap, remain geometry and supply no rounded-edge paint proof.

Raw PNG bytes, their decoded raster dimensions, the exact serialized facts bytes, and a separate complete before/facts/after fingerprint file must agree with their SHA-256 receipts. Each fact's host and physical target IDs, owner, generation and rectangle must agree with the captured fingerprint. The primary observation and rounded clip must identify those same physical nodes. Snapshot runtime/theme, facts family/theme and before/after anatomy leases must agree with the case. A copied receipt from another runtime, changed node, mismatched image, or unsupported extra paint domain is a failure.

The proposed collector saves complete ScrollArea fingerprints on matched, unsupported and mismatched attempts. The raw files are create-only. Existing source-provenance verification still runs before the terminal result; its failure cannot become known-unsupported. No retry or recapture repairs an identity failure.

`achieved` remains false, numeric acceptance stays `not-evaluated`, and all planned targets remain unexecuted when rest terminates known-unsupported. The proposed native calibration is an instrument-only DOM/CSS fixture with declared 5px/2px geometry. It cannot replace real component, semantic Scroll, contrast journey or assistive-technology evidence.

## Original-condition ledger

Every condition below retains its original Issue wording. None is marked complete by source preparation.

| Source key | Original condition | Candidate and remaining acceptance |
| --- | --- | --- |
| `853.acceptance.1` | Define and independently review a bounded way to obtain source-bound visible paint evidence for the actual rounded ScrollArea profile, or explicitly retain its unsupported domain. Do not change product radii or lower contrast thresholds to satisfy the instrument. | Explicit unsupported domain retained and narrowed to actual declared geometry. Independent review and Main execution remain required. No new paint profile is admitted. |
| `853.acceptance.2` | Preserve exact physical owner/anatomy, before/facts/after fingerprints, native input provenance, raw PNGs and failed attempts. | Raw-byte pairing, physical identities and retained full fingerprint files are authored. Existing native reader/runtime/theme input and source checks stay in place. Actual PNG/facts/fingerprint artifacts and failed attempts must come from Main's captures. |
| `853.acceptance.3` | Reject fully hidden/rounded-corner, offscreen, unexpected clipping/filter/transform, replaced-node and foreign-owner controls; distinguish actual paint proof from intersecting bounds. | Controlled geometry/identity/raw-byte rejection cases and a native geometry calibration are authored, unrun. Existing native hidden/filter/transform/corner controls must execute with them. |
| `853.acceptance.4` | Update the declared known-unsupported profile only after evidence supports the extension. No generic CSS renderer is required by this issue; unsupported CSS remains explicit. | No supported paint-domain extension. New receipts constrain retention of the already-unsupported profile. Main must retain any unexpected domain as a failure. |
| `853.acceptance.5` | Complete the currently unexercised ScrollArea contrast journeys under any newly admitted profile, separately from runtime Scroll semantic tests. | No newly admitted paint profile. Rest, hover, keyboard-focus, scroll-end and wheel-both-axes remain explicit planned targets; a known-unsupported rest earns none. Any future paint admission must execute these per runtime/theme, separately from semantic tests. |

Until then, a named known-unsupported case is neither `achieved` nor numeric contrast approval. Counts, raw evidence and unexecuted planned targets must remain visible. Unexpected domains and broken identity/hidden controls remain failures. This issue does not certify accessibility, change a Prototype lifecycle, close #469, or authorize repository-rule bypass.

## Historical source remains historical

Issue #853 pins source `fe94c93`, artifact `11402140844`, SHA-256 `ee0fd33cf78017d11b71f0bf2cdc10e38ceccf67c3b8d1824f88e96b3695a36e`: React/light Root `(536,673.359375,320,192)`, Viewport `(538,675.359375,316,188)`. Those bytes and observations have not been replaced by current-source hashes. Other runtime/theme results still require individual observation. The two current Issue comments, `6684433808` and `6684477585`, retain the earlier audit-tool deferral; current-user authorization supplies this bounded repair, not an acceptance waiver.

## Main integration and validation

Only `apps/www/scripts/contrast-known-unsupported.mjs`, the existing rounded fixture/receipt tests in `apps/www/scripts/contrast-audit-plan.test.mjs`, and this record are applied in this worktree. Main owns the unapplied `contrast-probe.browser.ts`, `audit-brutalist-contrast.mts` and native calibration hunks. Apply those three hunks together with the classifier: the old collector cannot satisfy the stronger receipt contract. Preserve Main's current probe/source-admission work when integrating the patch.

Main's source-bound handoff supplies exact preimages, before/after SHA-256 identities, the unapplied integration patch, two isolated before/after policy producers, and serial commands. The before producer uses the actual preserved old classifier with the candidate's controlled inputs; predicted failures are not a reproduced result. After that comparison, run the whole existing audit-plan suite, probe serialization and journal/anatomy suites, native calibration, and real source-bound ScrollArea runtime/theme captures. Keep every setup, failed, unsupported, skipped and unstarted result.

Use `/zh-cn/ui-libraries/brutalist/components/scroll-area/` and its actual `demo-brutalist-scroll-area` Previewer. Choose runtime with the reader control and light/dark through the native media path. Inspect each raw PNG alongside its bound facts and fingerprints: the full rounded Root, sole Viewport and both Scrollbar/Thumb branches must be present under the same owner. Border/corner pixels and any clipped/focus cues require actual visual inspection. A source-model or semantic Scroll result alone cannot establish those visible outcomes.

The Issue remains open through Main validation, independent review, any required repair, lawful integration, and original-condition reconciliation. A source-ready candidate is not a closure receipt.
