# Coverage unearned-admission repair — private R2 candidate

Scope owner: `coverage-unearned-repair-r1` (private candidate only).
Audited baseline: `ff75a0a2b356005d8d2d3b73268d7e7a9a258447`
(`fix(coverage): bind earned startup prerender import admission (#1493)`, 2026-11-17T20:59:41+08:00).

This directory holds a **private** candidate. Nothing here was written to any worktree, nothing was
committed, pushed, or published, and no build, test, lint, formatter, browser or install was run.

## 1. What the candidate repairs

The retained audit `/tmp/contributor-eight-1117/coverage-allowlist-audit-r1/allowlist-audit.json`
classified 339 digest-bearing allowlist/fingerprint entries as **236 earned / 88 blocked-by-debt /
15 unearned** at the audited baseline. This candidate addresses exactly those **15 unearned** entries
and nothing else:

| group | count | audit mechanism | candidate treatment |
| --- | --- | --- | --- |
| specifier-only website raw-import allowances whose source bodies changed after admission | 7 | `website-raw-import-inline` (M3) | import-edge-only status stated in the checker, debt recorded in the website ledger |
| website Source-scan bindings whose owning rows are all `infrastructure-exempt` | 7 | `website-source-scan-bindings` (M8) | explicit `#420` source-review debt recorded next to the ledger; reviewed hashes kept |
| Harness raw-import allowance naming a path that does not exist | 1 | `harness-raw-import` (M4) | dangling pre-authorization annotated as inert and not earned, in the checker and in its owning matrix |

Nothing is refreshed: **no fingerprint is re-bound, no import is admitted, no consumer is certified,
no row state changes, no runtime evidence is produced.** The 236 earned entries and the 88
blocked-by-debt entries are untouched, so no already-satisfied bounded criterion is withheld by this
umbrella.

## 2. Files

```
r2/
  candidate.patch                       unified diff, parent -> candidate
  bindings.json                         per-change bindings and evidence
  dispositions.json                    per-row dispositions (15), rollups, open decisions
  parent-checks.json                    exact parent identity, apply checks, artifact digests
  proposed/                             the three candidate files (byte-exact)
    scripts/coverage-matrices/check-coverage-matrices.mjs
    internal/website/self-hosting-coverage-matrix.md
    internal/agent-harness/dogfood-coverage-matrix.md
  parent-check/                         parent blobs extracted read-only from ff75a0a2
  parent-check-applied/                 parent + candidate.patch (byte-identical to proposed/)
  parent-check-current-main/            same check where the three files are byte-identical
  evidence/
    recompute-ledger-drift.py           reusable read-only recomputation of the ledger drift
    ledger-drift-recompute.json         its output (158 rows / 77 matched / 81 mismatched / 7 unearned)
    allowlist-drift-recompute.json      the seven specifier-only entries and the Harness allowance
    source-last-change.json             last-change commits recomputed at the audited revision
```

The R1 partials are preserved untouched in `../before/` and `../after/`.

## 3. Changes (see `bindings.json` for the full bindings)

- **C1** `scripts/coverage-matrices/check-coverage-matrices.mjs:171-175` — one scope-precise note on
  the inline website raw-import allowlist: an entry **without** a `sourceSha256` certifies the import
  edge only, never the source body; post-admission body drift stays source-review debt under `#420`,
  with the affected sources and owning rows enumerated in the website ledger.
- **C2** `scripts/coverage-matrices/check-coverage-matrices.mjs:269-271` — the group comment no longer
  calls these entries "Accepted"; it states that they do not certify the admitted source body.
- **C3** `scripts/coverage-matrices/check-coverage-matrices.mjs:458-464` — the Harness allowance comment
  states that the Harness app does not exist at this revision, that the entry admits nothing today,
  that it is not an earned admission and not prior approval for a file that later appears at that
  path, and that it must be re-admitted with the Harness application's own review under `#533`.
- **C4** `internal/website/self-hosting-coverage-matrix.md:124,126` — two governance paragraphs under
  `## Source-scan bindings` (R1 prepared text, kept verbatim).
- **C5** `internal/agent-harness/dogfood-coverage-matrix.md:141` — one paragraph recording the Harness
  allowance as inert and pending under `#533`, in the matrix that owns that row.

**No executable line changed.** Every non-comment line of the proposed checker is identical to the
parent checker (12 775 code lines compared); the inline allowlist still has 52 entries; the Harness
allowlist entry and its specifier list are unchanged; the website ledger still has 158 binding rows
with identical cells; the dogfood coverage table between the `<!-- coverage-matrix:start/end -->`
markers is byte-identical, so `internal/coverage-matrices/prototype-coverage-matrix.json` is unaffected.

## 4. R1 -> R2 refinements (and what was preserved)

Preserved verbatim: the two prepared website-matrix paragraphs. The R2 proposed website matrix is
**byte-identical** to the R1 prepared `after/` file.

Changed from the R1 prepared checker edit:

1. *Scope of the import-edge statement.* R1 placed one comment above a single group of the inline
   allowlist. The seven drifted sources sit in three different groups (two have no group comment at
   all), so a group-scoped comment could not state the property for the set. R2 states it once, at the
   head of the inline set, self-limited to "an entry without a `sourceSha256`".
2. *Harness allowance.* R1 emptied `HARNESS_RAW_IMPORT_ALLOWLIST`. R2 keeps the entry and corrects the
   claim instead, because removing it changes the gate's Harness consumer-wall semantics, contradicts
   the governed dogfood row `harness.infrastructure.react-bootstrap` (owner/re-review issue `#533`,
   `internal/agent-harness/dogfood-coverage-matrix.md:100,321`), and breaks the retained control test
   *“allows only the reviewed Adapter entry at the Harness bootstrap boundary”*
   (`scripts/coverage-matrices/test/check-coverage-matrices.test.mjs:2418`). The removal option and its
   exact migration list are recorded as open decision **D1** in `dispositions.json`; it is not decided
   here.

## 5. Exact parent checks

- Candidate parent: `ff75a0a2b356005d8d2d3b73268d7e7a9a258447`; the R1 `before/` files are byte-identical
  to that parent's blobs (`check-coverage-matrices.mjs` blob `ad3d71ed…`, sha256 `0a4deb25…`;
  `self-hosting-coverage-matrix.md` blob `2f222139…`, sha256 `c241bc15…`).
- `git apply --check -p1 candidate.patch` in `parent-check/` → exit 0.
- `git apply -p1 candidate.patch` in `parent-check-applied/` → exit 0, and all three results are
  byte-identical to `proposed/`.
- The same patch also applies where the three files are byte-identical (`0f0955a9d624e0ef5e250f56a0eaa0fc52bbfb53`,
  observed as `refs/heads/main` by a read-only `git ls-remote` on 2026-11-18 and recorded as a dated
  observation, not as a live-head claim).
- It does **not** target `1954cd3566b8f93e388352e282701dd086df2cdd`, where the website matrix blob differs.

## 6. Independent recomputation (read-only, committed blobs only)

`evidence/recompute-ledger-drift.py` reproduces the audited counts at the baseline:
**158 binding rows, 77 matched, 81 mismatched, 7 mismatched rows whose owning rows are all
`infrastructure-exempt`** — the same seven paths, owners, pinned digests and current digests the audit
classified as unearned. The fourteen source digests behind the fifteen unearned entries were recomputed
independently and agree with the audit byte for byte. The seven specifier-only sources have no
`sourceSha256`, and each one last changed after the allowance boundary commit `a46b18cd2` (2026-11-11),
which is why the gate cannot see their drift.

## 7. Proposed validation for the parent's window (NOT executed here)

```
node scripts/coverage-matrices/check-coverage-matrices.mjs
node scripts/coverage-matrices/test/check-coverage-matrices.test.mjs
node scripts/coverage-matrices/prototype-coverage.mjs --check
node scripts/coverage-matrices/sync-github-governance-snapshot.mjs --check
```

Expected invariants: the checker still reports the 81 pre-existing Source-scan fingerprint mismatches
as failures (the candidate deliberately keeps them failing); the Harness control test at
`check-coverage-matrices.test.mjs:2418` stays green because the allowance entry is retained; the
governance snapshot `--check` stays green because the new prose is outside the parsed dependency
tables.

## 8. Open decisions for the parent / independent reviewer

- **D1** — Harness raw-import allowance: retain-and-annotate (this candidate) or remove it and migrate
  its callers (test `:2418`, the dogfood matrix statement at `:139`, the governed row at `:100`/`:321`).
- **D2** — who performs the exact-delta re-review that would replace the seven retained hashes; the
  owning rows' existing owners under `#420` are the matrix's own answer.

## 9. Limitations

- No execution of any checker, test, builder or linter was performed in this seat, by contract.
- The repository's history is shallow at `a46b18cd2`, so the exact introduction commit of the
  specifier-only allowances is not recoverable; the allowance is provably present from 2026-11-11 and
  each drifted source changed later.
- The audit's own limitation stands: remote GitHub body digests and the private `/tmp` artifacts cited
  by the retained records were not re-verified here, and no claim of a green coverage gate is made.
