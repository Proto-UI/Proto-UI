# Scheduled source-artifact repair — 2026-11-05

The scheduled CI run [41977517573](https://github.com/Proto-UI/Proto-UI/actions/runs/41977517573), at source `4db5275154fbc80b393c27d6148b8403e7c61361`, failed the generated Shadcn preset check in test-general and production preset admission. Its coverage-governance job independently failed the retained/live dependency comparison. Those native results remain failed.

This repair starts from integrated main `ec9ea70b8e1f1e2ff356091daf99221a605ad8c8`. It uses the existing generators; no collector, renderer, checker, workflow or product implementation is changed.

## Preset source and generated delta

Scanner repair `21d749af6fae1ce7f106979ee555d8661ace9f32` predates the candidate base and postdates both stale token inventories. Its direct-return guard withholds invented selector chains for returned `not`/`any` conditions, including their use inside `all`. Bare intent collection remains available. The relevant generator and collector sources are unchanged between the failed run and this repair's base.

Running `corepack pnpm@10.32.1 styles:preset:generate` produces only the following token changes:

| Inventory       | Previous tokens | Regenerated tokens | Additions |
| --------------- | --------------: | -----------------: | --------: |
| Shadcn          |             889 |                869 |         0 |
| Bootstrap 2.3.2 |             659 |                621 |         0 |
| Liquid Glass    |             447 |                442 |         0 |

Every removed variant retains its bare intent token. Brutalist's 515-token inventory, its generated theme, and the Shadcn motion palette remain byte-identical. The changed files are `packages/cli/src/generated/shadcn-style-tokens.ts` and `packages/cli/src/generated/draft-family-style-tokens.ts`; neither was edited by hand. Regeneration does not promote the draft families or establish complete scanner, native or visual conformance.

## Dependency snapshot

The existing `coverage:governance:refresh` command refreshes `internal/coverage-matrices/github-governance-snapshot.json`. Its unchanged admission checks retain exactly 27 dependency Issues, PR #580, their node IDs and URLs, and every reviewed owner token. The PR record is unchanged. Issue changes are confined to 20 body digests, observation timestamps and the title of #515; state, labels, assignees and milestones are unchanged.

This live dependency snapshot is separate from the frozen 0.3 source ledger. `internal/governance/release-0.3-source-ledger.json` retains SHA-256 `7b8d96ab6368dbb36764346932fd737d5e127c8b27aeb1208d0337b0a3c11a5e`; its correction companion is also unchanged. No source criterion or acceptance checkbox is promoted by this refresh.

## Executed local evidence

Node 24.21.0 and pnpm 10.32.1 were used in an isolated worktree. Frozen offline installation reused 557 packages and downloaded none. Heavy workloads were serialized through the existing shared guard.

- `corepack pnpm@10.32.1 check:styles:preset` passed all generation checks and 13 palette tests.
- `corepack pnpm@10.32.1 check:coverage-governance-live` passed the actual 27-Issue comparison; the existing checker ignores observation-only timestamp changes.
- Focused Vitest execution passed 205 assertions across `family-style-closure.test.ts`, `prototype-style-tokens.test.ts`, `proto-style-css.test.ts` and `shadow-style-command.test.ts`, with no failures, pending tests or skips. The run used one worker and exercised inherited family closure, physical document/Shadow CSS and actual command output behavior.
- `corepack pnpm@10.32.1 --filter @proto.ui/cli build` built the CLI's 62 files, one of the repository's 47 public packages.
- The built `packages/cli/bin/proto-ui.js shadcn --styles-dir ./styles` executable ran in an isolated consumer and generated token CSS, theme CSS and the style entry. The 135,010-byte token stylesheet has SHA-256 `2ce96ca5902d3e0394284069623f1a205cc65727954d824d754ecde6e4295dd4`; it contains the inherited `content-start` and `scroll-py-1` physical declarations and no unsupported-token diagnostic.

`corepack pnpm@10.32.1 check:coverage-matrices` failed on the four-artifact candidate. A clean control at `9ab7908f6e2cd56af2e7a72639e4d31029d7c4a5` has the same tracked tree, `a71a60aaa6841114e5213a643047f4562432231d`, as the integrated `ec9ea70b8e1f1e2ff356091daf99221a605ad8c8` base. The original command also failed on that control. Both complete outputs contain the same 1,343 diagnostic occurrences across 636 unique diagnostic strings, with every occurrence count preserved. No diagnostic was added, removed or normalized for the comparison; the canonical multiset SHA-256 is `3357ec41bf6c0dfda26d51f88d22a052bd98ad561f6beabf8239a8f49d4e680d`. Neither command reached its `&&` unit-test tail. The matrix check remains failed, with its existing failure set unchanged by this artifact repair.

Independent source review found no technical defect in these three generated changes and confirmed their fingerprints and historical scanner provenance. That review preceded this record and did not supply a native GitHub approval or exact committed-head acceptance.

## Remaining boundaries

Browser paint, workspace type checks, a clean packed install and the complete public-package build were not exercised by the observations above. The four retained scheduled cycles are non-green; this local evidence does not establish the two successive scheduled green cycles required by the release plan. Independent final-head review, genuine DCO, applicable platform checks and integration remain separate conditions.

The independent audit of merged PR #1286 also identified a separate source-reader admission gap: removing the entire known correction entry can bypass the per-entry completeness checks. Main reproduced it in Node 24 with the same valid-bound frozen bytes: an empty correction array was accepted as 1,233 total conditions and none for #649, while the retained positive input yields 1,238 total and five for #649. The reader repair remains separately assigned. This artifact transaction preserves the entry and makes no broader fail-closed claim about that reader.
