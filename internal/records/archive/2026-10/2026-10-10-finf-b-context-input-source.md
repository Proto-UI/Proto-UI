# Finf B: ContextMenu input-origin consumer

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

2026-10-10 UTC. Follow-up source implementation, not Finf acceptance.

## Delivered

- Trigger consumes `asContextMenuInput`: pointer-origin context menu, keyboard ContextMenu/Shift+F10, touch/pen held contact, shared cancellation and compatibility suppression. Removed the previous portable context.menu/keydown open handlers to avoid duplicate requests.
- Root privately retains the opaque `InputOriginAnchor`; JSON context carries only an incrementing association version. Content uses the existing anatomy expose-method bridge and `overlay.registerInputAnchor` before open/positioning. The token is not in props, state or JSON context and contains no coordinates or DOM access.
- Actual close and disabled policy clear the association. A controlled refused close keeps the current owner-open anchor; a controlled delayed acceptance can use the latest live accepted input. Repeated input changes both position and menu entry intent. Programmatic `openContextMenu` uses the trigger fallback.
- Corrected the Root's formerly mismatched method name: `useOpenState` defaulted to `openDropdown` despite ContextMenu's public `openContextMenu` type. The source now explicitly configures its own method name and tests it.
- Default positioning is bottom/start with zero gap. Original trigger anatomy remains the boundary/focus restore subject. Source-runtimes for all four styles directly reuse these hooks; five DemoSpecs and ten docs now demonstrate/describe touch/pen and pointer-location behavior.

## Verification

Shared prerequisite: `6e90ae6a7cd25a840fe01abcd834809fd3678e35`, provided by the shared host owner and cherry-picked cleanly. Do not duplicate that dependency when integrating this consumer commit.

Pinned offline pnpm 10.32.1:

- Focused 15 menu-family source directories TypeScript check passed.
- `context-menu-input.test.ts`: 5/5 real WC source-runtime tests passed. Actual positioning output is asserted at pointer (50px,60px), subsequent keyboard trigger fallback (10px,80px), repeated point changes and delayed controlled acceptance. Tests cover long-press timing, duplicate compatibility click, movement/disabled/disposal cancellation and balanced instance disposal.
- `menus.test.ts`: prior 7/7 passed.
- Ordinary unresolved Astro base tsconfig warning remains, not silenced.

No new prototype IDs or package subpaths. Integration manifest lists unchanged real exports, demos and docs. Nested submenus, native/GPUI/compiler implementation, actual device/browser visual receipts, packed consumers, complete CI and independent lifecycle admission remain open. The shared dependency retains negative compiler/native admission for unsupported input semantics; source-runtime tests do not override it.
