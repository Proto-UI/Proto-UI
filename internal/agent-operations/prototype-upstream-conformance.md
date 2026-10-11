# Prototype upstream conformance and completion

This engineering rule applies to every new or maintained prototype and every selected design family, not only Shadcn. It supplements `AGENTS.md` and the applicable `spec/**` authority; it does not silently change a cataloged semantic contract or relax publication and review gates.

## Reference and semantic inventory

Before claiming upstream alignment, pin the official source for each component and family to an immutable revision or release, with exact paths and source lines. Record the recipe, style variant and dependency version where relevant. If only documentation is available, record the official URL, retrieval date and retained evidence. Do not invent a source implementation for a design language that has none. Distinguish the adopted baseline from a newer comparison reference; changing the baseline or intentionally differing from it requires an explicit governed decision. Do not claim that a newer, unmigrated version has been adopted; gaps against the adopted baseline still require closure.

Inventory the complete applicable semantic surface: props and defaults, controlled and uncontrolled state, events and cancellation, all constituent parts and compositions, selection modes, disabled/readOnly, keyboard/pointer/touch/IME, direction and orientation, focus and accessibility, presence and state motion, interruption/reversal and reduced-motion behavior. Compare semantic coverage, not identical Web prop names. Map framework or DOM-specific APIs to an explicit portable semantic equivalent or a governed boundary; never silently drop them.

## Mandatory prototype-first closure

A missing capability is work to complete, not a permanent audit disposition. Close the loop:

1. Establish the shared definition, inputs, outputs, state, ownership and acceptance criteria.
2. Define any missing neutral, reusable capability needed by that definition.
3. Implement the component's semantics in the Base prototype and its applicable family projections.
4. Make the website, demos and other consumers use those real prototypes and parts.
5. Verify the authored implementation and its actual composition on each required target, then reconcile the definition, implementation, consumers and evidence.

All component behavior, state and motion semantics must be defined and implemented as prototypes. Do not let the work expand into platform-specific component implementations. Platform characteristics are not a reason to leave behavior unprototyped. Hosts and Adapters may only project defined neutral capabilities such as input, geometry, focus, accessibility, rendering and animation execution; they must not become alternate owners of component policy. Do not add component-name/source-path dispatch, platform-specific component branches, page-local DOM/CSS behavior, or handwritten website substitutes to impersonate the missing prototype.

When a neutral capability is missing, produce its proposed definition, minimal reproduction, acceptance criteria, dependency owner and tracked next step. Keep the dependent component open and continue independent prototype work. Do not silently reduce scope or mark the component complete. Any scope reduction or intentional divergence from the requested conformance requires explicit user approval, with the bounded exception, rationale, decision reference and evidence recorded and reviewed. An agent cannot approve its own exception to conceal incomplete prototyping.

Prototype and Compiler implementations must independently realize the shared definitions. Do not reverse-engineer component semantics from a compiler's current subset or embed component business logic in Compiler/IR to make composition pass. Preserve the current Compiler/IR owner's boundary and hand off reproducible neutral capability gaps.

## Evidence and completion

For every component-family pair, record each semantic unit as implemented with evidence, explicitly missing, contract unresolved, or unverified. Name the responsible layer: Base prototype, family projection, consumer misuse, or neutral capability implementation. A declared downgrade must include its definition and observable behavior; it does not count as the omitted capability being implemented.

Verify default and non-default states, multi-value/range cases where applicable, controlled acceptance/refusal/delayed updates, disabled/readOnly, keyboard/pointer/touch/IME, LTR/RTL and orientation, focus entry/return/trapping, accessibility relations, mount/unmount/re-entry, state and presence motion, interrupted/reversed motion and reduced-motion. Treat motion's actual trajectory and lifecycle separately from a timer, CSS class or two endpoint screenshots. Test accessibility behavior rather than only attribute presence.

Verify every selected family against its own reference and definition. Shadcn, Neobrutalism, Bootstrap 2.3.2 and Liquid Glass do not share one interchangeable reference image or exemption. Where the official language lacks a modern component, define and implement the selected portable semantics in that family instead of dropping it or claiming a nonexistent official equivalent.

Keep source conformance, Module/Host/Adapter realization, Compiler coverage, real consumer use, real-input accessibility and commit-bound visual/motion evidence separate. A screenshot that looks similar, exported file, passing isolated test, unsupported diagnostic or Web mock of a native target does not establish completion. Bind evidence to the exact revision and disclose failures and unrun targets. Pair visual and behavioral evidence for the same component, variant, state and input sequence under comparable viewport or native layout constraints. Preserve earlier failed evidence; do not rewrite unverified, unsupported or downgraded cases as passes. Only close the item after all required semantic, family, consumer, target, test, review and lifecycle gates have been satisfied; an explicitly authorized scope change must remain visible.
