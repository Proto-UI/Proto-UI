# Finf Input draft reference migration for independent review

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Why this is a definition change

The user-directed Finf source comparison selects Shadcn base-nova. The existing draft Input instead explicitly required new-york revision `f31ed81983653919dd4fe77aee4b4859f610f1dc`, including 36px height, rounded-md, 12px horizontal padding and shadow-xs. Replacing these tokens only in implementation would violate that draft. This independently reviewable P/T-only migration comes before implementation and changes no Base, Contract, Compiler, CLI, public props or lifecycle status.

## Exact source and bounded decision

Official registry: <https://ui.shadcn.com/r/styles/base-nova/input.json>, retrieved 2026-10-10. The registry identifies `registry/base-nova/ui/input.tsx`.

- Registry SHA256: `bbad1bba130ac9750a61844eeb8f043e8a710846e07689fa85398b80a46c2741`
- Extracted TSX SHA256: `dab990dfefa0ba78854ab6602ad074270dba9d7d1262184d9bfbb62bd990903b`
- No upstream Git SHA was supplied by that registry response. The comparison is pinned to those exact saved bytes; the live URL may change.
- License remains shadcn/ui MIT, retained in the package's `THIRD_PARTY_NOTICES.md`. Source was read statically, not installed or executed.

The source directly specifies h-8, rounded-lg, px-2.5, transition-colors and no shadow-xs. It also specifies disabled bg-input/50, dark bg-input/30 and dark-disabled bg-input/80. Existing focus-visible ring, disabled suppression, text color and single editor ownership remain intact.

The existing primary-palette selection extension is retained and correctly labeled: it does not appear in this base-nova Input recipe. Placeholder styling, md:text-sm, file controls, aria-invalid, className and data-slot remain explicit gaps or excluded API, because this slice must not expand Base semantics or author-style syntax. There is no assertion of full source/API parity.

## Evidence plan and review gate

The corresponding Test now requires positive base-nova geometry, negative assertions against the superseded recipe, and disabled/dark intersection precedence. Historical evidence is no longer represented as passing the new definition: affected implementations are marked planned pending the successor code and fresh execution. The browser case remains pending until its real output is collected. No old screenshots establish this new recipe, and no Full delivery checkbox is closed.

Independent review must confirm the bounded reference choice, preserved semantic ownership, exact source facts and honest pending status before implementation follows this definition.

## Pre-implementation review and catalog boundary

The coordinating independent reviewer read the exact P/T delta and record, recomputed both source hashes, and checked the source geometry and dark-disabled rules before allowing this bounded definition to precede implementation. This review does not establish a runtime or visual pass.

`node --import tsx scripts/spec/check-lifecycle-authoring.mjs --base 1e857b6e` passed after the three Git-tracked native test files referenced by the catalog were materialized from HEAD in this sparse worktree. The first pnpm script attempt was blocked by the tsx CLI IPC socket; the same check via the Node loader executed. `check:prototype-catalog` still reports 559 failures: prototype declarations in non-proto index files and uncataloged identities missing from the debt inventory. The baseline and candidate output are byte-identical. These repository-wide failures remain open and were not repaired or hidden by this slice.

## Successor implementation and executed evidence

After the definition review and commit `9c7d3968`, only the Input family recipe was changed: h-8 / rounded-lg / px-2.5 / transition-colors, no resting shadow, and the disabled/dark palette including the combined 80% rule. The previous Base protocol and explicit selection extension remain intact. Bilingual docs now state the snapshot and extensions correctly; the existing browser test's expected height was updated to 32px but that browser suite was not run here.

The six focused Input cases were first executed against the old recipe: 3 passed / 3 failed for the intended geometry/palette mismatch. After implementation, Base Input (6), Shadcn Input (6) and the existing CSS service suite (51) passed: 3 files / 63 tests. Added checks reject the former h-9/rounded-md/px-3/shadow recipe, run actual generated CSS from runtime-collected tokens, verify the combined dark-disabled selector and palette, and retain one physical editor over four disabled round trips. These are happy-dom/CSS-output observations, not browser-computed paint.

The official style generators regenerated `packages/cli/src/generated/shadcn-style-tokens.ts`; no CLI semantics changed. `check:styles:preset` passed for all three generated manifests. Only the module-test implementation status returns to passing. The browser implementation remains planned with fresh screenshots, four-Adapter pixels and all original Full delivery gates still outstanding.
