# Proto UI 0.3.0

> Draft release notes. This version has not been published. npm packages, the Git tag, GitHub release, dist-tag and immutable snapshot evidence remain separate release steps.

Proto UI 0.3.0 is the first stable release on the 0.3 line. All 47 public `@proto.ui/*` packages use this exact version. Stable `0.2.0` keeps its existing release identity.

## Published prototype scope

- The published prototype surface is limited to the families that already exist in Base, Shadcn, Brutalist and Lucide, together with the website and CLI surfaces built on them. Bootstrap and Liquid Glass material stays on the 0.4 line as WIP / Exp work and is not part of this release identity.
- Every published prototype keeps its current lifecycle status. This release identity governs package manifests, release assets and catalog references; it does not promote individual catalog entities to stable admission. The 0.3.0 lifecycle disposition records each draft entity explicitly instead of applying a blanket promotion.

## Change inventory relative to 0.3.0-alpha.2

- The 0.3.0-alpha.2 train prepared the Control Label definition and compiler repair candidate. Its 47-package candidate BOM, localized notes and spec snapshot remain the previous alpha record.
- The 0.3.0 candidate BOM names the same 47 public packages, all at `0.3.0`, and every one of them matches a current public package manifest.
- Four identities introduced on the 0.3 line still have no registry bootstrap: `@proto.ui/module-axis-input`, `@proto.ui/module-native-link`, `@proto.ui/module-control-label` and `@proto.ui/module-table-structure`. The registry holds no npm package under any of those four names, so each still needs its registry bootstrap and protected-workflow configuration before this release can be published. Preparing this version does not create those identities.
- The Sprint 2, Sprint 7 and release-convergence integration trains landed on `main` before this preparation: cross-file helper replay in the CLI coverage gate, the compiler publication-value rework with the merged view-aware data boundary, the website source-ownership and wheel evidence repair, and the Header scene isolation with its runtime process-ownership repair.

## Known issues and acceptance state

- The CLI lowered-hook-coverage gate is not yet green. The merged cross-file helper replay reduced the local failures from five to three; the whole-tree gate case and two helper-argument cases remain open and stay tracked as 0.3 acceptance debt.
- The mainline regression cycle at the 2026-11-24 08:00 UTC slot failed on inherited debt across the coverage-governance reconcile, type-check, compiler GPUI consumer, compiler library inventory, whole-entry package budget, general and governance test, several browser shards and two representative-features suites. A cycle on the post-merge main tip is the authoritative current red map; a red cycle does not block the merge of already reviewed slices but it does block stable publication.
- The coverage matrices and the GitHub governance snapshot are rebound to the current main candidate revision by this preparation; they remain a non-normative inventory and must not be cited as release acceptance evidence on their own.
- Bootstrap and Liquid Glass failures observed in the same cycles are scope-out for this release, not regressions of the 0.3 families.

## Version and lifecycle

The public package set remains globally exact. `@proto.ui/compiler` remains private tooling and is not added to the release BOM. The 0.3.0 lifecycle disposition records every known draft at this version: the reviewed 0.3 families are retained as draft with their outstanding activation evidence named, and the 0.4 families carry an explicit deferred disposition.

## Publication status

This preparation does not publish packages, create `v0.3.0`, move the npm `latest` tag or activate `V-PROTO-UI-0012`. Package-local installation examples describe the unpublished candidate; website availability statements continue to follow the last verified release. Publication requires the four missing registry identities, a complete rehearsal over the final reviewed package set, protected release from `main` and a separate immutable-evidence review.
