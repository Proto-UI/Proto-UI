# Liquid Glass main-command tint, 2026-10-15

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Goal, authority and exact baseline

At 09:25 UTC the bounded local direction was approved: revise Button prominent and Form Submit to use the existing finite `tint: 'style-fill'` candidate, while preserving Base ownership and readable fallback. This record describes local work through 09:47 UTC. No commit, push, remote comment or browser launch is claimed.

The dependency is the unpublished tree `7bfd70801eff93a6887517bfce64270418e31245`, not worktree HEAD `a62ba0ba9a04498c7050cbe6707c9b13525c9851`. The earlier eight-command hover/Form dependency remains separately owned. All reported diffs and control runs use the exact dependency tree. Existing dated records, including the earlier solid-prominent design, remain unchanged.

Before production edits, revise draft `P-LIQUID-GLASS-BUTTON` and its tests, reconcile the solid-prominent sentence in `C-LIQUID-GLASS-COMMAND-INTERACTION-0001`, and add coherent `C/T-LIQUID-GLASS-MAIN-COMMAND-TINT-0001`. These remain draft. Form completion semantics stay with the existing Base Form definition; no inventory-only Form P entity is created.

The official [WWDC25/219 tint discussion at 17:03](https://developer.apple.com/videos/play/wwdc2025/219/?time=1023), retrieved on 2026-10-15, motivates selective main-action tint that remains related to background content. [Buttons HIG](https://developer.apple.com/design/human-interface-guidelines/buttons) informs prominence through style rather than a size change. This is an explicit change to Proto's draft direction, not evidence of Apple shader, animation, pixel or cross-platform equivalence.

## Actual implementation

- Button's existing complete material rule is specialized by regular/prominent and rest/pressed. Regular preserves the exact untinted shape; prominent includes `tint: 'style-fill'`. The mutually exclusive rules produce at most one candidate.
- Form Submit adds that same finite field to both existing complete candidates. Form Reset source is unchanged and remains the neutral command reference.
- Both use their existing primary fill/foreground pair as tint input and complete fallback. Disabled and opaque still contribute zero candidates. Source, provenance, tint-capability and preference gates remain unchanged.
- `asButton()` and `asFormSubmit()` remain the sole existing owners. Submit returns inherited render; no extra Button owner, listeners, state mutation or direct Form request is introduced. No new public prop, token, color, geometry, Core, Runtime, Compiler, IR or host change belongs to this slice.
- README now describes eligible prominent tint and contact, preserving explicit disabled/opaque fallback. The source API's use is not a resolution of the previously observed flat small-control dark appearance.

## Old assertion to new assertion mapping

1. `material.test.ts` previously grouped `{ material: 'opaque' }` and `{ variant: 'prominent' }` as zero candidates. Explicit opaque remains zero for both variants; enabled auto prominent now requires exactly one whole regular candidate with style-fill tint and exact rest/pressed contact data. The previous primary fallback assertion is retained and expanded to primary foreground.
2. The former ordinary no-provider secondary-only assertion now runs regular and prominent, requiring each exact complete source-owned palette. No-provider behavior is not claimed to prove an unsupported tint provider's actual paint.
3. The former regular disabled/remount assertion remains and now also runs prominent, including disable while pressed and enabled pressed unmount/remount. Both require fresh rest phase and preserved current variant.
4. `interactive-surface.test.ts` previously required prominent `[]` after raw material removal. Only that obsolete expectation becomes the exact complete tinted rest candidate. The same primary pair, hover, focus, source guard and other seven command assertions remain.
5. `form-actions-material.test.ts` previously required the same exact untinted rest candidate for Submit and Reset. Submit now requires tint, Reset retains the old exact neutral candidate. Both now assert exact full candidates through up/leave/cancel/press-cancel, direct/inherited disable, actual raw material removal and pressed unmount/remount. Whole-control opacity remains forbidden.
6. Button's original inherited-hook presence check is strengthened to exactly one `as-button`. Default removal still restores the secondary palette and now rejects stale primary fill. The unchanged real Form action suite retains its one-request activation, keyboard, disabled and remount checks.

## Verification and preserved failures

Toolchain: Node 24.19.0, Corepack pnpm 10.32.1, Vitest 2.1.9. These are portable/synthetic-DOM tests, not browser or GPU evidence. Commands use `--maxWorkers=1 --minWorkers=1`.

- Before production edits, the four changed suites produced 5 intended failures and 50 passes: prominent still had no candidate and Submit lacked tint. The recorded errors are assertion mismatches, not startup/import failures.
- After production edits, the same four suites pass all 55 tests: material 9, Button 3, shared interaction 39, Form material 4. This includes actual style collection/lowering and physical token closure in the existing suites.
- The entire unchanged `form-actions-quality.test.ts` reports 9 passing Form cases and 4 failing Checkbox Group token-closure cases. An independent full source archive of dependency tree `7bfd70801eff93a6887517bfce64270418e31245`, using the same existing dependencies and exact command, reproduces the same 4 failures and 9 passes. The failures remain visible and the catalog implementation is not labeled a full-file pass.
- Prototype inheritance schema, workspace relations and lifecycle readiness: 97 tests pass across 3 suites. The final combined rerun passes all 152 tests across the 7 directly relevant suites.
- Exact-tree lifecycle authoring passes. The stock command accepts only a commit, so a disposable copy uses the unchanged schema/graph/lifecycle algorithm with a fixed worktree root and argument, changing only Git revision verification from commit to tree. No repository validator is changed. Initial execution lacked the existing Zod package link; after linking only the already-installed schema dependencies, the same check passes. Both logs are retained.
- Prototype catalog: dependency and candidate both fail with 536 existing issues; complete output is byte-identical. No catalog debt is removed or hidden.

The coordinator owns official preset regeneration/check and broader type verification. New native fixture/ROI work is separately owned and remains planned for exact-source evidence. No browser retry was made after the existing launch denial. No earlier Toggle or opaque Button image is reused as new main-command tint evidence.

The local evidence bundle `prominent-tint-evidence-20261015` retains `projection-red.log`, `projection-green.log`, `projection-expanded-first.log`, `projection-quality-baseline.log`, `projection-quality-candidate.log`, `projection-schema.log`, `projection-final-local.log`, `projection-authoring-final.log`, `projection-authoring.log`, `projection-authoring-retry.log`, and both `projection-catalog-*.log`. The final explicit-file manifest and patch bind the candidate separately from the unpublished dependency and fixture worker's files.

## Remaining work and next owner

Evidence disposition is partial: no new native captures or uploads, no independent visual acceptance, and remote writes remain paused. The exact-source fixture must establish meaningful background response in interior content regions, readable foreground, neutral/tinted/opaque controls, real text/icon-only dimensions, press recovery and preference exits. Form Reset is a neutral family reference with its own semantics and dimensions, not a strict tint-only pixel clone of Submit. Weak neutral source signal is inconclusive. Independent actual-size review must still decide whether typical dark backgrounds look like glass.

The coordinator combines the separately owned fixture, completes generated/type checks and obtains independent review. Any later publisher must revalidate live permission, exact dependency/candidate and native evidence rather than treating this local record as publication or acceptance authority.
