# Finite scroll CSS control evidence — 2026-11-06

Issue [#1073](https://github.com/Proto-UI/Proto-UI/issues/1073) already has the finite CSS mappings. This change repairs the regression assertions around their observable output. `C-WEB-SCROLL-PADDING-STYLE-0001` remains **draft**; its admission question, native scroll ownership and active-target reveal are unchanged.

The old tests could accept an extra declaration and a wrong split-surface selector. The strengthened test compares the complete selector multiset for each token in document, ordinary shadow and split-shadow output, then compares every matching rule's declaration multiset. The split artifact's ordinary appended section is checked too. Receipt metadata is exempt only on its compiled split-surface rule. Declaration order and receipt values are not pinned. Unknown, negative, arbitrary and injection-shaped inputs retain their original explicit-rejection assertions.

## Source identity

The delivery base is main `e5783ffa0647e14350652da234ddb22ed9eadc41`. Its five reached production/re-export files match the earlier executed source byte-for-byte. The CSS service remains Git blob `da73b18a38965ff3d7f5e2bab916b29395be10e3`. The old test is `fac3f22a82d42bf45054614d32f9a6a20918b608`; the strengthened executed test image is `7ca892ec25be1a423fd7bac7fdba97688b45ef46` (SHA-256 `2e1ec3c8f3a43c1170e1e4c3ed326f56d3c218a2810e3cd5f0180191fe839833`).

The first delivery formatting check flagged the test. Canonical Prettier 3.8.1 output has Git blob `bf869278a8890ce9d6e4fd19ed5e0b160d38682d` (SHA-256 `381526bd803f641aa86f7a513b6474a95ef45b3357059158a09f706c3681ce5d`). A native TypeScript 5.9.3 traversal observed identical AST fingerprints across all 5,827 nodes before and after formatting, including literal text and unary operators, with no parse diagnostics. The earlier runtime receipts retain the executed `7ca892ec` identity; formatting equivalence is a separate observation.

The existing test source and prior partial work were preserved. The five reached files are `packages/cli/src/services/proto-style-css.ts`, `packages/cli/src/legacy/type.ts`, `packages/cli/src/generated/brutalist-style-tokens.ts`, `packages/cli/src/generated/shadcn-style-tokens.ts` and `packages/cli/src/generated/brutalist-theme.ts`. No generated source, production implementation, definition, dependency, threshold or workflow changes are part of this repair.

## Actual observations

These are three separate executed observations on base `c8a006403f4dfc850ee3cec5633c17f394ccd308` and their exact six-file source bindings. They are reused evidence; they are not runs of the later delivery head.

| Observation | Actual result | Scope |
| --- | --- | --- |
| Complete focused CSS Vitest file with the strengthened test | 75 passed; 0 failed; 0 pending | Original complete file, Node 24 / Vitest 2.1.9; no workspace-wide pass asserted |
| Native computed CSS from the actual emitted styles | 63 rows passed | HeadlessChrome 156; three CSS targets, six positive values and fifteen rejected inputs per target; direct source output |
| Isolated mutation controls | 9 lanes passed their declared predicates | Seven mutant lanes reject the bad output; two old-test control lanes accept their respective bad output; four selected test cases per lane |

The seven mutations remove the logical padding mapping, add a foreign declaration, change the split-surface selector, duplicate a matching rule, or leak receipt metadata into each of the three ordinary rule contexts. The last two old-test lanes use exactly the extra-declaration and wrong-selector mutations. Their four selected tests all pass, while the strengthened tests reject the same bad images. The unknown-token control passes in every lane.

The mutation runner used an isolated twelve-file closure. All seven final guards passed: bound sources, old/new test variants, dependency resolution, copy closure, copied files, original worktree caches and original worktree integrity. The independent parent readback confirmed that the six source files and original caches were unchanged and the owned temporary copy was removed. The remaining **71 of 75** positive test cases were not run under mutation.

## Retained failed attempts and receipt scope

The initial control preflight failed before Vitest because the diagnostic runner expected an unavailable variant-byte field; no lane ran. The second runner repaired that interface and made final source/cache guards blocking. Its preflight passed, but the full run retained four signature-qualification failures because Vitest's JSON reporter abbreviated comparison values.

The final runner also qualifies the complete rendered comparison only inside the uniquely named failing case's own stderr assertion block, retaining its SHA-256. It does not search unrelated stderr for an expected phrase. All nine lanes then met their unchanged predicates. The original seven mutation postimages, nine lane predicates, twelve-file closure, product source and permanent test assertions were preserved throughout these diagnostic repairs.

The retained local receipts are `release03-issue1073-current-main-focused-20261106-receipt.json`, `release03-issue1073-native-css-direct-20261106.receipt.json`, `release03-issue1073-controls-main-full-r3-20261106/receipt.json` and `release03-issue1073-actual-nine-controls-parent-receipt-20261106.json` under the integration owner's temporary evidence directory. The final control receipt SHA-256 is `90c7454c28c1a929d21483eb9bb45f041fabbf177aeeec4b00794441a5172d68`. These local artifacts are not public evidence URLs or hosted CI results.

## Remaining original criteria

The Issue's original D1–D3 and historical D4a remain attached to their actual sources. This repair supplies the separately bound complete test result and discriminating negative controls. It does not assert independent approval of the delivery head or complete the composite D4b review condition. The current user's connected-operation integration decision is recorded separately from technical acceptance.

A1 still needs exact-version packed installation, official generation and zero unsupported diagnostics for the selected final artifacts. A2 still needs the actual generated Search/Command consumer, keyboard active-item reveal, nested scroll ownership, reopen, viewport/font scaling and the supported Web-host boundaries under #420 / #1095. Computed CSS values do not prove scrolling or reveal. A3 still needs disposition of `C-WEB-SCROLL-PADDING-STYLE-0001-Q-ADMISSION` and a scheduled regression receipt for the selected source. The main `e5783ffa` manual regression dispatch is not a scheduled-green recovery receipt and does not run this later test change.

Historical #1068/#1183 failures, older successful source-bound probes, unsupported observations and unrun stages remain retained. This record does not close the Issue, promote the draft contract, publish a release or claim complete compiler/host conformance.
