# Sprint 4: current public compiler semantics

Integration: [PR #1714](https://github.com/Proto-UI/Proto-UI/pull/1714). This record separates current-source repairs from the recovered historical private IR10 candidate. The source recovery, author/rights boundary and migration dependencies remain in [the recovery record](./2026-11-22-sprint4-ir10-recovery.md). No private fixture source is published here.

The accompanying [machine-readable receipt](./2026-11-22-sprint4-public-compiler-semantics.json) pins the original input hashes, the separately named lawful control, test-log hashes and this implementation inventory. Final PR-head CI and independent review remain separate integration evidence.

## Current-source changes

### Dormant callable admission — #892

The public frontend previously lowered every local function body while processing its declaration. An uncalled body containing an unsupported capture therefore failed admission, and an uncalled default-parameter installation helper could incorrectly contribute expose metadata.

`parser-source-demand.ts` now proves a conservative unused declaration closure before deferring a body. It preserves the complete input bytes and source hashes, original AST bindings and explicit signature obligations. A real call, public escape, property observation, mutable alias or unclassified reference retains full body checking. It emits no substitute function or empty body. Duplicate parameters, unsupported explicit types, rest-parameter boundaries and the direct current/later-default-parameter TDZ remain diagnostics. The two existing unused-default TDZ negative fixtures in `ordinary-flow-soundness.test.ts` were retained unchanged; separately added called variants confirm the same refusal when invoked.

The frozen original #892 test has a different shape: an imported, unused `definePrototype` setup. That specific case already worked in the public compiler. Its unchanged archived test file was replayed with only the named dormant test selected: **1 passed**, with the other **42 unselected** and not claimed as accepted. The selected test checks both unused admission and reached-body refusal and proves that the source global callback was never executed. This replay is not a claim that all historical IR10 source-graph tests pass.

### Optional callable default exports — #894

The original frozen three-file graph initially failed public admission at its literal boolean `includes` initializer. The current implementation adds three bounded prerequisites:

- Direct scalar-literal array membership is checked and folded without calling input code. Holes, spreads, custom receivers, optional calls, extra arguments and dynamic operands retain diagnostics.
- An immutable, statically selected module callable keeps the real source-function reference or `undefined`, a checked optional-callable type and the full source graph. The unselected helper cannot contribute a fabricated body or exposure.
- Import cycles are admitted only for complete inert declaration graphs. ESM dependency postorder and statement order govern immediate reads; lexical/default-export TDZ, mutable reads, factory cycles and partial discovery remain refusals. A hoisted function read is distinct from an uninitialized arrow or default-export snapshot.

Cold IR validation independently checks static alias provenance and type. Native owner partitioning follows the alias dependency. The unchanged original graph now parses, cold-validates and runs in all **four Web source profiles** through ordinary generated native imports. Each profile observed `answer === 42`, `read() === 42`, rendered `42`, and rejected a retained public method after disposal. This is current public-compiler evidence against frozen source bytes, not acceptance or migration of the old private compiler closure.

Independent public fixtures additionally cover the undefined branch, absence of an invented exposure, setup-only effects reached later, invalid function signatures, source-byte preservation, hoisted versus lexical/default-export TDZ, erased-type and mutable-condition refusal, and forged cold aliases. They are explicitly labeled as independently authored controls.

### Throw-only result and literal-call proof

Ordinary all-throw functions with a declared non-void result were already admitted by the public frontend. Added controls preserve exact abrupt completion, including `finally`, and reject missing/wrong returns, swallowed exceptions and a cold IR body with its throw removed. They do not substitute for the original getter case in #893. Getter implementation and its source/native evidence form the separate accessor slice of this PR.

A real Transition consumer exposed an additional source/cold mismatch: source calls accepted recursively checked literal discriminants, but cold ordinary-call validation used only the widened record type. Cold validation now uses the same literal evidence after validating the complete argument expression. Wrong discriminants, stale mutable records, capability-bearing fields and forged literal types remain rejected. The consumer no longer needs a compensating `as const` assertion.

## Original rest negative and additive lawful control — #891

`scripts/compiler/verify-object-rest-controls.mjs` takes the privately recovered material and a separate private output directory. It verifies the two original source hashes and the archived Node-reference hash before creating any control. It checks both complete source graphs using TypeScript **5.9.3**, the repository's actual Core dependency graph and strict settings; no Core stub is introduced.

The unchanged original retains its sole diagnostic at `object-rest-observer.ts:61:3`: **TS2322, `Type '13' is not assignable to type '3'.`** No dependency diagnostics were hidden. A separately named `lawful-annotation-control` inserts one explicit widened `Readonly` data annotation. It has **zero diagnostics**. The original and lawful helper transpile to **identical JavaScript bytes**, and every archived `results` value matches, including both rest observations, pattern cells, abrupt completion and all five primitive-key observations. No cast, suppression, source trimming or expected-value change is used.

The public compiler still explicitly rejects both complete rest graphs at the computed binding key. The ordinary helper result is not whole-Prototype execution, generated native execution or acceptance of separate archived edge-only fixtures. The original invalid graph remains invalid; the additive lawful graph does not replace it.

Reproduction after lawful access to the private recovery inputs:

```sh
node --import tsx scripts/compiler/verify-object-rest-controls.mjs <recovered-private-material> <separate-private-output>
node --test scripts/compiler/verify-object-rest-controls.test.mjs
```

The repository test uses an independently authored miniature graph and verifies the same annotation-only/identical-JavaScript property; it does not contain the private original.

## Focused verification

All lanes used one worker. These are bounded local checks, not a full workspace or platform acceptance claim.

| Lane | Result | Boundary |
| --- | --- | --- |
| Final dormant, ordinary flow, module selection, literal-call suites | **106/106** | Includes unchanged default TDZ negatives and two additional called controls |
| Module selection plus existing source graph, module storage/data and finite membership | **123/123** | Earlier bounded lane; existing factory-cycle refusal remained unchanged |
| Four native profiles: selected/undefined module callable plus existing owner-dependent defaults | **44/44** | Independent current-source controls |
| Ordinary throw-only and dormant native consumers | **16/16** | Four native profiles; ordinary throws do not certify getters |
| Frozen #894 original graph | **4/4 native profiles** | Exact three input hashes; actual 42 result and disposal guard |
| Frozen #892 named dormant test | **1/1 selected** | Other 42 tests unselected, not accepted |
| Parser dependency type slice | **282 source files, zero diagnostics** | TypeScript 5.9.3; five parser roots, not full workspace typecheck |
| Original/additive rest verifier | **Original one TS2322; lawful zero diagnostics; runtime values identical** | Complete strict-TS graph; ordinary helper only |
| Public rest-control verifier test | **1/1** | Independently authored input; no private source dependency |

Contract details and remaining syntax/target boundaries are in [the source-language contract](../compiler/source-language.md). The enclosing PR must still bind its final source revision to integration checks and independent review. Historical rights/DCO and the private #913 → #914 → #915 dependency sequence are not changed by these current-source results.
