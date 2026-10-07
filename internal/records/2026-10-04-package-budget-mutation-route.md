# Standalone package-budget mutation route

## Review finding

[PR #825 review r4178761470](https://github.com/Proto-UI/Proto-UI/pull/825#discussion_r4178761470) identified an executable routing gap in `069210a75b61909765c685203ccd615df114752f`: the development entrypoint delegated numeric package-budget choice, but the registry had no owning mutation leaf for its separately reviewable transaction. The read-only `pui-govern` leaf could not perform that edit, and semantic implementation leaves did not own standalone ceiling changes.

## Correction

Register `pui-package-budget` as a development-only C2 feature-branch transition with the distinct `update-governed-package-budget` task class. It requires the existing capability envelope, authority map, measured candidate, canonical package-budget evidence and implementation authorization. It consumes the existing `pui-validate` `evidence-report` and returns `candidate-change`, including the numeric diff and its attributable transaction record. The next validation replaces the initial measurement report with candidate-bound evidence before independent review; historical measurements remain cited in the record. The entrypoint and bilingual skill catalogs route readers to that leaf.

The leaf is limited to numeric ceiling literals, associated explanatory comments and its supporting evidence record. It preserves the existing before/after, compression provenance, growth attribution, integrated-combination measurement, bounded-margin rationale, blocking gate, final-head CI/DCO and independent-review requirements. Measurement parameters, implementation semantics, privileged operations and other limits are outside its mutation scope. `pui-govern` stays read-only.

## Verification boundary

Eight new tests were run against the unfixed head first: standalone resolution failed as unknown, the real CLI could not load the leaf, and the handoff routes were unavailable. The candidate tests exercise direct CLI resolution, required-input rejection, governance-report insufficiency, candidate/transaction ownership, existing evidence production, validation/review routing, repair handoffs, autonomous ceilings and genuine decision gates. A further terminal-path control verifies that the numeric leaf can return its incoming candidate unchanged with explicit blockers before any edit, without inventing an output transaction. They verify the routing contract and preserved Skill obligations; opaque evidence references still require inspection by the acting Agent and independent reviewer, as with other implementation leaves.

No numeric budget or package-budget measurement source changes in this correction. The previous commit's DCO and history are retained. Candidate validation and remote CI results belong in the new SHA-bound commit report; prior passing evidence is not claimed for the corrected head.
