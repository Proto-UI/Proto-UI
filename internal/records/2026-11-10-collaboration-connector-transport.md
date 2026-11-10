# Collaboration connector transport candidate for #839

Date: 2026-11-10. Source base: `0607c6c5c386b8a932ab850e92a8873b2121dc45`. Issue: <https://github.com/Proto-UI/Proto-UI/issues/839>. This is an authored, unexecuted source candidate. Main owns application of shared changes, serial validation, independent review, any actual connector send, publication and integration. No product import, test, build, format, install, native instance, Git mutation or external write was performed by this owner.

## Authority and original scope

The current user explicitly assigned this bounded work in `human-assisted` / `current-user` mode. The live Issue is OPEN. Its two comments remain literal history: November 6 deferred this collaboration feature to 0.4; this change does not alter release classification. Live PR #773 is now MERGED at `8a1b56795051ec72782bcd7bc5976245616f831a`, authored by `guangliang2019`; its connector review worker is a transport precedent, not a grant of its identity or production review authority. #504 and #760 retain their parent/queue roles, #821's completed v2/owner-delegation work stays intact, and #825 remains unrelated package-budget work.

No applicable agent-collaboration transport entity was found in `spec/**`. Existing authority is `internal/agent-operations/contributor-agents.md` (connected publication and exact-action trust), `internal/agent-operations/handoff.md` (independent launch declarations and live owner revocation), and the ordinary `pui-collaborate` path. The source uses the existing canonical request digest, live collector, final authorization gate, writer and canonical receipt; it changes no authorization policy, artifact schema, owner proof or review-publisher scope.

## Source and consumer behavior

The new `scripts/agent-operations/connector-collaboration-transport.mjs` adapts the existing collector/writer's API runner to a trusted parent-owned connector bridge. The formal `--transport gh|connector` selector and its skill/handoff documentation are supplied as a separate unapplied Main integration patch, with exact preimages and hashes in the owner packet. Main explicitly retained those shared paths. The shared collector, admission and receipt implementation are unchanged.

The parent launches the ordinary CLI with independently supplied mode/source and owner-proof options, handles stderr `tool-call` JSON lines and returns the matching `tool-result` on stdin. Stdout remains the existing receipt or unknown result. `github-api` and `github-collaboration-capabilities` name launcher adapter operations: the actual parent must map them to real connected tools. They are not claims that every connector exposes a universal API tool. A task-authored JSON file cannot select this dispatcher. This transport envelope is neither an authorization protocol nor a second mutation receipt.

Capabilities disclose actual supported actions and required fields: authenticated viewer, repository permission, repository identity, target revision, complete pagination Link headers and raw mutation acknowledgment. Missing capability/field, invalid or mismatched result identity, missing HTTP status/body, wrong live repository, or unsupported action rejects before a write. The adapter first verifies the live repository `full_name`; the existing collector then obtains the real actor, permission and target state. A connector that cannot supply these observations has no admitted write path.

REST pagination follows every consecutive next link for the same exact collection and query, including a short first page. Missing Link metadata, skipped/repeated pages, duplicate item identities or a changed collection reject. The existing complete one-page review-thread comment restriction remains: more than 100 comments is unsupported and rejected, rather than silently truncated. The shared payload bound applies to both individual responses and the aggregate.

A normal operation reaches initial collection, final live admission, at most one write, then readback. An achieved state produces the existing zero-write no-op. The bridge consumes its write-attempt latch before dispatch, including when acknowledgment is lost or malformed; reconciliation stays on the same transport and uses the existing writer's read-only protocol. There is no automatic retry, access-denial fallback or cross-transport resend. This preserves the existing single-owner invocation model; it does not create global replay protection across unrelated processes. An unknown operation must be reconciled before a new invocation.

Only update-branch preserves a server-enforced `expected_head_sha`. Metadata, comments, ready-for-review, reviewer requests, thread resolution and workflow reruns retain their actual read-to-write race limits; no metadata timestamp check is described as CAS. Review requests remain reversible collaboration, not review disposition. Merge, independent acceptance, CI/DCO policy, protections and credential configuration remain outside this source change.

## Authored evidence; all unrun

`scripts/agent-operations/test/connector-collaboration.test.mjs` defines 29 planned offline consumer cases. The fixtures inject API observations and in-memory endpoint effects; they are not actual connector executions. Cases exercise:

- Formal CLI parity for gh and connector on metadata and bounded comments: resulting title/comment, canonical receipt, three live target observations, one write, and a duplicate zero-write no-op.
- Final-read permission, head, metadata revision and actor changes; a genuinely signed fixture owner grant revoked between initial and final admission; each must leave the original title unchanged with zero writes.
- Lost metadata/comment acknowledgment, one read-only reconciliation and no resend; incomplete pagination, skipped pages, changed collection and duplicate identities; missing capability/live identity and unbound bridge responses.
- All seven registered actions through the same collector/writer, including update-branch's server expected-head condition, complete thread revision and partial GraphQL-error rejection, ready on the exact draft head, later-page review contributors and a workflow's next attempt.
- Two real child-process bridge consumers using the default stdin/stderr transport, with injected successful and lost comment acknowledgments. These exercise the actual CLI pipe protocol while making no real service calls.

The Issue's historical parser failure is accepted without rerunning that control. On the assigned base, source inspection shows the formal parser still lacks `--transport`. Main's new paired consumer before producer runs the existing default gh control before its connector variant; retain its actual observations before applying the selector. A module-load or dependency failure is an environment failure, not the intended consumer red result.

## Original criterion accounting

The exact original Issue body, all five original compound checkbox clauses, two current comment IDs/bodies, parent/source keys and per-clause remaining work are retained in the owner packet. No checkbox was checked and the Issue was not closed.

1. Shared digest, mode/source, authorization and receipt: candidate reuses the existing path. Capability disclosure and unknown-field refusals are authored. Main must execute both transports and inspect actual results.
2. Trusted live actor/permission/repository/revision and final revalidation: candidate preserves the collector/gate and dynamic owner proof; fixture revocation coverage is authored. Real connected-tool identity and unsupported fields still need nonproduction observation.
3. Zero-write achieved state, at most one write/readback and unknown-result reconciliation without resend: authored normal, duplicate, loss and child-bridge consumers. Main execution and real connector evidence remain required.
4. Endpoint expected-head/race limits and changes/revocation/pagination/loss/duplicates/parity: source and planned cases cover these boundaries, with all old race semantics retained. No case is reported passing here.
5. Authorized nonproduction connector operation and reviewable real receipt: entirely unexecuted. Main must supply the actual connected dispatcher and an authorized exact nonproduction target. No production send is authorized by this packet.

The original Agent publication evidence debt also remains: Main must publish a source-bound technical walkthrough of measured state transitions and retained receipts. There is no visual product surface in this transport slice; prose/log screenshots do not substitute for executed internal evidence. No browser run or invented UI capture is appropriate.

## Main validation and continuation

The external owner packet contains exact serial commands, source/preimage hashes, the unapplied shared patch, a genuine metadata-admitted v2 `pui-regression -> pui-validate` handoff and proposed PR wording. Run the new paired consumer before producer first on the unchanged official callsite, apply/reconcile the three-file shared patch, then run the new 29-case file and existing collaboration-invocation, collaboration-runtime and owner-authorization suites serially. Follow the canonical AgentOps checks and formatting in Main's single heavy slot. Preserve actual collected counts, failures, skips and environment limitations.

After offline validation, exercise the actual supported connector on one separately authorized nonproduction target, retaining real capability fields, live actor/permission/target, final prewrite observation, actual acknowledgment and readback plus the canonical receipt. Inspect the target's resulting title/body or exact comment/revision through the real service. Missing connected-tool capability stays missing; it is not repaired by fixture data. Integration and earned Issue closure require that evidence and the repository's actual independent review, DCO, CI and ruleset admission. This owner remains available for Main validation/review repairs.
