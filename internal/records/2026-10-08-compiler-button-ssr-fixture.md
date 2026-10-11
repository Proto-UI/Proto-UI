# Real-source Button Compiler SSR experiment

Date: 2026-10-08. Baseline: `5445b04c970f6fb46ccd871d2fbe509709c80e45`.

## Result and scope

This increment connects unchanged official Base Button source to generated server/client/helper artifacts, serialized semantic HTML plus carrier, and the existing CSS renderer. The test presentation imports the real `asButton`; it adds only static styling and the disabled style Rule. A second positive case lowers the unchanged default Base Button directly. No authored prototype is executed during source analysis, and no Runtime snapshot or Runtime Adapter is used by the generated consumer.

The existing internal `ssr: true` emitter path remains an experiment. All four public SSR target flags remain false; public compile/CLI requests still reject them. There is no website rollout or replacement of Card/Header/Search/code snapshots. P-BASE-BUTTON remains draft, and this record claims no general Compiler/native/framework equivalence or independent admission.

## Changes

- Emit a complete finite `Component.css` through the existing canonical renderer. Collect reached static and Rule tokens and reject a missing CSS recipe.
- Bind the source graph, profile, generated owner/client code, helper bytes and CSS bytes. Carry distinct source/helper/CSS versions for diagnostics.
- Require the exact first-frame CSS artifact and initial raw-props snapshot before adoption. Reject source/profile/helper/CSS/props/physical-tree drift without silently rebuilding or destroying the first frame.
- Check generated initial style, interaction attributes and presence before mounting. Preserve pre-adoption nodes and attributes even when a later fresh presentation comparison fails and owner cleanup runs.
- Generate independent UUID instance identities and default DOM IDs for each server render. Reject duplicate live instance identities.
- Validate portable initial data before getters or cyclic/capability values can enter generated setup.
- Add a real HTTP/Chrome suite with caller-controlled bundle delivery and registration, plus a dedicated exact-PR-head read-only evidence workflow.

The fixture README under `packages/compiler/test/fixtures/button-ssr/` records the full artifact chain, consumer obligations and negative capability boundary. Slot HTML remains trusted consumer-authored content; compatibility hashes are not authentication or sanitization. Explicit caller-supplied DOM IDs remain the caller's responsibility. Broad Shadow DOM, context/provider composition, physical controls, portals and other framework/native SSR remain unproven.

## Verification at this increment

Executed locally with Node 24.19.0 and pnpm 10.32.1:

- 21 new source/server/synthetic-DOM tests passed. They cover real-source provenance, direct Base Button, unchanged public gates, no-DOM server execution, deterministic artifacts, generated-closure strict typechecking, exact canonical CSS, retained children/focus/selection, single activation, disabled behavior, idempotent initialization/disposal, all global listener removals and slot observer disposal across 12 owners, explicit mismatch negatives, original-source/helper mutation controls and unique request IDs.
- 37 existing Web Component, Context, style, target and artifact-output tests passed, for 58 tests across seven files.
- Workspace TypeScript check passed after running the documented style generator. An earlier check was blocked by absent linked workspace dependencies, then by absent generated Shadow CSS declarations; neither earlier failure is reported as a pass.
- Dedicated workflow YAML parsed and all embedded shell blocks passed `bash -n`.
- The 15 native browser cases were collected. They were not executed locally. The local socket restriction was respected; no alternate socket/server route was used. Native screenshots, AX, geometry and frame observations are pending actual execution of the exact-source evidence workflow.

The browser suite retains generated TypeScript/helpers/CSS/provenance, bundled client, raw HTTP responses, request hashes, DOM/style observations, accessibility snapshots, frame samples, screenshots and traces. It covers no JavaScript, delayed delivery, pre-upgrade focus and directional Selection, one activation per app effect, disabled focus/activation, repeated lifecycle, simultaneous owners, request ID separation and mismatch preservation. A suite's existence or collection never establishes those native results.

## Next steps

1. Independent review of the combined source/helper and browser-test candidate.
2. Publish only through the parent-authorized repository workflow and run the dedicated CI at the exact final source/tree. Keep failures and repair the owning implementation or oracle rather than weakening assertions.
3. Review native screenshots/AX/frame data and then determine the next bounded SSR capability. Keep public SSR readiness false until its own admission requirements are met.

## Review clarification and subsequent repair

The earlier phrase "one activation per app effect" describes the test's filtered outward `CustomEvent` channel only. Under `A-WEB-COMPONENT-0001-M`, the original native `click` and same-named outward `CustomEvent` remain distinct deliveries; an unfiltered DOM listener can observe both. Disabled suppresses the outward activation, not native event propagation. The review found a separate real fail-open defect for missing/falsy SSR carriers, now recorded with its red/green evidence in [the carrier repair record](2026-10-08-compiler-button-ssr-carrier-repair.md). The original native suite was not run locally, and the original 21/15 counts above describe that earlier candidate, not the repaired candidate.
