---
title: 'Material Experiment'
description: 'The experimental Base Button and owned-scene material fixture, its execution boundary, and its relationship to Liquid Glass.'
---

This page records the experimental composition in [PR #809](https://github.com/Proto-UI/Proto-UI/pull/809). It is a historical V1 experiment, separate from the current [Liquid Glass Button](/en/ui-libraries/liquid-glass/button/). The fixture's name, `experimental-owned-material-button`, is a test identity for Base Button plus a candidate generic material capability. It is not an additional admitted Button protocol, a public package import, or a permanent private component API.

## What the fixture declares

At [checkpoint `9ce6011`](https://github.com/Proto-UI/Proto-UI/blob/9ce6011b50c4ab6792bd1261142d03a87f5b9471/experiments/material-specializer/button.proto.ts), the real Prototype consumes `asButton()` for input and activation. Its experimental module declares refractive material, an application-owned scene source, a rounded shape whose geometry comes from final style, an authored opaque fallback, style-owned foreground, and Button press semantics. It does not declare textures, uniforms, shader syntax, rendering passes, synchronization commands, or an implicit screenshot of the page.

Base Button retains its event, disabled, focus and press ownership. The experiment asks how one reusable visual capability can carry those facts through the common framework. It must not solve the problem by creating a separate page-owned Button implementation.

## Implemented experimental path

The checkpoint's Feedback material capability observes the existing Base state handles and combines material state with the final post-patch style. Material-relevant geometry, fill and foreground rules stay in the runtime evaluator. The Web Component Adapter consumes that visual output through an opt-in material host. The specialized compiler selects a fixed audited WebGL implementation and its finite resource plan for an explicitly registered experimental consumer.

The source belongs to the application: an owned RGBA source lease is not arbitrary DOM backdrop capture. Geometry has one final style owner. The consumer must release the GPU and source subscriptions with its view. Without the installed GPU consumer, the authored opaque CSS fallback reports `material-support-unavailable`; it loses refraction, source sampling, and optical press response. That is an explicit degradation, not an equivalent rendering.

## Evidence and limits

The isolated browser fixture exercises pointer press/release, keyboard activation, disabled state, injected preference loss, source loss, graphics-context loss/restoration, and replacement-owner mounting. Preference injection in a test is not an operating-system preference change. Source tests, actual GPU runs, package-size checks, and semantic admission are separate evidence categories; inspect the exact commit's [checks in PR #809](https://github.com/Proto-UI/Proto-UI/pull/809/checks).

At this exact checkpoint, [the isolated GPU workflow](https://github.com/Proto-UI/Proto-UI/actions/runs/37186882384) passed. Its artifact `11296769949` contains eight screenshots, the source-bound JSON report, LICENSE and NOTICE. The report records no errors or external requests, actual canvas-pixel change during pointer press, keyboard activation, disabled gating, fallback on preference/source/context loss, recovery and replacement-owner mounting. This is real GPU evidence for this candidate, not the earlier upstream benchmark.

Package budgets remained failing independently of that successful workflow. The opt-in split excludes the finite material implementation from ordinary Runtime, React and Vue bundles, but their whole-entry minified-and-gzipped budgets still exceeded the unchanged thresholds. These are package-level measurements, not the size of this Button. Package build and type checks are tracked separately in the PR; the GPU workflow does not imply that they pass.

A later checkpoint, `157269bbd9bea981a4c59425f667628b9b6d5b8e`, passed [the dual-consumer GPU workflow](https://github.com/Proto-UI/Proto-UI/actions/runs/37188311449). Artifact `11298042765` covers the same eight scenes both from workspace source and from built package artifacts, with no external requests or page errors. The latter uses 291 package `dist` inputs and no package `src` paths. The package build/type issues were repaired there; package budgets remained failing. This verifies these build outputs, not an npm publication or complete packed-tarball compatibility. The images below remain explicitly tied to the earlier `9ce6011` source.

A bounded WebGL execution result does not establish:

- arbitrary effect-graph compilation or full Prototype ahead-of-time compilation;
- React, Vue, Vue 2, GPUI, Flutter, Qt, or other material consumers;
- automatic sampling of surrounding page content;
- shape fusion, shared groups, morphing, or a complete Liquid Glass family;
- stable material admission, published package availability, or acceptance of package-budget regressions.

The experiment has no public RuntimeBox here: its private consumer is not part of this website's public prototype registry. That historical V1 fixture is distinct from the current V2 public Previewer path, whose visible-canvas source and optical provider require their own exact-head evidence. The original [isolated upstream benchmark in PR #807](https://github.com/Proto-UI/Proto-UI/pull/807) is another fixture and cannot stand in for this composition's evidence.

## Exact-checkpoint images

These original captures are from the source `9ce6011` fixture, not the stage-0 library demo. The pair shows rest and pointer press on the same owned scene. Later commits require their own evidence.

![Material fixture at rest, source 9ce6011](https://raw.githubusercontent.com/Proto-UI/Proto-UI/a8abe11e7cd969d0bc764bf834d179ddc6a99733/evidence/pr-809/9ce6011/01-rest.png)

![The same fixture during pointer press, source 9ce6011](https://raw.githubusercontent.com/Proto-UI/Proto-UI/a8abe11e7cd969d0bc764bf834d179ddc6a99733/evidence/pr-809/9ce6011/02-pointer-pressed.png)

[Verified evidence report](https://github.com/Proto-UI/Proto-UI/pull/809#issuecomment-5977934590)

## Source and license

The selected shader source is pinned to `naughtyduk/liquidGL` 3.0.0, commit `88f681ab7035fd55b04f63edff1841e32c4199e9`. The experimental tree preserves the MIT license, source hashes, ranges, uniform manifest and modification notice; the original demonstration-asset exclusion remains in force. Generated outputs must retain the relevant notices. See the [checkpoint source and license inventory](https://github.com/Proto-UI/Proto-UI/tree/9ce6011b50c4ab6792bd1261142d03a87f5b9471/experiments/material-specializer).

This page records the experiment rather than changing the `P-LIQUID-GLASS-BUTTON` lifecycle or admitting its backend. Follow [the library overview](/en/ui-libraries/liquid-glass/) for the public working surface and [the documentation coverage index](/en/build/prototypes/documentation-coverage/) for other branch-only additions.
