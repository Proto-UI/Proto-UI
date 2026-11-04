# 0.3 release scope, delivery stages and regression governance

This plan records the owner's 2026-11-04 direction for the November 2026 release. It changes release prioritization and development cadence, not entity lifecycle, contribution rights or publication permission. The ordinary [release workflow](release-workflow.md) still governs version stamping, rehearsal, protected publication and immutable readback.

## Dates and deliverables

All milestone deadlines below use Asia/Shanghai (UTC+08:00). They are targets with explicit blocker reporting, not claims that unfinished work has passed.

| Deadline / interval | Stage | Required output / allowed work |
| --- | --- | --- |
| 2026-11-04, 23:59 | Release-list production | Publish the first source-bound 0.3 inventory: every supported prototype in the four committed families, every applicable Finf V2 promise, www/CLI delivery, original Issue criteria, owner, acceptance, dependencies, stage and remaining work. Record coverage gaps rather than calling a partial inventory complete. |
| 2026-11-05–2026-11-08, 23:59 | Feature completion and integration | Complete the admitted 0.3 promises, repair interaction defects, review/fix current PRs, and land independently reviewable slices on main. Target: all admitted feature work on main before Monday 2026-11-09. |
| 2026-11-09–2026-11-22 | Acceptance and maintenance | No new product features. Continue regression repairs, accessibility/interaction fixes, compatibility, documentation correction, packaging and evidence collection for the frozen scope. A missing committed capability is a release blocker, not permission to quietly reclassify it as complete or defer it. |
| 2026-11-23–2026-11-27 | Release-candidate acceptance | Bound a candidate to an exact main SHA; rehearse real installs, package/CLI consumers, four supported Web hosts, docs and relevant native interactions. Only blocker fixes and their verification; rebuild/rebind a candidate after any change. |
| 2026-11-28–2026-11-30 | Final release decision | Reconcile the BOM, registry prerequisites, release notes, spec dispositions, open blockers and the final regression receipts. Target 0.3 publication: 2026-11-30. Publication remains protected and is not performed by this plan. |

At each boundary record actual state. If the feature deadline is missed, pause feature intake, publish the exact missing criteria and owner, and repair the blockers. Never turn a calendar target into an acceptance waiver. A release-date change or removal of an admitted promise requires the owner's explicit decision.

## 0.3 commitment boundary

The concrete [delivery list](release-0.3-list.md) and [source-bound ledger](release-0.3-source-ledger.json) retain exported identities and the original Finf criteria. Enumeration is not acceptance; current evidence and independently completed child criteria are tracked separately.

The committed Prototype libraries are **Base, Shadcn, Brutalist (the repository identity for neo-brutalism), and Lucide**. Include all their currently supported/exported prototypes and all additional support already promised for these areas in Finf V2. Include their authored combinations and the interaction, focus, keyboard, controlled-state, lifecycle, accessibility and styling repairs needed for real consumption.

The delivery surface also includes:

- **www:** all supported and Finf V2-promised capabilities applicable to those four families: discoverable documentation, real previews and code, runtime switching, navigation/search, responsive interaction and public install/usage paths. Distinguish site-owned composition from Prototype behavior.
- **CLI:** existing and Finf V2-promised initialization, add/facade generation, exact-version installation, finite style/token closure, generated artifacts and packed consumer delivery needed for the committed families.
- **Prerequisites:** core, Runtime, Modules, Adapters, compiler/export/build paths required to deliver the committed surfaces. Their bugs cannot be deferred merely because their package names are not listed above. The existing supported Web-host commitments remain in force.

A family being in 0.3 is a delivery obligation, not an automatic promotion of its draft spec entities. Review and resolve each actual lifecycle/evidence gap under the existing catalog rules.

**Other UI libraries are WIP / Experimental and are not 0.3 release promises.** Preserve their source, documentation and valid historical evidence; clearly label their public entry points and metadata. Bootstrap 2.3.2, Liquid Glass and any other unlisted family must not be counted as stable 0.3 coverage. Do not silently delete their contribution history, change global package lockstep, or expand a publish set without the ordinary release controls.

## Splitting Finf V2 without losing source criteria

Maintain one source-bound ledger for the split, linked from Finf V2 #890. Each row retains the original Issue/comment URL, a stable criterion key and complete source wording. Add these fields rather than replacing history:

- release disposition: `0.3`, `0.4`, `split` (known requirements in both releases), or `criterion-split` (mixed source conditions still requiring criterion-level reconciliation);
- reason, affected family/surface and prerequisite links;
- owner, bounded acceptance and exact validation route;
- development state, integration SHA, acceptance state and evidence URLs;
- blocker and next executable action, if any.

Use `0.3` for the commitment above and its required prerequisites. Use `0.4` for independent additions outside that boundary, including other-library work and independent experimental targets that are not prerequisites for 0.3. Mixed Issues must be split by criterion: do not move an entire Issue by title when it contains both releases. Retain old unresolved threads and decisions. A deferred criterion is not completed; an actually completed subcriterion is checked even when another release or family remains open.

## CI cadence and queue control

The implementation and event inventory live in [CI/CD](ci-cd.md). The policy is:

1. No push-triggered regression fan-out. Full regression runs in three daily slots, UTC **00:00 / 08:00 / 16:00** (Asia/Shanghai **08:00 / 16:00 / 00:00**). GitHub cron is best-effort; record scheduled and actual start times, and detect a missed cycle. Do not promise an exact wall-clock start from GitHub scheduling alone.
2. Keep manual targeted diagnosis and release rehearsal available. Never schedule publication, deployment, access or secret mutations as a side effect of a regression cycle.
3. Use a single coordinated regression cycle and bounded job parallelism rather than dozens of independent schedules. Retain lightweight attribution/merge checks where required. Avoid converting the push flood into an equally large per-PR flood.
4. Each cycle records one exact source revision, selected inventory, outcomes, failed/skipped/not-run suites, evidence artifacts and queue delay. A workflow that never started is unknown, not passing. A green old SHA is not green evidence for a new SHA.
5. Coalesce duplicate queued cycles on the same unchanged source. Do not kill an active evidence-producing run to admit new feature work. Queue recovery operates only on identified regression runs; never cancel release/production workflows or another owner's diagnostic without authority.

Per-change development validation and scheduled integration acceptance are separate. A PR supplies proportional focused consumer smoke, relevant type/package checks, independent exact-head review, genuine DCO/rights and the actual platform-required gates. It does not need to request a second full regression fan-out on every push. Reused scheduled baseline evidence names its exact SHA and the reviewed delta; it is not relabeled as a full run of the new head. Defect fixes can continue during a red or queued cycle. This policy grants no approval bypass and does not turn unknown in-scope behavior into a pass.

### Red-light and recovery rules

The goal is to stop accumulating unknown regressions, not stop useful repair work.

| Observation | Immediate rule | Resume condition |
| --- | --- | --- |
| New deterministic P0/P1 regression, security/rights problem, broken install/build/CLI baseline, or destructive lifecycle defect | Pause new feature intake and unrelated feature integration in the affected scope. Preserve the failing assertion, create/claim one repair task, continue diagnosis and fixes. Release-wide failures pause all feature integration. | Reviewed fix integrated; original discriminating case and affected checks pass on the current integration source. |
| A required full cycle fails or never completes | Triage in the same cycle: separate product regression, harness/setup defect, resource/queue failure and unsupported observation. Keep actual failed status and full suite inventory. | A valid complete cycle on the repaired source, or a separately documented owner decision about the exact remaining criteria. |
| Two successive planned cycles are red/unknown, or no valid complete baseline for 24 hours | Enter repair-only mode repository-wide. No new feature PRs enter the integration queue; allow defect fixes, CI recovery, evidence, documentation correction and protected security work. | Two successive valid complete scheduled cycles without new unresolved blocking regressions. |
| A cycle is still queued after 60 minutes, or a planned slot was missed | Record infrastructure incident and stop adding duplicate broad runs. Diagnose capacity and runner eligibility. Do not classify queue delay as a product regression or fabricate green receipts. | One identified current-source cycle starts and finishes, with backlog recovery recorded. |
| Known inherited failures | Retain original failed rows and owners; compare failure identities and source conditions, not counts alone. They remain acceptance work, not permanent waivers. | Original criteria repaired and verified, or explicitly dispositioned by the owner with provenance. |

After 2026-11-08 feature work stays frozen even when regression is green. Green permits the next maintenance/acceptance task, not automatic feature expansion. At release-candidate stage any blocker resets candidate acceptance to the actual new SHA; fixes remain allowed.

Start the cadence's elapsed-time and successive-cycle counters when this policy is activated; retain and triage historical failures immediately, but do not invent missed scheduled slots before the schedule existed. The first cycle establishes the measured initial state rather than declaring inherited red checks waived.

## Development completion versus release acceptance

Track the two states independently; neither may erase the other.

- **Development complete:** the named bounded behavior is implemented, its required discriminating validation ran, substantive review findings are addressed, and the reviewed change is integrated under the applicable rules. Check that bounded development checkbox immediately, with the PR/merge SHA and evidence.
- **Acceptance complete:** the named release criterion has the required consumer, interaction, host, accessibility, package and regression evidence for its actual source. Check that acceptance checkbox when this evidence exists.
- **Umbrella closure:** close the umbrella only when every retained criterion is complete or explicitly dispositioned. Keep it open without undoing completed subcheckboxes.

If one checkbox mixes implemented behavior with a larger host/family/native obligation, preserve its full original condition and expose independently addressable child checkboxes. Check the satisfied children promptly; give each unsatisfied child its own owner and next action. Do not repeatedly write “cannot count as complete” instead of performing reachable work, but do not mark missing evidence as passed.

## Execution and safety

Use a small active portfolio, one integration owner and serialized heavyweight validation. Independent PR review may run in bounded parallel groups; each review binds the exact head and all substantive findings. Fix dependency stacks bottom-up and preserve authorship/DCO. A draft or historical red check is not automatic proof that nothing is actionable. Conversely, speed and a calendar deadline do not authorize self-approval, invented evidence, blind conflict resolution, admin bypass or publication.

During this release batch, keep at most four active delegated tasks after intake, with disjoint worktrees/files and no nested fan-out; run one heavyweight validation per shared host at a time. Prefer the owner's available cost-effective models, but record an exhausted quota once and choose an available fallback rather than respawning the same failing model across a new batch. Report actual model/tool availability without claiming authenticated backend identity. Credentials stay outside prompts, repository artifacts, evidence packets and logs; resource authority is not permission to disclose secrets or bypass review.

The development Skill entry remains `pui-dev`; its leaves apply this plan and update the actual Issue checkbox at each bounded completion. The current user's authorization covers this portfolio of development, review, repair and integration, not release publication, deployment or ruleset/access changes.
