# Finf B: Popover focus-outside consumer

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

2026-10-10 UTC. Source increment, not Finf acceptance.

## Delivered behavior

- Popover Content observes shared `Boundary.observe('focus.move')` beside the existing pointer observation. Outside focus enters the same Root request channel, with `reason: 'focus.outside'`, after open/mounted/alert checks. Overlay automatic focus dismissal stays disabled, so a controlled owner can refuse the request without an intermediate Overlay/Presence close or focus restoration.
- The shared boundary owns actual focus validation, trigger/content/portal classification, stack arbitration and pointer-default-focus deduplication. The prototype neither reads DOM focus nor listens to host events. Focus-only requests use `focusReason: 'programmatic'`: the neutral observation does not prove keyboard or pointer origin.
- Uncontrolled or owner-accepted focus-outside dismissal leaves the destination control focused. Trigger and portalled children remain inside. Refusing a request leaves the content present and outside focus usable; a fresh later interaction can request again.
- Base semantics propagate through all four style hooks. Five existing real DemoSpecs add a real family Button outside the Popover. Ten bilingual pages explain focus dismissal and controlled refusal.

## Integration

Shared Boundary focus observation prerequisite is `3858dc594f80e7c43f5944dcc922781564769c13`, cleanly cherry-picked as `be78f8e9` for local verification. Details are recorded in the adjacent integration manifest. No new prototype identities, exports, package dependencies, CLI entries or DemoSpec IDs are introduced by this consumer. Shared capability/contract updates remain with the shared owner. Earlier Popover records describing the missing focus-exit seam are superseded by this delivered consumer only when combined with the shared prerequisite.

## Evidence and limits

- Before the shared capability was applied, the first focused suite ran on this older shared base: 8 failed, 1 passed. Failures showed absent outside-focus close/requests, while Alert Dialog retained protection. The failing assertions were retained, and a synchronous controlled-acceptance case was subsequently added.
- With the shared prerequisite applied, all 10 new focus-outside tests and the 10 existing overlay-window regressions pass (20/20). They cover all five prototype families, portalled children and Trigger, uncontrolled close, controlled refusal and repeated requests, synchronous and delayed owner acceptance, pointer-default deduplication, stale synthetic focusin rejection, content detach/reconnect, and Alert Dialog protection. Lifecycle diagnostics require every created instance to be disposed.
- Pinned offline pnpm 10.32.1 focused TypeScript validation passes across the 15 owned overlay source directories and their imported dependencies. `git diff --check` passes.
- Ordinary unresolved Astro base-tsconfig warning and the existing initial Alert Dialog description-registration warning remain visible; neither was suppressed.
- Tests dispatch Tab and perform the resulting actual focus movement in Happy DOM, which does not implement browser sequential Tab navigation. They are source-runtime evidence, not a real-browser keyboard or visual receipt.

Full native/GPUI, compiler projection, packed consumers, real-input browser/visual evidence, complete CI, catalog lifecycle and independent acceptance remain open. No Finf checkbox or acceptance status is changed.
