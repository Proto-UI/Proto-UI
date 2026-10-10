# ContextMenu host-local input origin, source runtime

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and decision

Add the shared source-runtime seam needed by ContextMenu. `asContextMenuInput` uses the existing Positioning module and current-instance Anatomy ownership. Its accepted intent has categorical origin and a revocable opaque anchor. No pointer coordinates, native event, or contact ID enters props, State, or Context JSON. ContextMenu's own consumer integration remains a separate change.

`overlay.registerInputAnchor` selects positioning only. Existing anchor-part registration still owns boundary membership and focus restoration. Web hosts resolve the association as a zero-area point with trigger contextElement or as the trigger element for keyboard input, retaining Floating UI collision/Portal behavior. Invalidated associations cannot publish late geometry or size.

The shared host recognizes context-menu, Menu/Shift+F10, and a 600ms touch/pen hold with 10px host-local move tolerance. Pending work cancels on move, release, second contact, cancel, scroll, blur/hidden, disable, detach, and unmount. It reuses Runtime.delay, including its cancellation and callback scope. It does not capture pointers or change touch-action. Accepted holds consume one native compatibility menu and pointer click; next contact and post-release expiry clear suppression. Rejected intents retain the previous accepted anchor.

## Evidence and earlier failures

- Node 24 and Corepack pnpm 10.32.1; normal prepare/Husky hooks retained.
- Focused command: `pnpm exec vitest run packages/modules/positioning/test packages/adapters/*/test/context-menu-input.integration.test.ts packages/adapters/*/test/positioning.integration.test.ts packages/runtime/test/contract/overlay.v0.contract.test.ts`.
- Result: 17 test files, 75 tests passed, including all four Web adapter routes, real runtime delay callback delivery, real Floating UI computation against simulated DOM rects, and revoked-anchor stale-computation rejection.
- Workspace type check passed after linking the existing app dependencies and generating the existing ignored style projection. The initial check lacked those local inputs; its missing-module/generated-style failure is preserved as setup evidence rather than described as a source pass.
- Initial new fixtures omitted a required root anatomy role and then omitted isPrimary on synthetic touch events. They failed correctly; fixture repairs produced the passing suite without weakening input recognition.
- `pnpm install --frozen-lockfile --lockfile-only --offline --ignore-scripts --store-dir /tmp/finf-context-pnpm-store` passed (all 60 workspace projects). This validates the lock only, not a full dependency installation. Unrelated importer ordering emitted by pnpm was excluded; only its Positioning importer change is retained.
- `check:prototype-catalog` failed on pre-existing uncataloged Finf prototype debt (including shadcn slider/toast/toolbar/tree/virtual-list); no prototype/catalog inventory was changed by this slice.
- Compiler/native admission remains rejected. Synthetic adapter events do not provide native GUI pointer, OS context-menu, touch, pen, or collision screenshots.

## Remaining integration

- Connect actual ContextMenu consumer to the hook and positioning association.
- Preserve its opaque anchor in capability-owned private storage; Context JSON may notify association changes with a serializable version only.
- The Positioning workspace lock importer includes `@proto.ui/module-anatomy: workspace:*` (`link:../anatomy`). Earlier general offline resolution attempts failed because cached @types/react and @floating-ui/dom metadata was unavailable. A bounded importer-only synchronization was then explicitly authorized; frozen offline lock-only validation passed, and only its resulting Positioning importer was retained. Registry snapshots, integrity fields, and resolved versions remain unchanged.
- Native evidence, compiler lowering, integrated package measurements, and independent acceptance remain separate work. No publish, push, PR comment, merge, or native GUI claim is part of this local change.
