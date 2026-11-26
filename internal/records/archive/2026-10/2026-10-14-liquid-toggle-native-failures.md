# Liquid Toggle native failure follow-up

Date: 2026-10-14. Investigated source `b2a90f89f4b75a8afcb420c82d9588f7317e7c63` from [run 38633799501](https://github.com/Proto-UI/Proto-UI/actions/runs/38633799501). The source-bound artifact is `liquid-material-b2a90f89f4b75a8afcb420c82d9588f7317e7c63-38633799501-1`, artifact ID `11927962695`.

## Preserved native result

The Toggle suite executed 11 cases: one passed and ten failed. The eight runtime/theme journeys captured committed inactive self-optical `contact-v1` paint with matching geometry, then failed at the initially disabled control: expected `opaque-fallback`, observed `unavailable`. Those partial observations do not establish the remaining pointer, keyboard, controlled, source-loss or preference journeys. The unknown-preferences case passed on all four Web runtimes. Both public locales stalled while clicking the initial Web Component Header Select, before capturing or interacting with a Toggle. The existing public Liquid Button test stalled at the same Header Select call.

## Disabled prototype repair

`P-LIQUID-GLASS-TOGGLE-MATERIAL` already requires disabled controls to contribute zero candidates while preserving the declared opaque fallback. The prototype's `opacity-50` token contradicted that behavior: whole-host translucency makes both fill and foreground depend on the backdrop. The shared V2 Web sink correctly rejects that compositing state with `external-compositing-unavailable` in `packages/adapters/base/src/material/sink.ts`. Its admission rule is unchanged.

Remove only the disabled whole-host opacity token. The prototype still retains active selection, underline and equal-width border; Base still owns disabled activation suppression and cancellation. Disabled projection keeps `pointer-events-none`, `cursor-default` and `shadow-none`. There is no material, Runtime, Core, Compiler, shader, provider or portal implementation change.

Four source-level regressions exercise both themes and both active states through the actual prototype frame, generated CSS declarations and real V2 sink. Only the unit DOM's missing geometry is injected, and the unsupported cascade-layer wrapper is removed without changing its contents. These checks do not establish browser cascade precedence or optical rendering. Replaying the final oracle against the original prototype fails all four cases with `external-compositing-unavailable` and computed opacity `0.5`; the repaired prototype retains `opaque-fallback` at opacity `1`. The native suite keeps its original strict quality assertion and additionally requires opaque alpha, fallback contrast of at least 4.5, and initial-disabled captures.

The first local check could not resolve an existing workspace dependency until the established dependency links were restored. A first CSS harness attempt left the unsupported `@layer` wrapper in happy-dom and failed for `external-foreground-mismatch`; this was a harness failure, not the source regression. An initial type check found an incomplete test source-lease stub and absent generated website styles; the fixture now implements the complete lease interface and normal CLI generation supplies the styles. These unsuccessful checks remain separate from the final source-grounded negative control and validation.

## Public Header Select remains unresolved

The locator resolves the intended visible, enabled Shadcn Select trigger and hangs after beginning native click. Neither a wrong selector nor a Toggle-specific defect is established. Do not skip the initial runtime, force a click, replace native input, increase the timeout, or claim a Select repair from this patch.

The public journeys retain all four runtimes and the original native click/assertions. Limited passive input and stage records, plus bounded failure-only debugger stack collection, provide evidence if the shared failure recurs. Debugger instrumentation may affect timing and is diagnostic, not independent functional or performance acceptance. Diagnostics must preserve the original error, resume after collection, and keep a Node-side failure receipt even when the renderer cannot answer.

## Remaining acceptance

Local source checks cannot clear the failed native acceptance. A later exact-head official run must verify the repaired initial and mid-press disabled states, execute the previously unreached journeys, and establish or diagnose public Header Select behavior. `T-LIQUID-GLASS-TOGGLE-0001` records the actual failed run rather than leaving it described as unexecuted. The family remains draft; broader Compiler, non-Web native, Apple shader, selected tint and group/morph claims remain outside this repair.

```text
Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
This role declaration is not authenticated model identity, permission, independent review, or acceptance.
```
