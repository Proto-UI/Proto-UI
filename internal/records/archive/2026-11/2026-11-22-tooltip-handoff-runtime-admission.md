# Tooltip warm-handoff runtime admission reconciliation

This record concerns the current Web consumer evidence for [#1455](https://github.com/Proto-UI/Proto-UI/issues/1455) and the Sprint 3 release audit. It does not change a Tooltip guarantee or accept the native journey.

## Retained failure and responsibility

Full CI [job 137199303993](https://github.com/Proto-UI/Proto-UI/actions/runs/45018250847/job/137199303993), at `830287f95959a4a1a4fb797df68b0bd6889e0bae`, collected all 20 cases in `apps/www/src/content/docs/zh-cn/contrast-tooltip-warm-handoff.browser.test.ts`. Every case stopped at `compileTooltipWarmHandoffPlan` with `Audited preview must declare distinct supported runtime identities.` The cold/warm input, physical owner, paint and negative-control assertions were not reached. These are 20 failed prerequisites, not successful native checks.

Both public Brutalist Tooltip pages declare `wc`, `react`, `vue` and `vue2`. The planner still supplied only `wc`, `react` and `vue` as supported identities to the existing parser. Because the planner validates the complete page declaration before selecting a case, the additional real Vue 2 entry rejected every case, including WC and React. This planner source was unchanged between the failed CI source and the repair base `27e5d366076280a17b6ffb5e61b9b7abe0461553`.

The repair adds Vue 2 to this consumer's supported identities. The parser still rejects empty, duplicate and unknown identities. It still derives cells only from the served declaration; there is no fallback to a global host list. The related hard-coded inventory in `apps/www/test/contrast-projection-identity.test.ts` is a separate website reconciliation.

## Distinguishing controls

The added Node controls read each actual EN/ZH MDX declaration and import the original `demo-brutalist-tooltip.demo.ts`. With the old planner, both controls failed for the same unsupported-runtime reason as CI. After the repair, each produces four hosts × two themes. The actual 500 ms cold delay, zero close delay, 300 ms warm window and 300 ms native observation allowance remain unchanged. The original native suite is unchanged.

| Check | Result | Meaning |
| --- | --- | --- |
| New page/recipe checks against old planner | 7 passed, 2 failed; exit 1 | Both real page declarations expose the stale support list. |
| Repaired handoff and original audit-plan Node suites | 81 passed, 0 failed, 0 skipped; exit 0 | Planner admission, finite scope and failure sequencing work at this candidate. |
| Original 20 native cases after repair | Pending | Parent-owned same-source browser execution is still required. |

The focused command is:

```sh
node --test apps/www/scripts/contrast-tooltip-handoff.test.mjs apps/www/scripts/contrast-audit-plan.test.mjs
```

Local execution used Node `24.22.3`. Evidence is retained under `/workspace/scratch/828b7e591003/s3-tooltip-native-entry-evidence/`:

- `handoff-old-source.log`: SHA-256 `2a542c958f2332cea543f847537f01d68724b44d7a9161b57179cc8059761f1f`.
- `handoff-fixed-source.log`: SHA-256 `92b3b7214e5afc16cc7cc293b278f4c414755b1e2920c1abcdf061b27caef245`.
- `handoff-final-formatted.log`: SHA-256 `d20dead8054db34186c99568ecf38fbd47001ce82792a35c3399b7d031068008`; the same selected suites rerun after repository formatting.

The applicable Group delay, warmth and lifetime entities remain draft: `P-BASE-TOOLTIP-GROUP`, `P-BRUTALIST-TOOLTIP` and `T-BRUTALIST-TOOLTIP-0001`. No source guarantee, timing threshold, owner requirement or native assertion was relaxed. A source/planner pass is not browser accessibility, physical assistive-technology or actual application-adoption evidence. The separate Base Tooltip React readiness failure and Drawer public-entry failures are not resolved by this change.
