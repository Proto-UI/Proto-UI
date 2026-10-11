# Slider finite pointer interpolation

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

## Scope and definition boundary

This bounded numerical repair starts from `f090be10f48bf360600d53becd837f91b44c6aaf` and restores the existing Slider Track linear mapping from normalized axis position into the Root's finite range. It adds no public API, changes no quantization, geometry, ownership, Compiler/IR, shared Runtime or Adapter behavior, and does not admit a new prototype lifecycle.

`range()` in `packages/prototypes/base/src/progress/range.ts` supplies finite ordered endpoints. `packages/core/src/axis-input.ts` and `packages/modules/axis-input/README.md` describe the existing experimental dimensionless `[0,1]` position seam; the consumer owns domain values. Slider's independent catalog definition remains absent. `C-STATE-0006` is **draft** in this source, despite the earlier finite-range arithmetic record calling it active. Neither that historical wording nor these tests promotes it. This patch restores existing bounded interpolation intent rather than selecting new normative semantics.

## Reproduction and mathematics

The old `min + position * (max - min)` produces `NaN` at position zero and positive infinity elsewhere for `[-Number.MAX_VALUE, Number.MAX_VALUE]`. Root correctly rejects nonfinite requests, so the pointer cannot change the value or propose controlled updates.

The ordinary finite-span branch retains exactly the previous arithmetic. Only a nonfinite span uses `min * (1 - position) + max * position`. Given finite ordered endpoints and a position in `[0,1]`, span overflow requires opposite-sign endpoints. Each product remains finite and their opposite-sign sum cannot overflow. The interpolation reaches its endpoints before the unchanged Root quantizer. Tests intentionally retain the quantizer's existing precision normalization; they do not promise exact endpoint bits after quantization. Illegal host positions remain the responsibility of the existing AxisInput boundary; this patch adds no silent clamp or fallback for them.

## Evidence

- New 24-case suite: exact old Track source produces 18 failing / 6 passing cases; corrected Track passes all 24.
- Coverage: min/quarter/mid/three-quarter/max for extreme opposite endpoints with ordinary Thumb and properly Field-contained FieldThumb; asymmetric opposite endpoints in both orders; controlled rejection followed by owner acceptance for both thumb variants; ordinary fractional rounding, non-divisible endpoint, equal range, subnormal and existing negative-zero normalization.
- Nine focused files pass 99 tests, including numeric/family/Form composition and actual AxisInput Module/Web-host/Adapter suites.
- Range, Form and numeric-part public consumer TypeScript projects pass.
- Normal public package build for `@proto.ui/prototypes-base` passes all 14 dependency-closure packages.
- Full Base run: 85 passing / 1 failing files, 1,034 passing / 8 failing tests. The eight failing Form recipe assertions reproduce on the original Track source. Prototype-catalog output is byte-identical with the original and repaired Track; workspace-wide TypeScript is blocked by unresolved dependencies. A focused pass is not a full repository green.

## Failed attempts and limits

The first FieldThumb fixture lacked Field Root and failed on missing context. It was corrected to the supported composition before retaining the red control. Initial independent-worktree package checks lacked workspace dependency links, and two broad suites lacked the existing Astro installation; these were setup failures, not product regressions. After linking existing dependencies, the normal Base build and those two suites pass. No third-party source was downloaded or run for this repair.

The broader Form-actions-quality suite has eight recipe assertions failing unchanged on the original Track source. Prototype-catalog reports uncataloged debt already present on the base. Workspace-wide TypeScript reports unresolved dependencies in this isolated worktree. These remain failures/blockers, not waived or repaired by this numerical change.

Pointer evidence uses synthetic Web PointerEvents and a fixed geometry rectangle through the actual adapted prototype/module chain. It does not establish native device input, real layout/paint, full visual acceptance, Compiler coverage, all adapters or Finf completion. No screenshot is offered as evidence for this logic-only correction. Independent exact-tree review and publication remain pending.
