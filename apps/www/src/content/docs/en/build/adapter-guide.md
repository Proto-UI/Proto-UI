---
title: 'Adapter Contribution Guide Deferred'
description: 'The evidence available today, bounded Adapter work that may proceed, and why a general authoring workflow is not yet published.'
---

Proto UI does not currently publish a general Adapter authoring tutorial. The shipped 0.2 execution architecture and the first reviewed profile slices are now documented, but the catalog is intentionally partial and there is no stable public SPI for constructing a new Adapter by analogy.

Use the focused architecture guides first:

- [Runtime Architecture](/en/build/runtime-architecture/) explains `RuntimeSession`, commit ownership, and the host handoff.
- [Host Caps](/en/build/host-caps/) explains capability tokens, wiring, target projection, and resource lifetime.
- [Module & Extension Architecture](/en/build/module-extension-architecture/) explains facade/port/dependency ownership and the fixed Runtime Module set.
- [Compatibility](/en/reference/compatibility/) reports only the currently reviewed relations for the official Web Component, React, and Vue profiles.

Those pages describe current facts; together they still do not define a complete new-Adapter recipe.

## Why the general workflow remains deferred

Official Adapter profiles are cataloged one Module slice at a time. Unlisted Modules are uncataloged, not implicitly supported or unsupported. Lifecycle ownership, capability omission strategy, host target roles, and executable conformance must all be decided for a concrete target. Existing Web implementations are evidence, but Web-specific routing and framework mechanics cannot define a cross-host architecture by themselves.

This page therefore will not:

- present current Web Adapter structure as a stable cross-host SPI;
- infer complete Module support from package dependencies;
- treat uncataloged fallback or host wiring as a guarantee;
- promise dynamic Runtime Module registration; or
- encourage Prototype-specific patches for Adapter parity problems.

## Bounded work that can proceed

Experienced contributors may implement an Adapter parity bug when its Issue states:

- applicable `C-*`, `M-*`, `HC-*`, `A-*`, and `T-*` entities;
- the owning semantic or translation layer;
- the profile and target runtime/version range;
- behavior that must remain unchanged across Adapters;
- focused Runtime/Module and Adapter evidence; and
- explicit implementation authorization.

New Adapter proposals remain maintainer-guided research. A useful proposal can inventory host capabilities, model honest support/omission decisions, identify lifecycle and target ownership, and build minimal feasibility evidence. It does not automatically authorize a production Adapter PR.

## What would unlock a complete guide

A trustworthy exemplar needs:

1. a coherent set of Module facade/port and Host Capability owners;
2. reviewed profile `supports`, `omits`, and `provides` relations;
3. executable attach/rebind/reset/dispose responsibilities;
4. resolved or explicitly recorded implementation/catalog drift;
5. target-specific commit, event, projection, and diagnostics behavior; and
6. conformance evidence that separates portable semantics from host mechanics.

Until then, choose a Prototype, docs, demo, Module slice, or bounded bug through [How to Contribute](/en/build/contribute/) and use [Contracts & Tests](/en/build/contracts-and-tests/) to design evidence.
