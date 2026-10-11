# Finf B Root capture contracts

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

2026-10-10 UTC. Narrow type/runtime capture alignment, not final acceptance.

Popover, Alert Dialog, Drawer and Context Menu declared an owned Root `open` handle even though the authored `useOpenState` child owns it. Their contracts now describe the actual `asHooks.useOpenState` handle using the helper's real return type. There is no copied state or flattened runtime artifact. Consumers read `result.getAsHookHandle?.('useOpenState')?.getState?.('open')`. Context Menu also genuinely captures `collectionCount`; its own state contract now reflects that field.

A real WC consumer calls each AsHook, captures its child, observes borrowed state, refuses a controlled close and later applies false/true owner updates. Four tests pass. The test verifies actual child identity and exact Root-owned state keys. Compile-time negative controls reject the incorrect Popover `stateHandles.open` and Root `getState('open')` paths. Focused TypeScript includes the test itself and passes. Shared installed positioning dependencies were reused locally, with no downloads or manifest changes.

The first runtime test incorrectly assumed Context Menu captured no owned state; its observed `collectionCount` was retained and the test/contract corrected rather than hiding it. A heterogeneous callback overload lost child typing in the first test compilation; using the actual shared helper return type resolves that accurately.

Limited inventory: the four named B Roots are affected; the other eight B feature roots do not use `useOpenState`. Existing Dialog and Dropdown Roots have the same inaccurate open-state declaration. Dialog is outside this narrow owned slice and is reported to integration; Dropdown is tracked for the next explicitly authorized quality slice. No public prototype identities or runtime behavior change here, and no shared registry change is needed. Date Picker's nested-child capture path remains valid.

Source-runtime capture evidence is separate from full adapter/native/compiler/packed/visual/independent acceptance. Ordinary Astro base-config warning remains visible.
