# Finf main integration and inventory recovery

This bounded recovery continues PR #872 from `c0f83b30f613e6dafd6ae2e7a83589ca3427f6d2` and normally merges main `169407b2d463d5da5d6694e2d1f8644578046b40`. It neither promotes draft entities nor closes any of the 68 full-delivery obligations.

## Main integration

Main's #876 adds a narrow optional `shadowViewTarget` argument to the Web Component session. Finf already has the complete `ShadowInnerSurface` argument and uses it in the commit path. A normal automatic merge retains both declarations, so TypeScript rejects the result with two TS2300 duplicate-identifier diagnostics and TS2717 incompatible subsequent declaration. The repair retains the complete existing type and commit behavior, removing only the redundant incoming declaration and unused destructuring. The resulting session bytes are identical to the pre-merge Finf implementation. Merge commit `54d429e8afb492b9a0dfc8b29ea40d557ba0fe56` retains both real parents; no history is rewritten.

## Inventory and proof recovery

The Website ledger already inventories the reviewed Shadow S1–S5 authored demo controllers, their draft prototype chain and blocked consumer ownership. Its portfolio mirror was stale in Path, Proto UI chain, Lifecycle and Evidence. Re-project those four fields from the existing source ledger without changing its state, owners or boundary.

The candidate's stored prototype-source proof still described `31ec14c63a661b45cd12937cdca47e9a6d4c91ce`, whereas later published Finf commits changed Dialog content and added its tests. Refresh with `refreshCandidateSource` against the actual published source commit `c0f83b30f613e6dafd6ae2e7a83589ca3427f6d2`: the helper verifies current bytes against that exact Git object before capturing hashes and Merkle proof. This proof covers the six prototype source/test packages and inventory paths, not the entire integrated repository. Their bytes are unchanged by the main type reconciliation. The fixed historical main comparison snapshot remains `25c3d0731e39003d87f541afc5e1a294a9d95568`; it is not relabeled as current main. Regenerate the Markdown with the existing generator. No test, scanner, denominator or acceptance predicate is relaxed.

## Verification

Environment: Node 24.19.0, pnpm 10.32.1. Commands run on the recovered merged worktree.

- Negative control: restoring the exact automatic-merge session source and running `check:types:workspace` fails with the three expected type diagnostics; restore the complete type and the workspace check passes.
- Shadow reconciliation, split Runtime and text-control suites: 3 files, 17 tests passed. These controlled-DOM checks retain optical view leases, stable owner surface, native editor rendering and cleanup; they do not claim browser paint.
- `node scripts/coverage-matrices/check-coverage-matrices.mjs`: both consumer matrices pass.
- `node scripts/coverage-matrices/prototype-coverage.mjs --write`: 71 comparison rows, 22 Base projection rows, 141 consumer rows and 101 migrated links verify.
- Prototype coverage negative controls: 61/61 pass, including stale-object, byte-hash, missing binding, offline Merkle and invalid admission rejection.
- Public packages: 45/45 build through the canonical builder.
- Astro type check: 578 files, zero errors, zero warnings and seven existing hints. The first aggregate attempt stopped at Astro telemetry configuration because the default `/home/agent/.config/astro` parent did not exist. Retrying with a writable `XDG_CONFIG_HOME` and `ASTRO_TELEMETRY_DISABLED=1` fixes environment setup without changing source or checks.

- Complete coverage suite: 2,792 passed, zero failed and one explicitly skipped Linux media integration sentinel (2,793 collected). The separate Linux CI media command is not claimed here.
- Canonical aggregate `check:types` rerun with the corrected configuration environment exits zero: workspace TypeScript plus Astro 578 files, zero errors/warnings and seven hints.
- `test:public-docs`: 350 passed, zero failed and 20 existing conditional MDX cases skipped (370 collected). These skips are not counted as coverage.

Fresh native input/visual evidence, trusted exact-head CI and independent acceptance remain separate; old failed CI is not retroactively green. This integration creates no new UI appearance and attaches no old screenshot as current evidence.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
