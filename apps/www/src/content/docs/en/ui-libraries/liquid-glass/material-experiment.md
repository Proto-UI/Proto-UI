---
title: 'Material Experiment'
description: 'Notes on the early Base Button and owned-scene refractive material experiment and how it relates to Liquid Glass Button.'
---

This page documents the early refractive-material experiment (`experimental-owned-material-button`), which explored layering a reusable optical capability onto [Base Button](/en/ui-libraries/base/button/) without bypassing shared semantics. It is kept as a historical architecture note and is separate from the current [Liquid Glass Button](/en/ui-libraries/liquid-glass/button/).

## Design approach

The experimental prototype consumes `asButton()` for input, focus, disabled, and press semantics, and declares:

- **Refractive material intent**: rounded geometry, foreground colors, and an explicit opaque fallback are derived from final styles rather than embedding shaders, textures, or render passes in the prototype.
- **Application-owned scene source**: optical sampling reads an explicit application-supplied RGBA scene source rather than capturing arbitrary page DOM.
- **Deterministic cleanup and fallback**: GPU and source subscriptions release when the view unmounts, and hosts without a material consumer fall back cleanly to opaque CSS styling (`material-support-unavailable`).

## Experimental path and scope

The experiment paired the Feedback material capability with computed styles through an opt-in Web Component material host backed by a fixed WebGL implementation, exercising pointer press, keyboard activation, disabled gating, preference changes, source loss, and graphics-context recovery.

This historical V1 fixture is separate from the V2 visible-canvas optical provider used in the public previews and is not part of any published package or CLI target.

## License and further reading

The experimental shader is adapted from `naughtyduk/liquidGL` 3.0.0 under the MIT license; generated outputs must retain the corresponding license and notices.

- For the current interactive component preview, see [Liquid Glass Button](/en/ui-libraries/liquid-glass/button/).
- For an index of other workspace prototypes, see the [documentation coverage index](/en/build/prototypes/documentation-coverage/).
