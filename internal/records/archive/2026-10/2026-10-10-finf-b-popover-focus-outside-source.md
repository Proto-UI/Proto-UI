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

## 2026-11-04 navigation observation composition and loader evidence

The original author's concurrent `7ddbb7953729ee93eaa961ebd26c6d940b054a9b` was preserved by normal merge, not overwritten by the earlier prepared navigation branch. Its original saturated-page gesture remains a named control, not proof of downward containment. Only after the original Tab/outside-focus/Escape/resize/outside-pointer journey does a separate companion measure real page headroom, prepare a bounded visible-Trigger position, require signed panel wheel progress and retain a passive trajectory with a trusted positive wheel event. The 32-case native/fault-control matrix remains unrun here. Independent source review found no defect in the three-file author increment.

The first combined evidence/headroom unit command reported **42 passed, four 5-second loader timeouts**. An isolated pre-increment worktree at `f9911f3a4ce5179c37f1d0444103bbe343589e46`, using the same installed workspace dependencies, passed the unchanged evidence file **20/20**; its first pre-collection attempt lacked the Astro dependency link and is not a behavioral baseline. Isolating the current evidence file still produced **17 passed, three loader timeouts**, so these failures were not labeled inherited main debt.

The test setup now compiles the real prototype-loader/renderer/Adapter modules in a bounded 30-second setup hook, without loading prototypes or retaining instances. The missing-Root case still resets modules and omits that Root; every consumer assertion and its original 5-second deadline remains unchanged. With this changed setup, both existing files passed **46/46**, including the genuine missing-registration rejection and successful real WC consumers. This is controlled runtime/loader evidence, not measured native navigation geometry. Logs are retained at `/tmp/release03-navigation-evidence-warm-20261104-{stdout,stderr}.log`; the failed and pre-increment runs remain separately retained. The earlier complete-family Popover Title 5-second timeout, also observed on pure main, remains separate debt.

The incidental workflow-source test (fixed budgets, copied YAML fields and browser-source strings) was subsequently removed rather than repinned. The real browser inventory rejection cases and all consumer assertions remain; the final two-file run passed **45/45**, retained under `/tmp/release03-navigation-evidence-final-20261104-{stdout,stderr}.log`.
