# Bootstrap and Liquid Select projection delivery

## Scope and authority

The PR #872 Finf task calls for all Base identities to receive genuine projections in each family, with complete behavior, documentation, demos, compiler and host evidence. This increment implements the missing Bootstrap 2.3.2 and Liquid Glass Select Root, Trigger, Value, Content and Item directly through the corresponding Base hooks. It does not redefine that larger task as complete. All new P entities remain draft, and each requested acceptance gate still applies.

The starting source is `86f2c0c52e370d703665028d8ef5cef45f0685a0`, the budget child of the fifth-source checkpoint. Current local results concern the changed candidate tree; the final integrator must bind remote CI and screenshots to the actual published development SHA. No remote ref, merge or release was performed by this worker.

## Implementation and decisions

- Base retains open/value ownership, controlled request arbitration, collection/text derivation, accessible relationships, disabled gating, keyboard/typeahead, pointer active state, dismissal, focus restoration, anchored fixed portals and transition presence. Every styled part consumes its own Base hook once.
- Bootstrap 2.3.2 supplied a native HTML select and a distinct button-dropdown design. The new custom Select is explicitly a Proto UI design-language extension. The implementation preserves the historical button gradient/caret, 6px popup corners, 0/5/10px shadow and rem-expressed menu/option spacing. It changes nowrap to wrapping, bounds the portal and darkens the option highlight for white-text contrast. Both the source package and published CLI carry attribution for the derived visual values. No upstream JavaScript was executed or redistributed.
- Liquid Trigger and Content declare shared typed optical material intent with complete opaque style fallback. Trigger derives rest/pressed deformation from Base; Content requests explicit glass while open. There is no component-private material flag or adaptive native-blur substitution. Root, Value and Item do not invent material owners. Material frame tests establish intent/lifetime only, not self-implemented optics or GPUI paint.
- Trigger/Value/Item use logical text alignment, shrinkable widths and wrapping. Content is bounded by available width/height, while Base retains placement and collision props. Full labels and persistent selected checks are rendered from Base facts.
- A new material-lifetime test exposed a shared Base defect: `setupSelectCommand` did not clear hovered/pressed when its view unmounted while the logical instance survived. The repair belongs to that Base helper, not either projection; a retained Trigger no longer replays stale pressed deformation on remount.
- Family toolbar composition also requires a real Text atom. Both missing Text projections were added as a separately reviewable dependency; see the paired Text record. Existing Bootstrap/Liquid public toolbar suppression was removed where these concrete dependencies now exist.

## Verification and failed attempts

The original material-lifetime test failed on retained pressed state before the Base correction. Its unchanged assertion passes afterward. A source-closure test first detected the missing 6px CSS token; the finite translator now lowers that explicitly. Initial projected React tests used the existing imperative fake-React harness, which cannot preserve authored nested slots through the projection render; final evidence uses actual composed React and the real four-framework Previewer instead. A synthetic readiness assertion initially mistook the Trigger's `Alpha` label for focused option text; it now requires the actual option role before dispatching navigation. Existing manifest tests were updated to require the new exact parts and acceptance Button lineage while retaining explicit rejection of still-missing families.

Evidence sources:

- `packages/prototypes/test-utils/test/select-projections.behavior.test.ts`: both complete inherited WC protocols, long-text style policy and five-part identity.
- `packages/prototypes/liquid-glass/test/select-material.test.ts`: shared intent frames, missing-host fallback/diagnosis, cancel/disabled reset and logical view release/remount.
- `apps/www/src/components/PrototypePreviewer/select-draft-projections.integration.test.ts`: actual WC/React/Vue/Vue2 selection, controlled acceptance, disabled/focus behavior and family toolbar.
- `packages/adapters/vue/test/select.test.ts` and `packages/adapters/vue2/test/select.test.ts`: actual family framework consumers alongside existing Base coverage.
- `packages/cli/test/select-projections.test.ts`: all five private source exports, four workspace-only Web facades, finite physical CSS and unsupported GPUI rejection.
- `apps/www/src/content/docs/zh-cn/demo-select-draft-projections.browser.test.ts`: separately registered native input/paint, light/dark, 320px/200% text, RTL portal, screenshots and native Text selection. No passing local browser execution is claimed.

The catalog and graph validate; workspace type checks pass. Documentation checks pass with zero errors; their first attempt was blocked by the default unwritable Astro configuration directory, then succeeded with a writable temporary config home and disabled telemetry. Agent snapshot generation first hit the tsx CLI pipe restriction; the supported Node loader invocation completed. A Base-to-new-test relation needed an explicit 0.3.0-alpha.1 start and was corrected rather than backdating the new test.

## Remaining gates and next step

Shared portal direction currently needs source-bound native reproduction and repair in its Adapter owner; `text-start` alone cannot preserve an RTL consumer after body portaling. The native suite retains that assertion. The native worker owns the shared follow-up. GPUI Select still needs true overlay, positioning and focus hosts; token or bundle entries are insufficient. Optical realization, screenshots inspected against the exact source, independent review, final combined CI/package budgets and stable admission remain separate work. The integrator must apply the Text dependency and Select packets, regenerate combined derived outputs, run exact-head CI, inspect captures and publish commit-bound evidence. No threshold or acceptance test was weakened to claim completion.
