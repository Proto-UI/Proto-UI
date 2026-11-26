# Button documentation lifecycle and review-evidence correction

## Observed source

This user-directed documentation repair starts from main `88fc0883bec70abbc0d7505d88370657c279639e`. It changes reader projections only. Existing prototype lifecycles, implementation behavior, review permissions and historical records remain unchanged.

The Base rewrite `fad9d4e6a` removed the explicit draft lifecycle and the distinction between the website's four-host workspace preview and the published 0.2.0 package. The Shadcn page in the same documentation integration replaced its scoped workspace-preview introduction with an unqualified statement of consistent semantics across Web Components, React, Vue 3 and Vue 2. The Chinese pages made the same change. The Vue 2 workspace-only note was still present, so it would be inaccurate to say every availability warning disappeared.

`P-BASE-BUTTON` and `P-SHADCN-BUTTON` remain `draft`. `T-BASE-BUTTON-0001` records bounded passing implementation evidence alongside the required, planned homepage browser case. A preview selector and package publication do not activate those catalog identities or complete every host journey. This record preserves the earlier text and results through Git history; it does not rewrite them into successful acceptance.

## Correction

- Restore short **early draft** and workspace-preview notes on the Base and Shadcn Button pages in both languages, with a link to the current Button test catalog.
- Preserve the exact Vue 2.6 source profile and identify the published 0.2.0 CLI's `wc`, `react` and `vue` choices. Keep workspace style profiles and opt-in focus-retained visibility separate from that older published API.
- Describe Shadcn's purpose and style directly, without treating the four preview options as an established cross-host compatibility result.
- Clarify the documentation style guide: removing repetitive internal audit prose must preserve lifecycle, availability, version, unsupported-capability and known-limit facts that affect an application's choices.

The existing preview JSX, runtime selections, imports, props and examples are unchanged. Liquid Glass Button still has its explicit workspace-source-only installation block at the inspected base; this repair does not attribute its removal to the rewrite.

## Review allegation and current enforcement

The quoted claim that an Agent's own review counts as effective acceptance was not located in the current tracked internal records inspected here. That search is not proof about every historical or live GitHub discussion. The current [contributor review contract](../../../agent-operations/contributor-agents.md#review-as-an-evidence-packet) requires a fresh reviewing context and exact-source evidence. It distinguishes local technical review from a submitted GitHub disposition and rejects a reviewer who is the PR author or a commit contributor. An author self-check supplies validation evidence; it cannot supply the missing independent acceptance.

Three existing admission tests were executed without changing them. They cover explicit review authorization, owner-delegated review and owner-delegated merge, including PR-author and commit-author/committer refusals, unverifiable contributor identity, CI conditions and independently published exact-head review. All three selected tests passed. These controlled tests establish the existing admission logic, not the actual presence of a GitHub approval. No review, merge, ruleset change or acceptance status is created by this documentation record.

## Validation and limits

Node.js `v24.22.3`, Corepack pnpm `10.32.1`. The [manifest and compressed original logs](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-button-lifecycle-correction/manifest.json) bind the changed documentation and inspected source bytes.

| Check | Actual result |
| --- | --- |
| `check:public-docs` | Passed: 307 bilingual primary routes and four library inventories. |
| Formatting and `git diff --check` | Passed for the changed authored files. |
| `check:agent-operations` | Structural checks and skill/schema projection passed. The full test invocation was interrupted with exit 130 during a shared disk-pressure incident after output stopped progressing; there is no complete-suite pass. |
| Canonical `check:agent-doc` | Failed before execution because the local tsx CLI could not open its IPC pipe (`EPERM`). |
| Same snapshot generator through `node --import tsx` | The first attempt exposed a missing worktree dependency link. After linking the existing spec-package dependencies, generation and `--check` both passed. The original failures remain archived. |
| Existing review admission controls | Three selected tests passed, zero failures; the remaining tests in those files were outside this selection. |

The focused command was:

```sh
node --test --test-name-pattern='review submission preserves explicit authorization|owner delegation admits a real review packet|owner-delegated merge' scripts/agent-operations/test/review-runtime.test.mjs scripts/agent-operations/test/owner-authorization.test.mjs
```

No product/browser/native test or rendered layout acceptance was performed by this documentation repair. The integration owner retains independent review, exact-head CI and live platform admission; this author's local checks are not substituted for them.
