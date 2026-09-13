---
name: Adapter Proposal
about: Advance a new adapter or major adapter boundary through evidence-first research and implementation
labels: ['area: adapters']
---

> Use this template to produce the smallest host-capability and Adapter-profile slice that can be tested honestly. When existing authority and the bounded outcome determine the result, an Agent or contributor may continue through implementation and independent review. Isolate one decision packet only if materially different product directions remain. A bounded parity bug should use the Bug Report template instead.

## Target technology

Which framework/platform is this adapter for?

## Scope

- Minimal component list to validate (e.g. Button, Dialog)
- Expected behavior coverage

## Applicable spec and catalog gaps

- Which `C-*`, `M-*`, `HC-*`, `A-*`, and `T-*` entities already apply?
- Which required relations or semantics are still uncataloged?
- What known implementation or documentation drift may affect this proposal?

## Evidence and first implementation slice

- Which frozen Prototype and smallest host capability slice would be used for a feasibility assessment?
- What would prove native, translated, emulated, unsupported, or deferred realization?
- Which existing Adapter is comparison evidence, and which details must not be copied as protocol authority?
- What focused contract, fake-host, cross-Adapter, or real-host evidence makes the first slice reviewable?

## Automatic continuation and decision boundary

- What does existing authority already decide?
- What may the Agent or contributor decide within this bounded slice?
- What is the first implementation and validation result that can proceed now?
- Is there an `unresolved-product-direction` choice? Default: **none**. If yes, list the materially different options and the smallest decision required.
- Does the work require a `privileged-or-irreversible-operation`? Default: **none**.

## Dependency changes

List any new dependencies and why they are necessary.

## Notes

Any constraints, references, or prior art.
