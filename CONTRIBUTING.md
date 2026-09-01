# Contributing to Proto UI

Proto UI accepts work from first-time contributors, experienced implementers, documentation authors, researchers, and people working on the protocol itself. This is the canonical human workflow for choosing, claiming, developing, validating, and submitting a change.

Product semantics remain governed by the applicable entities under `spec/**`. The detailed collaboration policy lives in `internal/governance/collaboration-model.md`. Agents have a separate entry in `AGENTS.md`.

## Choose work that is ready

Effort and readiness are separate.

| Readiness | Meaning | How to proceed |
| --- | --- | --- |
| Starter | The result is fixed and requires little Proto UI judgment | Claim the bounded task and follow its acceptance criteria |
| Contributor-ready | Semantics are decided, although implementation may be substantial | Confirm the scope, evidence, and allowed decisions before starting |
| Decision-needed | Existing authority leaves a material semantic, ownership, compatibility, public-guarantee, or lifecycle choice open | Continue research, draft evidence, and reversible prototypes; request one focused product-direction decision before committing to the unresolved choice |

Fibonacci effort labels estimate the size and uncertainty of a reviewable change; they are not permission levels. Unassessed work starts with investigation, and work marked as needing a split becomes smaller coherent slices that Agents can claim independently.

`needs semantic decision` identifies one unresolved product choice; it does not block research, executable evidence, or other governed slices. Ready work may proceed at any priority—P0/P1/P2 orders attention and never acts as an authorization gate.

## Find the source of truth

Before editing:

1. Find the applicable entities under `spec/**`. Read lifecycle, criteria, relations, revisions, sources, open questions, and mapped tests.
2. Treat `active` as a current guarantee. Treat `draft` as cataloged direction, not a stable public promise. Follow deprecation and removal metadata.
3. Use `internal/contracts/**` for explanation or an uncataloged gap. It cannot override an applicable entity.
4. Use dated files under `internal/records/**` for observations and current engineering context. Records are not normative.
5. Treat implementation and tests as evidence. A mismatch with an applicable entity is drift, not an implicit amendment.
6. Treat README files, package prose, demos, and the website as reader projections.

Read `spec/README.md` before authoring an entity. Do not create an entity merely because a component name, file, package, token, or capability count exists. Model one coherent semantic slice with executable evidence.

When sources genuinely conflict, stop and state the exact contradiction. Do not choose the most convenient source in silence.

## Use GitHub surfaces for one job each

Use Discussions for questions and ideas that do not yet have a task boundary. A decision that changes implementation scope must move to an Issue, spec entity, dated record, or pull request.

Use an Issue for one trackable outcome. An implementation-ready Issue states:

- the problem or outcome;
- applicable authority and lifecycle;
- what is already decided;
- what the contributor may decide;
- exclusions;
- whether implementation may start;
- acceptance and validation boundaries;
- any genuinely unresolved product direction or privileged/irreversible operation; default to `none`.

Use a pull request for one reviewable integration unit. Use Actions for machine evidence. Use review for independent judgment. Passing tests and receiving approval answer different questions.

Milestones represent a release outcome or an independent program with completion conditions. They are not a Kanban status. A closed milestone with open work, or an open milestone with no remaining work, needs an audit.

The planned organization Project will become the operating board across repositories. Project fields will carry workflow position, readiness, priority, claim expiry, evidence progress, required Agent comprehension, and permission ceiling. Labels will remain stable searchable properties for work type, area, effort, readiness, and risk. The Project must never become a second product specification. Its field schema, transitions, synchronization, idempotency, rollback, and rollout gates are defined in `internal/governance/project-v2-design.md`.

Until the Project is operational, Issue state, comments, assignees, linked pull requests, review receipts, and current decisions are the live coordination record.

## Claim work

Before claiming an Issue, inspect:

- assignee and recent comments;
- linked open pull requests or branches;
- readiness and effort;
- applicable milestone and Project fields when available;
- acceptance criteria and exclusions;
- required review and validation.

Record your intended scope, planned evidence, and lease. When the live item is ready and unclaimed, post the claim and begin; release it automatically when the lease expires without activity or when the boundary changes.

An assignee is the current responsible person, but it is not the only occupation signal. Comments and linked work may show an active claim that has not been mirrored into assignment metadata.

## Set up the repository

Use Node.js 22 and the pnpm version declared in `package.json`.

```sh
corepack enable
corepack pnpm@10.32.1 install --frozen-lockfile
```

Create a short-lived branch from current `main`. Preserve unrelated worktree changes. Never edit generated artifacts by hand.

For the public docs and demos:

```sh
corepack pnpm@10.32.1 docs:dev
```

For a local Agent-oriented catalog projection:

```sh
corepack pnpm@10.32.1 spec:docs:agent
```

The generated `internal/agent/PROJECT-UNDERSTANDING.zh-CN.md` is disposable and Git-ignored.

## Dependencies and generated files

New dependencies are discouraged and must be discussed in an Issue before a pull request.

Generated files must be changed through their generator. When a check reports generated drift, update the governing source or generator and regenerate; do not hand-edit the projection. Keep unrelated user or generated changes out of the pull request.

## Deliver one coherent change

A fast change still needs one reviewable claim. Keep the authority, implementation, tests, generated projections, package surfaces, and affected public pages together when they realize the same semantic slice.

A normal delivery loop is:

1. Confirm the issue boundary and whether either of the two decision classes is actually present.
2. Trace authority, relations, consumers, negative boundaries, and evidence.
3. Add or identify focused evidence at the owning layer.
4. Implement the smallest complete slice.
5. Update generated projections through their generators.
6. Update public documentation when the reader or consumer surface changes.
7. Run focused checks before broader checks.
8. Review the actual diff against the original boundary.
9. Sign off each human-authored commit.
10. Open a pull request with exact evidence and provenance.

If implementation reveals an authority gap, continue the governed parts and raise one focused decision only for the new semantic identity, owner, public guarantee, compatibility choice, Host Capability contract, or lifecycle admission that existing sources cannot decide.

### Prototype and component work

Maintaining an existing Prototype is available when expected behavior is already governed. Add a regression at the owning layer and keep exports, CLI surfaces, tests, and public pages coherent.

A new Base slice may begin as a draft with its subject, information ownership, negative boundary, public surface, P/T evidence graph, and host prerequisites made explicit. Stable admission waits only when one of those product choices remains unresolved.

A design-language projection inherits Base semantics and owns only the governed presentation and compatibility delta. It must not take ownership of state, event, focus, accessibility, dismissal, or host behavior already owned elsewhere.

Every new public Prototype identity or anatomy family needs a reachable website page in the same change. The page consumes the real public package export and provides the applicable runtime previews.

### Module and Host Capability work

A Module owns portable semantics. Keep its author-facing facade, privilege-bearing port, declared dependencies, missing-capability behavior, and resource lifetime explicit.

A Host Capability expresses the smallest host responsibility required by portable semantics. Define availability, failure, replacement, cleanup, and realization fidelity. Do not leak raw host or framework objects into portable state.

Agents may develop draft Module or Host Capability identities with evidence. Activating a genuinely new public guarantee requires one independent product-direction decision.

### Adapter work

Adapter profile work is cataloged one reviewed Module slice at a time. Positive support, explicit omission, Host Capability provision, lifecycle translation, and executable evidence must stay honest.

An uncataloged Module is not implicitly supported or unsupported. Do not generate a complete matrix from package imports or directory structure.

A new Adapter proposal starts with research and a reversible vertical slice. When existing authority determines target scope, lifecycle, compatibility, dependencies, semantic ownership, and evidence, implementation proceeds automatically; only unresolved official identity or stable-conformance choices need a product-direction decision.

### Contract and spec work

Use a readable legacy contract only for explanation or an explicitly accepted uncataloged gap. It must state current authority and migration status. Stabilized semantics should move into spec entities rather than leaving a permanent shadow contract.

A spec brainstorm may produce draft entities, executable probes, and a decision packet. Separate facts, alternatives, recommendation, negative boundary, and evidence plan; ask only for the smallest product choice that evidence cannot settle.

## Validate proportionally

Run the smallest test that proves the affected rule, then expand along the affected graph.

Common checks include:

```sh
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:agent-operations
corepack pnpm@10.32.1 check:agent-doc
corepack pnpm@10.32.1 check:public-docs
corepack pnpm@10.32.1 test:public-docs
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 test
corepack pnpm@10.32.1 docs:build
```

Choose checks by the surfaces reached:

| Change | Minimum evidence |
| --- | --- |
| Documentation only | Links and paths, public-doc checks, affected routes, docs types or build |
| Spec graph | Schema and relation checks, affected catalog checks, generated projections, focused executable evidence |
| Runtime, Module, Adapter, or Prototype behavior | Failing-before focused test, affected integration tests, types, catalog, consumer or docs evidence |
| Package or CLI surface | Build, manifest and budget checks, affected consumer smoke |
| Release governance | Release scan, assets, rehearsal or stage checks named by the release workflow |

Run generators before their corresponding `--check` mode. Record exact commands and results. State what did not run and why.

Machine checks do not approve semantics. A manual preview does not replace an executable regression. A review approval does not prove the checked revision passed. Keep these evidence types separate.

## Contribution license, provenance, and DCO

Proto UI is currently licensed under the [MIT License](./LICENSE). You retain the copyright in contributions you create. By submitting a contribution, you represent that you have the right to provide it under the repository's current license. This policy does not require a copyright assignment.

Third-party material remains subject to its original license, attribution, notice, and other applicable requirements. Your contribution must identify and preserve those obligations.

Every human-authored commit must comply with the [Developer Certificate of Origin 1.1](./DCO.md) and needs its own valid `Signed-off-by` trailer. A pull request checkbox or comment does not replace commit sign-off.

Create a signed-off commit with:

```sh
git commit --signoff -m "feat: describe the change"
```

To sign off the latest existing commit:

```sh
git commit --amend --signoff --no-edit
git push --force-with-lease
```

To sign off multiple local commits that are not on `origin/main`:

```sh
git fetch origin
git rebase --signoff origin/main
git push --force-with-lease
```

A valid trailer has this form:

```text
Signed-off-by: Contributor Name <email@example.com>
```

The name and email must represent the person making the certification. A DCO sign-off is different from a cryptographic GPG or SSH commit signature. Do not copy another person's trailer or ask a maintainer to sign on your behalf. See the [contribution provenance policy](./internal/governance/contribution-provenance.md) for the individual remediation process for already-published unsigned commits.

The sign-off certifies the right to submit the contribution. It does not replace license review or source disclosure. Read the [contribution provenance policy](./internal/governance/contribution-provenance.md) before opening a pull request, and disclose:

- third-party source, version or commit, license, material used, and required attribution;
- material AI assistance, its scope, human review, and any third-party or private material provided to it;
- employer or client ownership considerations when relevant;
- exact validation performed.

Do not copy code from an upstream project merely because its behavior is useful. Establish license and provenance before adapting it.

## Pull request and acceptance

The pull request should contain:

- linked Issue or decision context;
- applicable entities, lifecycle, criteria, and tests;
- what was decided before the PR and what the PR decided;
- exclusions and residual risks;
- source-of-truth alignment;
- provenance and DCO state;
- focused, broader, manual, and omitted validation;
- public preview route when relevant.

Reviewers check the governed boundary, not only whether CI is green. They verify ownership, negative boundaries, cross-layer consumers, compatibility, public projections, provenance, and evidence truthfulness.

A new push invalidates stale acceptance. Resolve every review thread. Merge only the reviewed revision after the required checks pass.

## Regression, deployment, and release

A regression repair restores an already governed guarantee. It begins with a minimal reproduction and evidence that fails for the intended reason. If expected behavior is unclear, the task is semantic shaping rather than a bug fix.

Preview deployment is inspection evidence for one revision. It does not grant merge permission. Production deployment is an external fact and should be tied to the merged revision and monitored for regressions.

Release preparation and publication are separate:

1. Project authority records the exact global version and stage.
2. A reviewable candidate aligns Version identity, manifests, lockfile, notes, bill of materials, snapshot inputs, rehearsal, and dry-run evidence.
3. Publication runs manually from governed `main` through the release workflow.
4. A separate evidence change verifies registry, channel, integrity, tag, GitHub Release, assets, snapshot digest, workflow head, and deployments.

An Agent may prepare and audit every release phase within its current task and review ceiling, and active standing scope may mechanically merge an exact approved PR through `pui-integrate`. Publication, tagging, stable lifecycle activation, and partial-release recovery remain one explicit privileged operation backed by the recorded release decision and live permission.

## Contributor permissions

GitHub permission, Discord trust, Agent comprehension, task risk, and human authorization answer different questions. A score cannot grant GitHub permission or predict acceptance. Discord or Poppy trust matters only when work touches those community or Bot surfaces.

Read-only work may inspect and report. Triage supports reversible metadata within policy. Write supports feature branches and owned or explicitly authorized PR branches. Maintain can review and exact-head merge under active policy while still respecting independent evidence and release boundaries. Direct pushes to protected `main`, admin, access, secrets, application installation, rulesets, and branch protection remain privileged operations.

The Discord Bot's Community, Contributor, and Trusted levels are an entry and trust axis. They are not GitHub contributor roles.

## Agents

Agents start with `AGENTS.md` and `$pui-dev`. The entry skill reads the machine registry and loads one atomic skill at a time. Leaf skills are lazy and remain out of context until the current state transition requires them.

The resolver is deterministic: `pnpm agent:skill -- <leaf-id> --mode <execution-mode> --mode-source <trusted-source>` returns one eligible registered path or a blocked result, and `pnpm agent:skill -- --handoff <handoff.json>` validates the completed leaf before resolving at most one next step.

`pui-orient` records `human-assisted` when a current user is directing the work. Local assessment then helps the Agent narrow claims, add tests, request review, and state limitations; a low score does not block the work the user requested. `autonomous` is reserved for a maintainer-controlled invocation, schedule, or governed queue. In that mode a fresh unsigned U0-C4 self-result is a binding ceiling on task and review class.

Assessment calibrates autonomous scope; the current user or active standing policy supplies authorization. Ordinary local edits, tests, signed-off commits, authorized branch pushes, PR updates, review responses, ready-for-review, review dispositions, and exact-head integration continue without an online issuer or per-action prompt. `pui-collaborate` owns exact-target reversible collaboration updates, while `pui-review` and `pui-integrate` retain their stronger revision-bound disposition and merge primitives. Only unresolved product direction and privileged or irreversible operations stop for an attended decision.

For review, bind evidence to the repository, PR, base/head, PR author, full commit messages, every commit author/committer platform identity, changed files, reviews, conversations, check source/provider/repository/workflow provenance, checks, and evidence inspected through the canonical v4 digest. A new push or base retargeting makes the old packet stale; new same-head input permits a new packet, while an unchanged packet is a duplicate. CI success is useful evidence, but it is not an approval; DCO success proves sign-off status, not source/license provenance. Assessment never derives approval. `APPROVE` and `REQUEST_CHANGES` require a reviewer login distinct from the PR author and every commit author/committer login, with unavailable contributor identity failing closed. An authorized review write uses `submit-review` with `commit_id` bound to the packet head. An authorized integration uses `pui-integrate` and `merge-pull-request`, which separately rechecks trusted CI, trusted DCO, active review state, resolved threads, GitHub readiness, and sends `sha` equal to that exact head. Do not separate either preflight from a later unbound GitHub write.

The local Codex schedule has three `pending-runtime-identity` standing scopes. Until Poppy broker-verified workload identity is bound, the scheduled runner is limited to read-only observation and reconciliation; human-assisted work continues under explicit current-user authorization. After activation, `proto-ui-scheduled-review-v1` and `proto-ui-scheduled-merge-v1` still require their exact-head evidence, independent identities, trusted CI/DCO, live permission, and GitHub repository rules. These scopes apply to one local runner; wider concurrency adds service-side leases and stronger runtime attribution without narrowing single-runner work.

The full Agent policy is in `internal/agent-operations/contributor-agents.md`. The human-readable skill catalog is on the documentation site. Autonomous-maintenance experiments use `$pui-maintain` and its separate independence protocol; supported no-finding and rejected outcomes close through `pui-record`, not a fake remediation review.

## Communication

- [GitHub Issues](https://github.com/Proto-UI/Proto-UI/issues) hold bounded work.
- [GitHub Discussions](https://github.com/Proto-UI/Proto-UI/discussions) holds questions and ideas before they have an implementation boundary.
- [Discord](https://discord.gg/MrWQd7h34R) is useful for quick coordination.

Record implementation-changing conclusions back in the Issue, Discussion, spec entity, dated record, or pull request.
