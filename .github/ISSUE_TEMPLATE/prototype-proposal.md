---
name: Prototype Proposal
about: Propose or prepare a Base, projected, or styled-only Prototype contribution
labels: ['area: prototypes']
---

## Contribution path

- [ ] Maintain an existing `P-*` identity
- [ ] Project an existing Base `P-*` into a design language
- [ ] Implement a maintainer-approved Base semantic slice
- [ ] Propose a new Base subject
- [ ] Propose a styled-only Prototype with no Base counterpart

## Applicable entities and lifecycle

- `P-*`:
- `T-*`:
- Related `K-*`, `D-*`, or `C-*`:
- Status and version:

## Owned information path

For a new Base subject, identify the input fact, owner, observable output, and synchronization rule. For a projection, identify the Base owner and the derived presentation-only delta.

## Negative boundary

What value, event, focus, accessibility, layout, host, form, announcement, or compatibility responsibility must this Prototype not claim?

## Reference source and provenance

Link the exact upstream path and revision. State what is copied, adapted, compared, or independently authored, plus license and notice requirements.

## Public surface

List proposed identities, anatomy, props, states, events, methods, exports, and explicitly unsupported upstream APIs.

## P/T and executable evidence

- Which criteria need P entities?
- Which T cases and real test paths verify them?
- Which Web Component, React, and Vue evidence is required without claiming broader multi-host conformance?

## Readiness and decisions

- What is already decided?
- What may the contributor decide?
- What requires a maintainer checkpoint?
- Is implementation authorized? Default for a new Base subject: **no**.

## Delivery scope

List source, entities, tests, exports, CLI/presets, docs, demos, previews, and generated projections that belong to the coherent slice. Every new public Prototype identity or anatomy family must include a reachable website page; this cannot be deferred as an optional follow-up.

## Website review surface

- Proposed public docs route:
- Documentation entry or navigation location:
- Approved states and behavior the page will demonstrate:
- Applicable runtimes: Web Component / React / Vue
- How the demo uses the Prototype's own anatomy, triggers, state, events, and defaults:
- Is external demo orchestration unavoidable? If yes, explain why the Prototype has no natural trigger or why its public controls must be demonstrated, and identify the consumer-owned code that is not installed with the package.

The website demo must consume the real public package export. Development-only Demo Matrix coverage is supplementary and does not replace this page.

## Out of scope

-

## Dependency changes

List any new dependencies and why they are necessary.
