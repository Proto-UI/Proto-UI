# Sprint 2: complete generated types for actual Tabs Content

## Concrete failures

Once the original Shadcn Tabs Content source could pass local nominal parameters, all four Web profiles compiled it. Checking the complete generated project under strict TypeScript, including every supporting JavaScript module with `checkJs`, found additional emission defects.

All four profiles widened `Object.freeze`'s checked finite literal array to `readonly string[]` at the native TypeScript generic overload. The consumer's declared finite style IDs therefore failed assignment. The emitter now carries the independently validated intrinsic result type across that inference boundary. It still evaluates the original operand once and calls native `Object.freeze`; it introduces no copy, deep freeze or new runtime object.

Vue 2 additionally inferred its Context validator Map from only the first key's literal debug name, emitted a schema-checked callback against an unknown-valued transport signature, and represented the checked FocusEntry and StyleHandle nominal values as `unknown`. Its complete real Content artifact reported 14 diagnostics. The Map's existing finite entries now have the explicit transport tuple type; the original callback expression receives a type-only transport view at its original evaluation position; and the actual paired native capability types are retained. A reached static style literal retains its checked StyleHandle type. No field or capability is inferred from a component name, key spelling, or raw object cast.

## Verification

The regression builds unchanged real Shadcn Tabs Content together with an independently authored provider of its actual Context and Anatomy family. Both use ordinary `compileProject` / `writeProjectCompilation` output and ordinary generated module imports, so shared Context identity comes from the artifact graph. The provider does not implement or replace Tabs Root's selection algorithm.

The generated checks cover the small local-helper fixture and the complete Content/provider project for each Web profile under strict TypeScript and `checkJs`. The small fixture passed four complete artifacts. The actual Content/provider project then passed separate selected React, Vue 3 and Vue 2 cases, one case per profile. The WC test process exited under resource pressure; its recovery used a separate producer and a fresh plain TypeScript program, which checked **17 emitted roots with zero diagnostics**. This records the actual recovery mechanism rather than calling the exited suite a pass. The profile logs and WC report are retained in the [local compiler evidence bundle](evidence/2026-11-24-sprint2-compiler-local/README.md).

The final actual Content/provider runtime file completed **4/4** on the combined local-helper, type-fidelity and owner/module-boundary source. It covers selection-derived State, initial view, hide/reopen, `keepMounted`, stable State identity across view epochs and a fresh replacement owner with terminal old-handle rejection. The later WC owner repair also passed a complete four-profile strict generated lifecycle fixture. The real Content artifact recoveries and that later owner fixture are separate evidence; neither resource-exited combined run is counted as successful.

The final 15-root source/test TypeScript program passed with zero diagnostics after the artifact helper's profile parameter was narrowed to the existing generated-profile type. The original frozen-array runtime/source file was rerun with the combined changes and passed **22/22**, including native identity and readonly counterexamples. Complete logs, original failures and the source/test driver are retained beside the successful receipts.

This is bounded generated-consumer evidence under Happy DOM. The fixture has no Trigger, so Content's `labelledBy` target is intentionally absent and its real accessibility diagnostic is retained. It does not establish full Tabs, focus/keyboard/AT acceptance, full native support or the original complete library/profile denominator. Tabs Root still refuses its opaque `get` member assertion independently.
