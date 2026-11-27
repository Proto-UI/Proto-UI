# Sprint 5: retain the current WC percentage source in its actual bridge

## Request and observed failure

The current user asked the Agent to finish Sprint 5's browser compiler and native consumer work. This repair addresses the production bundle prerequisite of #1172 and the actual browser demonstration in #1170. It does not admit another source profile or change a prototype's semantics.

The production build at PR #1738 head `db747e1b81cbbfaf2b37dd8af3de48108f036a04` completed 684 pages but reported 49 ownership errors in [run 45228171867](https://github.com/Proto-UI/Proto-UI/actions/runs/45228171867). The downloaded artifact `14844803475` was verified against GitHub's SHA-256 `73994168da9781a6809c7ceb8358148a708c38a091369f54e28752c3b8ad13d6` before extraction. Its original production graph remains byte-identical, SHA-256 `08aa327638f6f19eb6cef4721ede8b4508ce928ff79e334fd262946a59b89881`.

## Source and ownership walkthrough

Rule 6 in `internal/website/self-hosting-coverage-matrix.md` admits only the reviewed control bridge and renderer source owners, with explicit Adapter dependencies. A package or directory is never a blanket permission.

The actual graph puts `packages/adapters/web-component/src/shadow-percentage-source.ts` in the single `site-shadcn-controls.SAde5moC.js` bridge chunk. Its only source importer is the already reviewed public WC `adapt.ts`. Its one runtime import is `packages/modules/expose-state/src/index.ts`; the other source import is type-only. It neither imports a framework nor an optical renderer. The source captures the current owner and validates the existing percentage State and CSS projection before publishing the view. It adds no independent lifecycle.

The checker had not added this exact new helper to the finite reviewed bridge list. Every route that legitimately shared that bridge consequently reported the same helper. The fix adds that one path to the bridge list. Material diagnostic source paths still cannot import it; another chunk cannot borrow the bridge's allowance, and missing source-edge ownership still fails.

## Executed controls

- Original production graph replay: **49 issues**, all naming this helper.
- Thirteen selected controls before the change: **13 failed** for the missing bridge admission, including the existing Shadow resource placement check.
- Complete checker suite after the change: **2,094 passed**, **0 failed**, **0 skipped**. Twelve added tests exercise both exact material diagnostics, each route/producer's static and dynamic bypass, and the missing bridge source-edge control. The existing misplaced Shadow resource test includes the new helper.
- The same original graph after the fix: **0 issues**; its hash is unchanged.
- Node 24.22.3 and pnpm 10.32.1; dependencies installed from the frozen lockfile into this worktree. The checker and test source hashes are recorded beside the raw results.

Raw original build output, graph, red and green controls, and replay results are preserved in `internal/records/evidence/2026-11-24-sprint5-percentage-bridge/manifest.json`. This is an internal ownership-check repair, so the evidence is an executed source/graph walkthrough rather than an invented UI screenshot.

The replay is not a fresh production build, real browser acceptance, native consumer execution, independent approval, integration, or whole-Sprint completion. Those results remain separately bound to the final candidate.

Agent: OpenAI Codex, under the current user's Sprint 5 continuation request.
