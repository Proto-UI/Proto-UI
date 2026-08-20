---
name: Adapter Proposal
about: Research a new adapter or a major adapter boundary with maintainer guidance
labels: ['area: adapters', 'needs maintainer design']
---

> The Module, Host Capability, and official Adapter-profile catalog is still being completed. This template starts maintainer-guided research; it does not authorize an implementation pull request. A bounded parity bug should use the Bug Report template instead.

## Target technology

Which framework/platform is this adapter for?

## Scope

- Minimal component list to validate (e.g. Button, Dialog)
- Expected behavior coverage

## Applicable spec and catalog gaps

- Which `C-*`, `M-*`, `HC-*`, `A-*`, and `T-*` entities already apply?
- Which required relations or semantics are still uncataloged?
- What known implementation or documentation drift may affect this proposal?

## Evidence before implementation

- Which frozen Prototype and smallest host capability slice would be used for a feasibility assessment?
- What would prove native, translated, emulated, unsupported, or deferred realization?
- Which existing Adapter is comparison evidence, and which details must not be copied as protocol authority?

## Contributor and maintainer decisions

- What may the proposer investigate independently?
- Which decisions require a maintainer checkpoint?
- Has implementation been authorized? Default: **no**.

## Dependency changes

List any new dependencies and why they are necessary.

## Notes

Any constraints, references, or prior art.
