# Imported-row proof and independent hook usage reconciliation

Date: 2026-11-23. Scope: ten original imported-array negative fixtures in `packages/cli/test/lowered-hook-coverage.test.ts`.

## Decision and source boundary

Each fixture has two distinct rules in the same loop body. The direction rule compares a prototype-owned state with an unproven row. The Checkbox rule compares the independently resolved `asCheckboxRoot().stateHandles.checked` with literal `true`. Refusing the complete iterable does not invalidate that independent handle or literal comparison. The scanner already visits an unknown loop body once and reports this checked usage together with one unresolved comparison; the former total `usages=[]` oracle rejected the valid independent proof.

This repair changes only that oracle and adds real collector cross-checks on the same temporary source files. It does not change scanner or collector admission. Every negative fixture still requires exactly one `comparison` refusal. Proven imports, local aliases, spreads, empty arrays, lexical shadowing and invalid selector values retain their existing controls. The unfiltered shipped-tree scan, `blind=[]`, declaration-provenance and normalized-attribute checks, and 240,000 ms deadline are byte-identical to the base; that remaining whole-tree failure is not closed by this record.

The collector and scanner have different proof responsibilities. `prototype-style-tokens.ts` explicitly treats bound/imported arrays as a conservative token inventory while leaving unknown rows unknown. `lowered-hook-coverage.ts::foreignDeclarationRows` independently requires a const binding before certifying the entire iterable. `C-PROTOTYPE-STYLE-CLOSURE-0001-A` requires supported visual assets to be retained; it does not authorize erasing known inventory merely because another analysis withholds complete-row proof. The existing token-table regressions separately reject laundering an unknown value into an exact state or comparison.

Accordingly, the conditional-array fixture retains exactly the known `left` comparison token and rejects both conditional alternatives. The mutable `let` fixture contains no write: its two literal values remain in the inventory while the scanner still refuses complete-row certification. Neither observation claims a mutable binding is immutable, or admits a reassigned handle as a resolved hook state. A reachable-write violation would need its own product regression.

## Executed evidence

| Source / selection | Result | Meaning |
| --- | --- | --- |
| Original ten negative fixtures | 0 passed, 10 failed | Every old total-empty usage oracle rejected the independent checked condition. |
| First candidate with an additional blanket no-direction assertion | 8 passed, 2 failed | The new cross-check was too broad for a known conditional sibling and an unwritten mutable inventory. Both failures remain archived. |
| Reviewed final ten fixtures | 10 passed, 0 failed | Exact checked usage, original comparison refusal and source-appropriate collector assertions. |
| All 19 imported-row controls plus all 83 token-table controls | 102 passed, 0 failed | Same real source fixtures; includes positive and mutation/opaque-value controls. |

All four commands used Node 24.22.3, pnpm 10.32.1, Vitest 2.1.9 and one worker. Source snapshots before and after each command matched. The exact commands, full Vitest JSON reports, stdout, runner, executed patch and source digests are in the adjacent archive. The 178 or 169 unselected tests are selection metadata, not executed passes.

Independent source review by the compiler workstream agreed that inventory presence alone does not establish an invalid scanner proof and that this fixture supplies no basis to change collector behavior. This is source review, not a GitHub approval or an execution attestation for the unrun whole-tree gate.

Evidence: [`evidence/2026-11-23-imported-row-proof-reconciliation/manifest.json`](evidence/2026-11-23-imported-row-proof-reconciliation/manifest.json) and its byte-verified `receipts.tar.gz`.
