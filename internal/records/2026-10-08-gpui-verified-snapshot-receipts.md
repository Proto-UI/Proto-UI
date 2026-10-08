# GPUI verified-row snapshot receipts

Date: 2026-10-08. Non-normative implementation/evidence record for [Finf #872 review r4217415370](https://github.com/Proto-UI/Proto-UI/pull/872#discussion_r4217415370).

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Reproduction and scope

Source baseline: `06d6ff33ba29fe57dcc3b62f236d021c961a868b`. Its unmodified portfolio passed `validate()`. In four separate in-memory mutations, a `verified` row in main or candidate still passed with either an arbitrary old implementation revision (`aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`) or no native evidence. No delivery item was checked. The actual validator, historical main proof and candidate source bindings were retained for these controls.

The row gate passed `undefined` to `hasGpuiImplementation`, disabling revision equality. Native receipts were required only when a delivery item was complete. Native implementation paths were checked against current file existence, without binding those paths to the claimed Git snapshot.

The initial regression run preserved 34 controls against the old validation behavior: 6 positive controls passed and 28 rejection controls failed at their expected assertions. This was the reproduced validation hole, not an import or setup failure. The only behavior-neutral source preparation for that red run exported the existing proof-capture helper.

## Bounded repair

- Bind every `verified` row's implementation receipts to `sourceSnapshot(data).revision`, even while delivery remains incomplete.
- Require a passing, same-revision HTTPS-linked native receipt at the row gate; reuse that predicate at the existing completion gate.
- Require each implementation receipt's separate `sourceObjectProof`, using the existing content-addressed Git commit/tree proof representation. Each mapped identity still requires its own matching receipt, allowed native source paths and no blockers.
- Reuse the proof verifier to resolve regular native blobs from the exact snapshot. For a candidate, additionally compare current source bytes and reject missing files or symlinked path components. Historical main uses its own proven blob identity rather than current native bytes.
- Keep validation independent of Git availability. Proof capture needs source objects; verification needs only the portable proof and, for candidate native paths, current bytes. The retained Prototype inventory proof's scope and checked-in data are unchanged.

The source proof confirms source identity/presence. It cannot infer semantic implementation or authenticate the linked native run. Independent examination of actual native input/layout/accessibility and family evidence remains necessary. Test receipt links use `example.invalid` and are explicitly shape-only fixtures; none are written into the portfolio.

## Compatibility and verification

`verified` records without the new source proof or native receipt now fail closed. No currently checked-in row is `verified`, so no production receipt was migrated or invented. All 68 plan items remain unchecked. Main retains 220 required GPUI rows; candidate retains 280. Both retain zero verified rows. Complete GPUI parity and all four design-family obligations remain unchanged.

The acceptance-shape test helper now uses the real retained main revision, with a proof of its native source, instead of an invented all-`a` revision. The 5.3 KB real proof is retained solely in `scripts/coverage-matrices/test/fixtures/gpui-main-source-proof.json`; tests must not need the old main object during setup in depth-1 CI. Candidate controls capture their commit/tree proof from the current HEAD instead of a historical candidate. Native/independent-review receipts remain explicitly synthetic; this fixes the fixture premise rather than claiming real acceptance.

Validation completed before the final freeze:

- Initial focused red run: 34 controls, 6 passed and 28 failed for the reproduced omissions.
- First complete prototype suite: 95/95 passed.
- Expanded focused regression suite: 43/43 passed, including main, candidate commit, candidate tree, stale/missing/malformed native evidence, absent/tampered/wrong-object/unproven native proofs, changed native bytes, missing files, symlinked parents, and main's independence from current native bytes.
- Each of main, candidate commit and candidate tree has a successful portable-proof control with `PATH` empty and a distinct lexical repository root. These validation runs cannot invoke Git or use cached historical Git readers.
- Complete prototype suite after expanding the controls: 104/104 passed.
- `node scripts/coverage-matrices/prototype-coverage.mjs --check`: passed with the generated views unchanged (71 comparison rows, 22 Base projection rows, 141 consumer rows, 101 migrated links).
- `node scripts/coverage-matrices/check-coverage-matrices.mjs`: passed, 2 matrices.
- `git diff --check`: passed.
- Final portable-fixture suite in an isolated depth-1 checkout: 104/104 passed. The checkout had exactly one reachable commit, no alternates and no historical main commit. Validator, test and fixture file SHA-256 values matched the development worktree byte-for-byte.

Node was `v24.19.0`. The first Corepack invocation failed because its default cache parent was absent; no dependencies or toolchains were installed. The repository's Node entry points and existing shared dependencies were used instead. Browser, native GPUI execution, full repository builds/types, trusted CI and independent acceptance were not claimed by this local validator repair.

This local packet does not publish a commit, update a remote ref, resolve the review thread or grant independent approval. Integrated aggregate checks, trusted exact-head CI/DCO and independent review remain later gates. No browser screenshots are applicable to this validator-only change; the evidence is the executed rejection/acceptance controls and source-bound walkthrough above.
