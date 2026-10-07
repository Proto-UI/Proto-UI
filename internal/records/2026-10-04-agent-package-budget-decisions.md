# Agent-owned numeric package-budget decisions

## Direction and scope

The maintainer requested that package-budget ceiling increases needed to advance accepted work no longer wait for a separate human decision. The development skill now assigns that bounded numeric choice to the Agent within an authorized task. The authoritative workflow text is [the development entrypoint](../../.agents/skills/pui-dev/SKILL.md#decide-package-budget-ceilings); this record preserves the change context, not a second rule.

This narrows the approval dependency while retaining the evidence discipline in [#654](https://github.com/Proto-UI/Proto-UI/issues/654#issuecomment-5677625733), especially its separately reviewable transaction and growth-attribution requirements. Earlier records, including [the bounded Meta transaction](2026-10-03-bounded-meta-budget-transaction.md), remain factual history of the decisions made then. They are not rewritten as if this delegation already existed.

## What changed

- The Agent may select a bounded numeric ceiling for an already accepted capability without another human gate.
- Canonical before/after CI, exact revisions, environment/compression provenance, minified hashes, growth attribution, old/new ceilings and resulting headroom remain necessary.
- Related contributions must be measured as an integrated combination. Isolated increments are not additive evidence of combined gzip cost.
- The whole-entry gate stays blocking; consumer/profile results remain diagnostic. Final-candidate CI and independent review still decide integration eligibility.
- Public API, capability acceptance, other resource/spending budgets and privileged operations gain no authority. The `pui-govern` leaf stays read-only.

## Implementation and verification boundary

The change touches the canonical development skill, its short `AGENTS.md` entrypoint projection, and focused rule-contract tests. No package-budget number, measurement implementation, runtime, permission, repository protection or old decision record changes in this transaction.

The focused tests protect the bounded delegation, canonical/combined evidence, unchanged blocking and independent-review obligations, the entrypoint link, and the governance leaf's no-mutation classification. Run `check:agent-operations`, generate the disposable Agent snapshot, and run `check:agent-doc`; final command results and remote CI belong in the SHA-bound PR report. This work does not claim to verify any feature's proposed byte allowances.
