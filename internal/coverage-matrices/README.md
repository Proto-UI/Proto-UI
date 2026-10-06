# Coverage navigation

The [active prototype comparison and four-family projection matrix](prototype-coverage-matrix.md), backed by [structured data](prototype-coverage-matrix.json), is the current portfolio entry under [#870](https://github.com/Proto-UI/Proto-UI/issues/870). It supersedes the older #377 matrix navigation while preserving its [dated snapshot](snapshots/2026-10-06-issue-377-before-migration.md), unfinished work, and existing implementation owners.

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
