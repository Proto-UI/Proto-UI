# Finf collection initialization and activation guard reconstruction

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.

This is a new reconstruction over `d2d3ea63c485fbfe4a4a794dc797e28cf665db80`, not a recovery of the missing historical patch or its test results.

## Definition and ownership

- `P-BASE-BUTTON` is draft. `P-BASE-BUTTON-DISABLED-SUPPRESS-ACTIVATION` forbids activation while disabled. Message Scroller Jump explicitly inherits Button props/exposes and composes `asButton`; its additional `press.commit` handler must consult that same current disabled state. A synchronous exposed click listener can disable the component before the additional handler executes.
- Toolbar has no dedicated catalog entity. Its existing draft public definition at `apps/www/src/content/docs/en/ui-libraries/base/toolbar.mdx` specifies a cross-axis Separator. `C-CONTEXT-0006`, `C-CONTEXT-0007`, `C-CONTEXT-0008` and `C-LIFECYCLE-0001` are draft supporting contracts: setup subscription intent and runtime current-context reads are separate from value-change delivery.
- These are Prototype responsibilities. Compiler/IR, Runtime, Adapter implementations and host capabilities are unchanged. The implementation uses borrowed Button State and Context/lifecycle APIs, with no DOM lookup or host-specific command path.

## Fresh reproduction and repair

`packages/prototypes/base/test/collection-initialization-guards.test.ts` supplies five new cases. Before either production fix, four failed for the intended reason: initial vertical Toolbar and late Separator insertion incorrectly projected vertical orientation, disabled Jump issued one command, and synchronous click-signal disabling still issued one command. The horizontal Toolbar control passed.

Message Scroller Jump now reads `asButton().stateHandles.disabled` before calling the viewport command. Toolbar Separator reads its current Context at created and mounted and retains the value-update subscription.

The command fixture uses the real WC Adapter, Runtime, Button and Jump, but substitutes a minimal anatomy viewport command recipient to count command requests. This proves semantic suppression, not physical scrolling. Separator assertions inspect WC accessibility attributes in happy-dom, not browser pixels.

During reconstruction, a missing external dependency link prevented initial test collection; repairing only this worktree's dependency links allowed the actual red run. A first local guard attempt used the incorrect `state.disabled` handle path and failed three tests; changing it to the public `stateHandles.disabled` path resolved that mistake. Neither failed attempt is represented as a pass.

## Validation and limits

- Node v24.19.0, Vitest 2.1.9, one worker. The five new cases plus existing `message-scroller.test.ts` and `navigation-overlays/controls.test.ts`: 18/18 passed.
- Focused TypeScript no-emit check of both source subtrees and the new test passed. Formatting and diff-whitespace checks passed.
- Test execution used the installed repository Vitest directly. Corepack's initial default cache setup failed in this environment; no new dependency version was fetched. The runner warns about an unavailable Astro base config, which did not prevent these test collections.
- Retained cross-root movement without a new mount or Context update remains a distinct unresolved derived-orientation lifecycle debt. This change does not claim to fix it.
- Real-browser screenshots, native/GPUI, Compiler composition, packed-consumer, exact-head aggregate CI and independent acceptance are separate outstanding evidence. No Finf completion count or lifecycle admission is advanced.
