# Finf host direction and Props classification review

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Question and authority

PR #872 review `discussion_r4214426897` proposes stripping `dir` in the React, Vue and Vue 2 default Props classifiers. The observed input at d0 is real, but the proposed blanket repair changes existing user-facing behavior.

- Active `C-PROPS-0012-B/D/I/J` allows Adapter-classified raw input, permits undeclared raw keys while excluding them from resolved props, and requires raw watchers to observe matching raw changes. Presence in `getRaw()` or a raw watcher firing is therefore not itself proof of a portable Props defect.
- Active `A-REACT-18-19-0001-C`, `A-VUE-3-0001-C` and `A-VUE-2-0001-C` list the existing class/style/listener exclusions and custom `getProps` replacement. They do not designate `dir` as a reserved host key.
- Draft `HC-PROPS-SOURCE-0001-D` leaves host normalization to the Adapter; draft `HC-OVERLAY-PORTAL-0001-A` requires renderer ownership and logical ancestry preservation. Neither changes the declared Props compatibility boundary.
- The historical `2026-10-07-portal-direction-and-reentrant-leases.md` says explicitly that Prototype-declared `dir` is retained. This is supporting historical context, not normative authority.

## Discriminating evidence

All experiments use the same d0 Adapter implementations under Node 24.19.0 and Vitest 2.1.9, with happy-dom rather than native browser paint.

1. Adding host `dir: 'rtl'` to the existing three default-normalization tests and expecting it to disappear from raw input fails all three; the three custom-classification controls pass. This confirms the comment's factual observation, not its proposed semantic interpretation.
2. Temporarily removing `dir` in all three default classifiers makes those raw-filter probes pass, but fails all three added declared-dir compatibility controls: App Maker input `rtl` becomes the Prototype fallback `ltr`. Reverting the three implementation lines restores all three compatibility controls. The rejected implementation is not included in this change.
3. Web Component already has distinct ingress: default `getProps` is empty unless customized; native `el.dir` alone is absent from raw input. Explicit `setElementProps({ dir: 'rtl' })` keeps `dir` in raw; it is resolved only when declared. A later native `el.dir` change leaves the explicit Props snapshot and raw watcher count unchanged. Both declared and undeclared controls pass.
4. The final unfiltered seven-file selection passes 19/19: the four normalization suites, existing Props resolved-snapshot shape suite, and React/Vue real-renderer portal-direction suites. No portable input, host forwarding, portal lifetime or classifier implementation changes are made by this evidence-only change.

## Bounded alternatives

A. Preserve current compatibility and explain why blanket removal is unsupported by the active contracts. Keep the added declared-dir and custom-policy controls. This does not claim that every host raw classification is ideal.

B. Separately design an explicit host-direction input or declaration-aware classification boundary, then establish the cross-Adapter behavior and migration policy before changing defaults. Current `defaultGetProps` sees host input alone, while Props declarations are finalized during setup and `PropsImpl.declaredKeys` is private. Re-running setup, reflecting on private fields, or forcing all existing consumers to adopt custom `getProps` is not a bounded compatibility repair.

This record makes no new reserved-key rule or API decision. The native Vue 2 nested-direction failure in main CI run `37724536947`, browser shard 8, is separate: `overlay-portal-direction.browser.test.ts:250` expects the first nested option's direction to be `ltr` but receives `rtl`. Neither the passing simulated-DOM tests nor this compatibility conclusion closes that native failure.
