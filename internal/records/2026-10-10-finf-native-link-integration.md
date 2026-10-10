# Native Link consumer integration

This independent source increment follows the frozen third Finf batch. It is not part of that batch's source proof.

- Shared source `0e2d0c78df063d856d9a61c43c1dae167af4616f` and consumer source `84865e2a` are integrated without rewriting their source records or authors.
- Base now explicitly depends on `@proto.ui/module-native-link`. Its lock importer uses only the existing `workspace:*` / relative workspace-link form; registry snapshots, integrity fields and resolved package versions are unchanged.
- Combined owning Module, four Web Adapter and NavigationMenu consumer checks passed 57/57 across nine files. The eight actual navigation consumer cases include the formerly missing `aria-current` assertion. Native anchor default handling, modifiers and read-only observation remain owned by the browser seam.
- The first lock-only check failed because pnpm attempted its absent default store under `/home/agent`. Repeating with the repository's existing configured workspace store passed frozen/offline lock-only validation across 61 projects. This is not a full clean installation or new download.
- Source screenshots, full browser default-navigation acceptance, Compiler/native/GPUI support, Shadow-split support, catalog lifecycle admission and full Finf acceptance remain pending.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
