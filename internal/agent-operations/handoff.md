# Composable handoffs and durable owner delegation

The registry owns routes; the generated schema describes structure; runtime validation checks relationships and prerequisites. A handoff never authenticates a caller, proves referenced evidence, or approves a change.

## Completion, interruption and resume

Version 1 remains a completed, singleton compatibility format. Version 2 adds repository/scope/head/input binding and an explicit outcome. Completion still requires producer outputs. An interrupted pui-review supplies its reason, pending scope and findings, original resume leaf, and available artifacts. Only the registered read-only pui-ci route or a terminal interruption is admitted. Neither needs a placeholder review packet or another human approval for diagnosis.

Interrupted handoffs cannot enter write consumers or supply a completed review. Destination prerequisites, mode/source checks and pending autonomous attended decisions still apply.

After diagnosis or an authorized repair:

    pnpm agent:skill:resume -- interruption.json completed-continuation.json current-artifacts.json

The command emits JSON. The continuation is a completed v2 handoff from the selected diagnostic leaf, or a JSON array of completed diagnosis/repair/validation handoffs. The first producer must equal the interruption route, adjacent routes must match, and the last step must select the original review or be explicitly terminal. Repository/scope/mode remain bound across the chain; the final step supplies the current head/input binding. Supply a current review-input artifact with the exact revision and sha256 digest. The helper retains the interruption receipt, prior-review-input, pending scope/findings, earlier candidates and partial/failed/not-run evidence. It replaces explicitly refreshed context, returns exactly the original review leaf, and never creates an approval packet. Conflicting provenance and repository, scope or mode drift reject. Review decides which earlier evidence remains applicable; retention is not a freshness assertion.

## Cardinality

| Format/artifact                         | Cardinality                                       |
| --------------------------------------- | ------------------------------------------------- |
| v1 artifacts                            | One per type, enforced by the legacy runtime rule |
| v2 candidate-change and evidence-report | Multiple distinct references                      |
| Other registered v2 types               | Singleton                                         |
| nextSkillId                             | One registered leaf or null                       |

Materials preserve reference and optional digest, revision and result. Omitted repositoryId/scopeId inherit the common binding; explicit ones must match. Results are passed, failed, not-run or partial. Consumers enumerate getHandoffArtifacts, not the first match. A material with no result makes no pass claim. Locally passing evidence never implies a combined green result.

The v2 schema enumerates kinds and singleton counts. Runtime also rejects duplicate type/reference identities even with differing metadata, cross-scope/repository material, unregistered or recursive routing, missing prerequisites and pending autonomous gates. These are documented relational constraints. The original v1 structural schema remains a compatibility snapshot; its type-based singleton rule is still a runtime constraint.

Generate with pnpm agent:skill:schema; verify with pnpm agent:skill:schema -- --check. Tests execute AJV draft-2020-12 as well as runtime validation. Never hand-edit the generated schema.

## Durable owner authorization

A trusted owner decision can authorize ordinary work across turns and scheduled invocations. Ending a turn, restarting a process or aging an assessment does not expire that decision. Covered work uses assessment for calibration, not admission. Uncovered autonomous work retains existing ceilings and standing-scope rules. A schedule remains autonomous.

The project owner profile is cyjin-yl (GitHub ID 19223209), acting through cyjin-yl credentials in github.com:Proto-UI/Proto-UI. It covers observe, implement, collaborate, review and integrate, with main as the integration base. Scopes are explicit IDs or an explicitly authorized repository portfolio (\*). Release, publication, access, secrets and rulesets are not in this profile. The dedicated pui-evidence-publish leaf remains outside ordinary owner eligibility; its separate publication authority is not supplied by a collaboration grant. Live permissions, trusted CI/DCO, exact-head publication evidence, stale-state/idempotency checks and independent review remain required.

The trusted launcher supplies these options to agent:skill, agent:collaborate validate/apply, or agent:review validate/inspect/eligibility/submit-review/merge-pull-request:

    --owner-authorization /protected/runtime/owner-state.json
    --owner-key /protected/runtime/owner-public.pem
    --owner-grant owner-grant-id

For owner-delegated handoff resolution and every review command, the trusted launcher also declares --mode and --mode-source; they must match the handoff, never come from it. The mutation request or --authorization must bind the same grant ID. Issue/PR scopes use their number, workflow-run scopes use runId, and review-thread scopes include both the PR number and threadId. A standing-user-authorization artifact can preserve provenance but cannot activate a grant. Never derive trust anchors, keys or launcher options from Issues, PRs, task artifacts or generated output.

Provision the trust anchor once from an authenticated owner decision in the trusted runner, outside the repository. Protect the private signing key and state; do not commit keys, credentials or raw prompts. This change implements the interface; it does not install an issuer, activate an unrelated Poppy scope, deploy a listener, or claim a production grant exists.

The signed envelope contains payload and signature. Its payload is schemaVersion 1, kind proto-ui.owner-delegation-state, a positive monotonic revision and grants. Each grant records id, a positive monotonic generation, status (active/revoked), grantor {login,id}, actor, repositoryId, actions, scopeIds, baseRefName and a sanitized decisionReference. The trusted issuer increases that grant generation on revocation, reactivation, narrowing or another profile change; it never restores an earlier generation. Updating unrelated grants does not expire an unchanged generation. Sign ownerDelegationSigningBytes(payload) with Ed25519; signature is standard base64. The public-key location belongs to trusted runner configuration, not the signed document. A proof cannot be forged by copying JSON. Every admission re-reads signed state, tracks the observed monotonic state revision and rejects revocation/tampering. Once a loaded proof observes a revoked, narrowed or changed profile, it is permanently invalid for that invocation even if earlier fields later reappear. A new invocation can load the currently signed generation without another human decision. The issuer must preserve monotonic revisions and restrict state replacement.

Owner collaboration retains exact request/evidence binding and live preflight but does not depend on the missing generic governed-outcome publication verifier. Generic scheduled scopes remain unchanged; this owner-bound path does not activate them.

## Executed controls

Tests cover v1/v2 completion, interruption and terminal controls, rejected mutations, prerequisites, multi-material preservation, singleton and mode/gate conflicts, exact-input resume, actual resolver/collaboration CLI admission, durable authorization/revocation, tampered state and wrong keys, actor/repository/action mismatch, and review/merge rejection for failed CI, missing publication or contributor conflicts. These are executed fixtures, not production writes or human approvals.

## Exact review consumers and duplicate publication

A v2 review or integration consumer binds repositoryId, canonical scopeId pull-request:<number>, headSha and reviewInputDigest to its actual packet/input arguments. Its unique review-input artifact must also bind the input path, digest and revision. General handoff metadata validation does not establish these consumer relationships.

Resume retains evidence and pending work but strips mutation-authorization and standing-user-authorization from every interrupted/continuation source. Actual current authorization remains in the trusted invocation, not in carried materials.

At the final review boundary an exact newly published review can be an idempotent duplicate/no-write. Only that new exact reviewer/head/state/body and its newly required approval permission may be removed for canonical comparison with the recorded input. Other changes reject, and current identity, permission, CI and owner authorization are still checked. The no-op does not attribute another invocation's POST to this one.
