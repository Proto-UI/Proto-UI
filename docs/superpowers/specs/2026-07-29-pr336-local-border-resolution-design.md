# PR #336 Local Directional Border Resolution Design

**Date:** 2026-07-29 **Status:** Approved

## Goal

Close the final PR #336 review blocker without changing the stable `feedback.style` semantic-merge v0 contract.

## Problem

Brutalist Dialog Header and Footer each combine a directional border-width token with the global `border-black` color token. The v0 semantic merge groups `border-*` colors together and does not define directional border-width groups. A prior fix expanded `mergeTwTokensV0`, but that changes the shared v0 semantic grouping contract and incorrectly classifies valid Tailwind v4 directional arbitrary colors and numeric widths.

## Decision

Keep shared semantic-merge v0 unchanged and solve the collision inside the Brutalist Dialog projection.

- Header uses `border-b-2` with the projection-local Proto UI token `brutalist-border-bottom-black`.
- Footer uses `border-t-2` with the projection-local Proto UI token `brutalist-border-top-black`.
- The tokens contain no `:` and therefore obey the stable v0 author-token purity contract. Tailwind arbitrary-property syntax was evaluated and rejected because `assertTwTokenV0` and `C-FEEDBACK-STYLE-0004` intentionally forbid `:` in prototype authoring tokens.
- Under semantic-merge v0 fallback, each projection-local token is its own group, so width and color remain independent without expanding the stable grouping contract.
- The CLI static token renderer explicitly supports the two official tokens so generated preset CSS remains closed and deterministic.

## Rejected Alternatives

### Tailwind arbitrary properties in author tokens

The first projection-local attempt paired `border-b-2` with `[border-bottom-color:#000]` and `border-t-2` with `[border-top-color:#000]`. Runtime tests rejected both during prototype setup because `assertTwTokenV0` forbids `:`; `C-FEEDBACK-STYLE-0004` defines that ban as author-channel purity, not a validator accident. Widening the v0 grammar would therefore recreate the same shared-contract problem. The allowlisted, colon-free `brutalist-border-bottom-black` and `brutalist-border-top-black` tokens preserve the directional CSS border colors while remaining independent fallback semantic groups.

### Upgrade semantic-merge contract

A new semantic-merge contract version could classify directional width and color comprehensively. This is intentionally excluded from PR #336 because it would require a Core contract migration, catalog changes, broader adapter/consumer evidence, and a larger review surface.

### Simulate the rule with inset shadow

An inset shadow would avoid the merge collision but changes the declared visual primitive from a border to a shadow and would require rewriting the Header/Footer visual criteria. It is less semantically accurate.

## Implementation Boundary

Modify only:

- Brutalist Dialog Header/Footer tokens and their direct tests;
- Header/Footer P criteria text that names the exact token grammar;
- CLI static token rendering and focused renderer tests;
- generated Brutalist preset tokens after source changes.

Revert only the PR #336 additions to:

- `packages/core/src/spec/feedback/semantic-merge.ts`;
- `packages/core/test/feedback/semantic-merge.test.ts`.

Do not create semantic-merge v1 in this PR and do not add the Core test as a new T implementation, because the Core behavior change is withdrawn.

## Test Strategy

1. Add a failing CLI renderer test for both projection-local directional color tokens.
2. Change Dialog test expectations to require width plus the corresponding local color token and reject `border-black` on Header/Footer.
3. Add the two static CSS utilities and update the projection tokens.
4. Revert the Core semantic-merge implementation and regression-test changes.
5. Regenerate the Brutalist token manifest.
6. Run focused Dialog, CLI CSS, semantic-merge baseline, style-preset, catalog, types, and full project gates.
7. Perform a final code/spec review before pushing and requesting the maintainer's last manual interaction pass.

## Follow-on PR Bump Order

After PR #336 is closed on the latest `main`, update the remaining PRs in dependency order:

1. #337 Separator/Skeleton;
2. #338 Avatar/Badge/Card;
3. #339 Scroll Area shell, then #343 Base Scroll Area behavior;
4. #340 Tooltip shell, then #342 Base Tooltip behavior;
5. #341 ChatUI Message/Code Block.

Each branch is rebased or reconstructed against current `main`, conflicts and generated artifacts are resolved, tests are rerun on the new head, and review is requested only after self-review.
