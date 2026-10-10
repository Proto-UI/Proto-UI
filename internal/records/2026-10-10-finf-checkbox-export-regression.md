# Finf Brutalist Checkbox export-test reconciliation

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Diagnosis

At PR #872 source `c2cbb8d6fce71e949f84f0358189184783505989`, the Checkbox package test matched every export whose name includes `checkbox`, but expected only the four Checkbox Root/Indicator values. The separately implemented CheckboxGroup Root/Item/All package exports therefore made the old test fail (3 passed / 1 failed). This is an obsolete expected set, not a new runtime export drift: `src/checkbox/index.ts` still exports exactly the four admitted Checkbox values, while `src/checkbox-group/index.ts` exports its three separate composition identities. The package manifest declares both subpaths. The separate composition implementation is recorded in `2026-10-10-finf-form-composition-source.md` and `2026-10-10-finf-form-action-quality.md`.

## Repair and negative boundaries

The test now asserts the exact seven-value package set and, separately, each subpath's complete key set and object identity. It neither removes the CheckboxGroup exports nor selects only known keys. Matching also examines each prototype identity, so an accidental alias without `checkbox` in its export name is detected.

Three negative controls add an unexpected Checkbox identity, an unexpected CheckboxGroup identity, and an unexpected alias of a known Checkbox identity. A real temporary mutation additionally exported the Root as `unexpectedAlias` from the actual package entry; the main exact-set assertion failed for that extra property. The mutation was removed afterward. No production export or other implementation changed.

## Validation and limits

Node 24.19.0, pnpm 10.32.1, Vitest 2.1.9, one worker, 2026-10-10 10:02 UTC:

- Baseline: 4 cases, 3 passed / 1 failed.
- Corrected test: 7 passed, including all three unexpected-export controls.
- Actual package-entry mutation: 6 passed / 1 failed for the unexpected alias.
- Source-entry runtime tests do not establish packed-package, trusted CI, full delivery or public publication success. No visual implementation changed in this slice.

## Type-check follow-up

A workspace check found TS7053 in the new namespace-key assertion: type-only exports also appear in `keyof typeof` and are not runtime keys. The identity assertion now uses `new Map(Object.entries(BrutalistPackage)).get(name)`, preserving the same exact runtime check without a type assertion. After linking the already-installed declared Floating UI dependency and generating this worktree's website style artifacts, `check:types:workspace` completed successfully. No dependency manifest or lockfile changed.
