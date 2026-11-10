# Coverage navigation

The [active prototype comparison and four-family projection matrix](prototype-coverage-matrix.md), backed by [structured data](prototype-coverage-matrix.json), is the current portfolio entry under [#870](https://github.com/Proto-UI/Proto-UI/issues/870). It supersedes the older #377 matrix navigation while preserving its [dated snapshot](snapshots/2026-10-06-issue-377-before-migration.md), unfinished work, and existing implementation owners.

The [composition delivery parity audit and repair record](composition-delivery-parity.md) traces public definitions, recommended compositions, homepage/demo consumers and workspace/installed boundaries, with reproducible diagnosis and commit-bound validation. It is not a claim that all composition or installation gaps are closed.

Proto UI is independent. Comparison projects and design/specification references do not determine its roadmap. A directory name is neither a new Base protocol nor an automatic adoption commitment.

The following are separate dimensions, not numbers to add into one coverage percentage:

- Prototype families, cataloged atomic parts and lifecycle
- Shadcn, Brutalist, Bootstrap 2.3.2 and Liquid Glass projection cells
- [Website consumer jobs](../website/self-hosting-coverage-matrix.md), owned by #420
- [Agent Harness consumer jobs](../agent-harness/dogfood-coverage-matrix.md), owned by #513/#514
- Native host and Compiler realization, evidence and intentional omissions

The two consumer ledgers retain all row IDs, owners, application/service boundaries and completion rules. A matrix migration does not mean their consumers are implemented. Existing open Issues/PRs stay open and remain the implementation owners; no historical item is silently closed as fixed.

Validation and regeneration:

```sh
node scripts/coverage-matrices/prototype-coverage.mjs --check
node scripts/coverage-matrices/prototype-coverage.mjs --write
node --test scripts/coverage-matrices/test/prototype-coverage.test.mjs
```

The JSON is the editable inventory; the Markdown view is generated. Refresh exact snapshots and per-row decisions when the source changes. A successful check proves bounded inventory consistency, not runtime behavior or semantic admission.

A cataloged projection has one owning family. Its inherited Base identity selects that family when its source list also cites supporting definitions from other families; those supporting paths do not duplicate the projection identity into another row. A multi-family source list without one proven inherited Base owner is rejected rather than guessed. Candidate source refreshes retain the pinned-main inventory and existing acceptance gates; a newer source inventory is not lifecycle promotion or completed parity.

The main/reference counts and migration states retain their original observation dates. The migration ledger keeps all 93 original references and its 8 later dependencies; refreshing source does not make those GitHub states current. Re-read the exact Issue/PR before changing a condition. A documentation PR must not auto-close #870.

Current release interpretation follows the [0.3 plan](../governance/release-0.3-plan.md). Base, Shadcn, Brutalist and Lucide are the committed library scope. Bootstrap 2.3.2 and Liquid Glass remain WIP / Experimental for 0.4, and the four-family matrix retains its [recorded 0.4 deferral](https://github.com/Proto-UI/Proto-UI/issues/870#issuecomment-6684477558). All original conditions and mixed-release children remain accountable. The tracker's 2026-10-22 decision allows independently acceptable dependent stacked PRs; historical single-PR routing is preserved as history.

To refresh the separately labeled candidate, first preserve the exact previous JSON and its SHA-256 as dated evidence. Use a full commit SHA whose package, catalog, retained Shadcn comparison and dedicated consumer-ledger bytes match the worktree:

```sh
node scripts/coverage-matrices/prototype-coverage.mjs --refresh-candidate <full-commit-sha> --write
node scripts/coverage-matrices/prototype-coverage.mjs --check
node --test scripts/coverage-matrices/test/prototype-coverage.test.mjs
```

The refresh produces the JSON and both Markdown views through this generator. It retains the historical main evidence, comparison pins, migration rows, original delivery conditions and acceptance fields. It copies consumer columns from their canonical website/Harness ledgers and recounts their states without changing the source ledgers. A changed consumer ID set rejects the refresh and requires explicit migration; an editor-row update remains with its Harness owner.

Candidate inventory includes regular `.proto.ts` definitions and actual TypeScript files resolved from catalog file or directory citations. A composition with one cataloged identity contributes that identity even when its entry is `index.ts`; exported helpers do not invent additional admitted parts. Ambiguous family ownership still rejects. Candidate object proofs bind these entries, helpers/tests, retained comparison sources and canonical consumer ledgers to the advertised commit and current bytes.

The single Shadcn inheritance column does not represent eight completed style projections. The candidate carries one explicit acceptance cell for each Base identity and each of Vega, Nova, Maia, Lyra, Mira, Luma, Sera, Rhea and independently retained New York (`new-york-v4`). Membership and source pins come from the [retained manifest](../fixtures/shadcn-style-source/manifest.json). All cells remain `required-unassessed` or `required-missing`, with unverified acceptance and no new receipts. Existing component-specific baselines, unsupported mappings, actual old failures, runtime/Compiler/native/AT evidence and consumer acceptance must be reconciled independently; this source refresh supplies none of those results.
