# Sprint 4: reconstructable inputs and current definition bindings

This continuation addresses [#913](https://github.com/Proto-UI/Proto-UI/issues/913), [#914](https://github.com/Proto-UI/Proto-UI/issues/914) and [#915](https://github.com/Proto-UI/Proto-UI/issues/915) against public main `d0eb81d3c61c3d3e93e46c4151e78031273d6116`. The earlier recovery was integrated through [PR #1714](https://github.com/Proto-UI/Proto-UI/pull/1714), merge `3551b85049630877e8c062b4d80a56ec2133c532`. Its [original source ledger](../../2026-11-22-sprint4-ir10-recovery.md), frozen failures and contributor boundaries remain unchanged.

## Live source reconciliation

All three live Issue bodies and all 13 comments returned by the exhausted comment pages were read during this continuation. The retained intake IDs are:

| Issue | Read / reported comments | Comment IDs |
| --- | --- | --- |
| #913 | 4 / 4 | `6684419020`, `6684592538`, `6685061254`, `7078833005` |
| #914 | 4 / 4 | `6684418107`, `6684591846`, `6685060172`, `7078833366` |
| #915 | 5 / 5 | `6684417023`, `6684586699`, `6685059193`, `7078833773`, `7078973256` |

The old main=IR5 and unavailable-source statements retain their historical dates. The later recovery comments document the verified original archive and public IR7 work; their old “PR not yet merged” state is superseded by the real #1714 merge above. The source recovery, definition inventory and migration inventory should therefore retain their earned bounded progress while original-candidate acceptance stays open. The superseded four-PR count cap is not reinstated.

The final #915 comment's hardcoded-MIT artifact metadata debt also has a later implementation: commit `13bd3c3bd5756173981f47e89ede740a58eadd79` and the [source-license consumer record](2026-11-23-sprint4-rust-data-license-metadata.md). It preserves omission or the caller's actual declaration and includes the two real Verdant data units' metadata/locked-check evidence. Those exact historical receipts should be carried forward; they do not establish a new full application migration or distribution acceptance. This continuation has not changed any Issue or comment.

## Reconstruction without executing or replacing source

The new `scripts/compiler/materialize-frozen-foundation.mjs` reconstructs the authenticated captured repository inputs into a new private directory. It first runs the existing complete fixed-anchor verifier, independently rechecks the manifest identity, then reads and hashes every output's content object before creating the destination. It preserves each captured file's bytes and numeric permission mode. It rejects overlapping input/output paths, existing destinations, path traversal, symbolic-link directories or objects, duplicate paths, file/directory collisions and mode escalation. It neither imports source nor installs packages.

An authorized holder of the retained packet can run:

```sh
node scripts/compiler/materialize-frozen-foundation.mjs \
  --packet PRIVATE_PACKET \
  --out NEW_PRIVATE_DIRECTORY \
  --archive PRIVATE_ARCHIVE
```

The output is the captured repository-input set. It is not asserted to be the entire historical checkout, a recreated `node_modules`, a Git ancestor, a compiler execution, a public delivery layer or a completed migration. The receipt reports those limits separately; the original 2,982 installed-input files cannot be replaced with whatever dependencies happen to be present on the current machine. No private source body is included in this change.

The six new independent reconstruction controls and eight existing integrity controls pass on Node 24.22.3. The [receipt](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint4-foundation/reconstruction-controls.json) binds the exact command, five implementation/test sources and [raw output](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint4-foundation/reconstruction-controls.log). They exercise real filesystem reconstruction and refusal rather than source spelling. The source that throws if imported is copied inertly; original packet bytes remain unchanged. Corrupted content and invalid metadata fail before an output directory is created. An existing user directory remains byte-identical. These synthetic controls establish the utility's tested behavior. They do not constitute a successful execution against the retained original packet.

## Exact current definition comparison

The new read-only comparison command takes a complete commit SHA and reads Git blobs from that immutable revision. It also requires the exact previously published recovery-inventory hash and original manifest anchor, so another 61-row inventory cannot masquerade as the retained one. It does not substitute dirty worktree bytes or infer an owner decision from a matching hash:

```sh
node scripts/compiler/inspect-foundation-definitions.mjs \
  --repository . \
  --revision d0eb81d3c61c3d3e93e46c4151e78031273d6116
```

The [complete comparison](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint4-foundation/definition-comparison.json) retains all 61 canonical IDs, original and current lifecycle labels, exact current SHA-256 values, governing source paths, version histories, literal references, unresolved questions, seven owner groups and 13 delivery nodes. Its comparison source is the earlier public baseline `dc3b184ba10b0de53e40359c52d012b204b2cd01`, separately from the original frozen manifest `35110c1036f441828f060d8fbf239965a8587a99699ead6b5689268b226adb69`.

The earlier public inventory did not publish individual original hashes. For its 46 explicitly same-byte definitions, the comparison hash is also shown as an **inferred** original hash; the other 15 original hashes remain null and explicitly unavailable in this public inventory. This does not claim a fresh original-packet read.

The historical baseline predates the recovery ledger itself. Comparing that baseline uses the explicit `--inventory-revision d0eb81d3c61c3d3e93e46c4151e78031273d6116` argument; the [result](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint4-foundation/historical-comparison-summary.json) contains both revisions and confirms 61 unchanged definitions. The [first attempt](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint4-foundation/historical-comparison-missing-ledger.json) to read the ledger from the older commit correctly failed rather than substituting worktree data. No successful comparison is inferred from that failed command.

At the new public revision, 58 definitions retain the earlier comparison bytes; three changed and none changed lifecycle label:

| Definition | Change since the earlier public comparison | Consequence for the original candidate |
| --- | --- | --- |
| `C-CONTROL-LABEL-0001` | Added draft shared-SDK Rust nominal association identity and exact GPUI participant/view/pair lease criteria. | Bind any native association claim to the new criteria and actual SDK identity; the earlier Web association evidence cannot supply the new native acceptance. |
| `C-TEXT-CONTROL-0001` | Clarified that unchanged owner synchronization inside input/change/compositionend callbacks must not prematurely replace the physical candidate or truncate its caret; a changed canonical owner remains authoritative. | Preserve callback-boundary and IME behavior in the actual migrated consumer; matching an old type declaration does not prove this behavior. |
| `M-EXPOSE-STATE-WEB-0001` | Added a draft optional read-only witness for the current source, target, mapping, generation and actual CSS emission; candidate-name mapping remains separate. | The original static publication/source-bank binding must not infer emitted CSS ownership from a candidate-name map or silently acquire the new witness. |

The comparison makes these exact revision differences reviewable. It does not activate a draft definition, accept the private Core/Hook ABI, certify authorship, grant state write authority, or admit canonical SSR.

## Remaining original-candidate work

The same seven decision groups remain explicit in the comparison. Core/Main and Hook owners must bind the internal privileged atom and actual callers; Core/State/Rule owners must accept the exact declaration changes; schema and publication owners must bind the three static publications; official authored-input owners must bind the 22 inputs and 43 entries; primitive and native-resource owners must accept the actual applicable contract revisions and execution; SSR request/adoption retains its separate definition and admission boundary. A source comparison is not those decisions.

The 13 recovered delivery nodes still have no asserted public base/head pairs for the private candidate. An original-source stack requires contributor rights and genuine certification, exact shared dependencies, complete input reconstruction including the pinned toolchain, and real build/verification on each actual parent. This change does not manufacture any of those receipts. It also does not rename the public IR7 compiler into the original IR10 migration.

The retained original packet was not yet available to this continuation's local executor when these controls and the public revision comparison ran. Actual packet reconstruction, original compiler execution and consumer migration remain unexecuted here. A later successful original-packet run must supply its own receipt; it cannot be inferred from the synthetic tests above.

## Authorship and evidence boundary

The current user requested completion of Sprint 4. The ChatGPT coding agent authored these reconstruction and comparison utilities, synthetic controls and this dated report independently from the public manifest format. No original private implementation was copied into the new tools. Source identities and filesystem observations are the relevant internal evidence; no browser, physical GPU or assistive-technology result is claimed.
