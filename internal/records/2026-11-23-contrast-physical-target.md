# Contrast pointer audit: preserve the physical target type

The integrated workspace type check passed after the formal Website style generation. The next, unchanged `check:types:docs` command exposed four related errors in `apps/www/scripts/audit-brutalist-contrast.mts`: `dropdownPointerIdentity` accepted `Locator | ElementHandle`, whose overloaded `evaluate` signatures have no common callable signature. Contextual typing consequently failed for the callback and its typed element query. The same full log also contains the separate image reading viewport projection error; this change does not claim to fix that error or complete the full docs gate.

Both actual callers already acquire one physical `ElementHandle` before the before/after identity observations, retain that handle through the native AX read, and dispose it afterwards. The function now declares precisely `ElementHandle<HTMLElement | SVGElement>`. No runtime statement, identity predicate, native input, popup ownership check, AX assertion or disposal behavior changes. It adds no type assertion or suppression.

Validation retained in `evidence/2026-11-23-contrast-physical-target/`:

- The real TypeScript compiler, using the existing Website configuration and the exact function source, reports the original four diagnostics when the original parameter declaration is restored in memory, and no diagnostics for this file with the physical-handle declaration.
- All 77 existing `contrast-audit-plan.test.mjs` checks pass, with zero skips.
- The complete original Website diagnostics are retained. Full docs type validation must still run after the separately owned projection repair.
