# Proto UI portfolio pass — chief-facing report (follow-up, 2026-09-01)

## Since last report

Live main advanced `9c8891ca` → `18b9c78f`. Two previously-blocked viewer-authored PRs merged (both after @guangliang2019 non-author approval):

- **#547** — Text Control line-mode (#389 B) → squash `37755def`.
- **#512** — Hover Card demo trigger cursor fix → squash `18b9c78f`.

## This pass posted 4 guidance comments (exact-head, non-duplicative)

- **#571** — CI now red at `6c996be` (Hover Card transition-duration `0s` vs `0.2s`); the timeout-only push did not resolve `CHANGES_REQUESTED`. → #issuecomment-5492337691
- **#551** — deterministic runtime-contract failure at `f9934d5` (`StateValidationFailure` never constructed); Poppy preview failed; Option A/B still undecided. → #issuecomment-5492337668
- **#509** — DCO identity closed (exact-identity remediation); six remaining/current blockers flagged (review-pagination, automation.md drift, non-executable `resolve-fixed-review-thread`, schema-v2 digest contradiction, handoff replay gap, packet-mode digest). → #issuecomment-5492337721
- **#581** (new, Image View Checkpoint C) — required `test` failure is pre-existing on its base, not from its diff; base refresh needed; Codex P1 at `web.ts:94` generation binding + no human approval. → #issuecomment-5492337695

## No-op / already routed (no duplicate comment)

- **#553** — design-vs-Tabs-migration maintainer decision already posed; reviewers pending.
- **#534** — prior Scroll Area / React-race / Copilot blockers cleared at `36999e3f`; only independent approval remains, already requested.

## Standing human gates (unchanged)

#563 COV-001/002/003; #549/#548 semantic decisions; #551/#553 review chains; whitepaper blueprint acceptance (#475/#476/#477/#479); Brutalist admission + co-signoff (#386/#387); #496/#498 substrate rulings; #509 unresolved current-head blockers; DCO/identity follow-through (#504).

No merge, review submission, label, close, assign, or release mutations were performed this pass. Full per-object detail is in `PROGRESS.md`.

## Priority exact-head reviews

- **#583 @ `c2564289`** — prior floating-revision and contradictory remaining-gap blockers are resolved. CHANGES_REQUESTED remains for three new exact-head findings: later recipe centers at Root while Proto centers at Indicator but spec marks mechanism fully adopted; focused test pins only later comparison revision and not historical baseline `f31ed819...`; `rounded-[4px]` rationale cites an anonymous issue ruling. Receipt: https://github.com/Proto-UI/Proto-UI/pull/583#pullrequestreview-5079678403
- **#585 @ `d4d5c7ef`** — placeholder mapping/tokens are narrow, but the coverage gate misses hook-result bindings (`const hook = asHook(); const state = hook.stateHandles`) already present in-tree, so it can remain green while real lowering pairs drift. CHANGES_REQUESTED receipt: https://github.com/Proto-UI/Proto-UI/pull/585#pullrequestreview-5079680889

## Durable ledger location

- Branch: `agent/portfolio-chief-ledger-20260901` (pushed to `origin`).
- `internal/records/2026-09-01-portfolio-chief-progress.md`
- `internal/records/2026-09-01-portfolio-chief-report.md`

## Concrete blocker follow-up

- **#581** fixed/pushed `ed041a17`: request-bound decode token replaces mutable generation reads; 23 focused tests + workspace types green after rebase. Receipt: https://github.com/Proto-UI/Proto-UI/pull/581#issuecomment-5499994326
- **#571** fixed/pushed `e6e76a62`: real Hover Card lifecycle endpoint, no Skeleton browser-default overfit, dark motion evidence; full four-runtime file 6/6 + 22 authority tests + workspace types green after rebase. Receipt: https://github.com/Proto-UI/Proto-UI/pull/571#issuecomment-5499994948
- **#551** remains a human semantic gate. Exact Option A/B packet posted; recommendation is Option A (A11y-boundary fail-closed projection, no generic State veto). No semantic implementation selected pending maintainer authorization. Receipt: https://github.com/Proto-UI/Proto-UI/pull/551#issuecomment-5498722020
- **#571 CI follow-up** pushed `fbad7282`: separate Shadcn Textarea React commit-order race fixed by waiting for committed transition tokens; full Shadcn browser file 5/5 + workspace types green; independent review clean. Receipt: https://github.com/Proto-UI/Proto-UI/pull/571#issuecomment-5500560508
- **#571 final CI follow-up** pushed `15700044`: runtime-selector pointer hover is now cleared and `data-hovered` removal awaited before rest shadow sampling; full four-runtime file 6/6 + workspace types green; independent review clean. Receipt: https://github.com/Proto-UI/Proto-UI/pull/571#issuecomment-5501294283

## 2026-09-02 priority results

- **#583 @ `c2564289`**: no new code since the existing exact-head CHANGES_REQUESTED. Old two findings resolved; three later blockers remain (centering owner, historical baseline test binding, anonymous radius ruling). Receipt: https://github.com/Proto-UI/Proto-UI/pull/583#pullrequestreview-5079678403
- **#585 @ `a40e7e30`**: CI/DCO green and previous binding-shape gap improved, but scanner remains fail-open on untraced lowerable leaves and is not lexical-scope-safe. Receipt: https://github.com/Proto-UI/Proto-UI/pull/585#pullrequestreview-5085153882; P2 fixture note: https://github.com/Proto-UI/Proto-UI/pull/585#issuecomment-5505778509
- **#587 / PR #591**: Issue #587 remains OPEN as an investigation; PR #591 (`cd549b4b`) was CLOSED UNMERGED. Real 390×844 component measurement invalidated the synthetic ~204px lag and bounded host deviation during layout movement to at most 1px. Do not restore Floating UI `animationFrame: true` without on-device compositor-scroll evidence. Issue: https://github.com/Proto-UI/Proto-UI/issues/587 · closed PR: https://github.com/Proto-UI/Proto-UI/pull/591
