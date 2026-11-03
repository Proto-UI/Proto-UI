# Dialog Mask probe identity

Related: #1161, #1210. This is a test/evidence repair; the applicable Dialog, Anatomy, Overlay and available-space definitions remain draft. No product, geometry threshold, deadline, workflow or historical calibration is changed.

## Same-execution diagnosis

The original probe selected the first non-Dialog `data-is-present` / `data-pui-root` anywhere in the document. On `2e17ac95` plus read-only diagnostic probe `cb755b1169b1a03b36927a45da5afd458a1399288114253a7a4474f0fb85063c`, the original eight cases all failed at Mask width zero. All 24 geometry samples identified that first node as Site Search's Command Content, owner `site-search-1-docs-1-dialog`. The actual example Content had a different owner; its unique same-coordinate physical Mask measured 390×900. This attribution belongs to that execution, not older CI samples without node identity.

The [immutable red evidence](https://github.com/HyacinthHaru/Proto-UI/tree/08dd20158c8843e3371e8de655dd04e396299d42/evidence/2026-11-03/dialog-mask-identity-red) retains the executed probe, command, reports, process-exit integrity, all raw failures, identity observations and 32 original PNGs. Its public text has explicit raw/derived hashes; eight settled PNGs were individually viewed. The archive is `d24be7df7952f383932efd478088c42c3908807335bb63c5d40b8d6f82c6f464`. The outer derived summary was hook-formatted; a separate signed manifest fix binds the final bytes. The raw archive and PNG bytes did not change.

## Bounded identity repair

Both concrete demo recipes contain exactly one Dialog Root, with Mask and Content as direct logical children. The clicked Trigger's nonempty `aria-controls` now identifies Content rather than choosing the page's last Dialog. The original visible wait precedes its uniqueness check. Family and runtime must match the selected case.

The measured Mask must be the unique physical `data-pui-root` for the same owner/family/runtime/generation and declared Mask prototype, with active presence. The unique physical Root must be the Trigger's nearest Dialog Root. The ready scope and actual active generation host must carry the corresponding owner and generation. Scope owner alone would not distinguish multiple Dialogs. React's `display:contents` Portal wrapper is not the measured physical root. Missing or ambiguous identity remains unresolved and fails at the original settled Mask assertion stage, after earlier Content/Title checks.

The original first node's identity and rectangle remain in observations. Geometry is checked after identity; nonzero size is never a selection predicate. The permanent diagnostics omit page-wide code maps copied by the initial probe.

## Local evidence and remaining acceptance

Final probe SHA256: `50f13884d5081c13d126f06c5297a6b98c1c185ea2f8b5e0af46187bacd35b0e`. On Node 24.21.0 / pnpm 10.32.1 / macOS arm64 / Chrome 155.0.8059.39:

- Candidate `2e17ac95` plus this exact probe: original eight cases passed, 120 geometry observations and 120 PNGs, exit 0, completed cleanup, no runner or unhandled errors or process timeout. Four widths, long content, 200% root font, page scale and close/reopen assertions are unchanged. Sixteen selected final captures were individually viewed; this is not a visual audit of all 120 captures or physical-device evidence.
- Fixed source `15d864de54210c2eebc4f4b2fec6235324989989` with the identical three-file probe closure: eight cases failed, retaining three Shadcn inset failures, four Brutalist Title overlaps of 504, and Shadcn Vue2 not offered. Exit 1 and cleanup completed with no runner/unhandled errors or process timeout. Its own lockfile was installed offline/frozen/ignore-scripts. An earlier dependency-symlink setup failed on missing CLI `prompts`, skipping all eight; that preparation failure is retained separately.
- Ten isolated synthetic-DOM controls execute the actual `facts` callback: unrelated first node, other owner, old generation, absent presence, missing Mask, duplicate Mask, duplicate Root, wrong generation host, wrong controls, and a real zero-sized Mask. Exact returned node IDs discriminate same-sized distractors. The zero-sized valid Mask still resolves and fails the original width check. These controls are not additional real product journeys.

The first repair candidate had six passes and two premature React count failures; its count check ran before the original visible wait. That failed candidate and subsequent source-bound runs remain separate. Independent review also caught the missing presence condition before this final closure. Local review is partial/ABSTAIN, not GitHub approval.

Only `CURRENT_PROBE_HASHES` changes to the new probe hash. Historical `PROBE_HASHES` and the complete historical classifier remain byte-identical. Current input binding does not calibrate the new closure. The local runs use explicit precommit probe annotations, not canonical CI metadata; final exact-head hosted pairing and independent calibration/review remain required. No local all-green claim is made for the wider #1210 checks, mobile evidence or #1161.
