# Same-head review-input delta preparation

`review-delta.mjs` prepares a new review candidate when canonical input changes on the same base/head. It reports every added, edited and removed material with its original ID, both literal versions and both digests. The existing canonical v5 input, schema v2 packet, cumulative finding checks, trusted CI/DCO policy and live publication preflight remain authoritative.

This tool is read-only. It emits JSON to stdout, does not submit reviews or merges, and provides no approval or publication credit. Captures are saved evidence, not signed attestations. A candidate still needs an independent full judgment and the existing fresh live submission preflight. Retention does not assert freshness.

## Capture complete inputs

Use Node24 and the existing authenticated `gh` transport. `capture` invokes only the existing read-only collector, including its bounded pagination, independent counts, nested replies, current reviewer permissions and two complete stable scans. It records the exact ordered API arguments/responses with the canonical input. Do not discard or rewrite the original capture when later input arrives.

```sh
node scripts/agent-operations/review-delta.mjs capture \
  --repository github.com:Proto-UI/Proto-UI --pull-request 487 > I0.collection.json
# Complete the original independent review and retain its actual prior.packet.json.
# After real same-head input changes:
node scripts/agent-operations/review-delta.mjs capture \
  --repository github.com:Proto-UI/Proto-UI --pull-request 487 > I1.collection.json
node scripts/agent-operations/review-delta.mjs plan \
  --before I0.collection.json --after I1.collection.json \
  --prior-packet prior.packet.json > delta.plan.json
```

The target number above is a command example, not authorization to review or mutate that PR. Use the actual assigned target and original packet. `--external-evidence evidence.json` carries the existing canonical evidence array through collection. Preserve the same evidence unless its actual source changes; such changes appear in the delta.

`plan` also accepts two bare canonical v5 input files. They remain useful for inspecting historical deltas, but a schema-valid file alone does not prove complete collection. Without both full collector replays the report marks `complete-collection-unverified`, and reconciliation cannot emit a candidate. Legacy v3/v4 inputs require genuine current recollection; the helper does not upgrade them or invent missing identities.

The input/delta IDs come from existing canonical identities. Check identity is `[name, detailsUrl]` because canonical v5 has no native check ID. Repeated paths, repeated external source locators and ambiguous check keys fail closed. A rerun with another URL is a removal/addition; provider/workflow edits at the same key remain visible modifications. Replies retain their original thread identity. No author, Bot, keyword or passive-comment filter removes material.

## Review and retain scope explicitly

The plan binds both canonical digests and the prior packet digest. It includes original scope strings, affected entities/surfaces, finding IDs and the prior reconciliation chain, plus pending limitations, unknowns and human gates. Each delta initially suggests all prior scopes; the helper does not infer semantic ownership from filenames or prose.

Save a reviewer decision file with this shape. Values such as `planDigest` and `deltaId` must come from the actual plan; the abbreviated values below are explanatory, not valid artifacts.

```json
{
  "schemaVersion": 1,
  "kind": "proto-ui.review-delta-decisions",
  "planDigest": "<actual planDigest>",
  "reviewer": "<actual current independent reviewer login>",
  "observedAt": "<actual RFC3339 judgment time>",
  "recommendedAction": "COMMENT",
  "deltaDispositions": [
    {
      "deltaId": "<actual delta id>",
      "classification": "status-only",
      "action": "retain",
      "scopeIds": [],
      "rationale": "<what was inspected and why all prior scopes/materials remain applicable>"
    }
  ],
  "scopeReviews": [],
  "packetUpdates": {},
  "findingChanges": { "added": [], "updated": [], "resolved": [] },
  "workLog": {
    "manualPacketFieldsReentered": 0,
    "repeatedMaterialReads": 0,
    "testExecutions": 0,
    "note": "<actual reviewer action log and how these counts were obtained>"
  }
}
```

Every delta needs exactly one content-bound disposition and rationale. An added or edited discussion item can retain all scopes only after the reviewer explicitly classifies its complete content as `status-only` and declares no affected scopes. This is a reviewer judgment, never an automated relevance proof. A defect or changed requirement must use `reopen` with the existing affected scope IDs. Missing dispositions leave those scopes pending and produce no candidate.

Classifications are `status-only`, `defect`, `acceptance-change`, `evidence-withdrawal`, `review-material`, `check-change`, `permission-change`, `thread-change` and `provenance-change`. Material removal, external evidence changes, reviews, acceptance metadata, checks, permission changes and unresolved/reopened threads require renewed scope review. Failed/unknown trusted checks or DCO, lost/downgraded reviewer permissions and changed provider/workflow provenance block incremental candidate generation. Source-file/commit changes or any repository/PR/base-ref/base/head change return `requires-rescope`.

For each reopened scope, supply a completed review:

```json
{
  "scopeId": "<exact original scope string>",
  "rationale": "<current evidence and independent result within that scope>",
  "materialIds": ["<actual inspected material ID from the input or retained delta>"],
  "findingIds": ["<current finding IDs established or rechecked by this review>"]
}
```

`scopeReviews` cite current materials or the retained literal withdrawn material. A reviewer-classified defect requires a current finding in an affected reviewed scope. An unfinished scope leaves the candidate absent. The caller can save the plan/partial decisions and continue later without manually reconstructing the prior packet.

Use `findingChanges.added` and `.updated` for complete existing-format findings. Updates retain the original finding ID/file/line/authority/expected behavior; another defect needs a distinct ID. `resolved` entries contain `{id, rationale, scopeIds}` and require completed reopened scopes. All other prior findings remain open. New IDs cannot reuse a current or immediately recorded historical finding ID. The new packet points at the exact prior packet/head, so earlier packets and their literal history must remain available; the helper does not flatten or replace that ancestry.

`packetUpdates` may replace only `affectedEntities`, `affectedSurfaces`, `validation`, `agentEvidence`, `limitations`, `unknowns` and `humanGates`, after scope reopening. Binding, review class and original scope cannot be retargeted. Historical source/receipt evidence stays in the immutable prior packet; an explicit new evidence decision does not rewrite its old bytes or hashes. Prior limitations, unknowns and human gates cannot be silently removed by this incremental helper. Resolving those original pending items needs their ordinary evidence/decision path.

## Reconcile against another complete current observation

```sh
node scripts/agent-operations/review-delta.mjs capture \
  --repository github.com:Proto-UI/Proto-UI --pull-request 487 > current.collection.json
# Finish the review decisions after this observation, using its actual time.
node scripts/agent-operations/review-delta.mjs reconcile \
  --before I0.collection.json --after I1.collection.json \
  --prior-packet prior.packet.json --decisions delta.decisions.json \
  --current current.collection.json > delta.result.json
```

The command replays all collection records through the existing collector in memory. It requires current input to equal I1 exactly and current reviewer identity/permission to remain consistent. Decisions bind the exact plan digest and cannot predate the supplied current observation. A further same-head edit requires a new plan; a saved current capture is not a guarantee against a later live change. The existing submission writer still owns that final live check and all authorization, contributor-independence, CI/DCO, original publication and unknown-write-outcome rules.

Successful reconciliation outputs a complete `candidate` in the unchanged schema v2 review-packet format. The explicit final reviewer action replaces the old action; the helper never chooses an approval. The candidate preserves untouched fields and material, accumulates prior findings, and passes the existing canonical packet and reconciliation validators. It is not an independent review by the helper, a handoff granting permission, a new formal receipt, or a merge-ready claim. A prior published approval cannot authenticate the changed candidate as that old approval.

`plan` exits0 when the report is available, including no-change, blocked and rescope reports. `reconcile` exits0 for a candidate or no-change; no-change emits no packet. It exits2 for a valid but incomplete/blocked/rescope result, and exits1 for malformed, ambiguous or mismatched inputs. Unknown options reject. All original inputs remain unchanged.

The result records supplied packet-field/finding-change counts, explicit delta decisions and unchanged-material count. Human packet reentry, repeated material reads and test executions are reviewer-reported in `workLog`, clearly separated from instrumented counts. The helper launches no product tests. A measured positive control must retain the actual invocation, input/source digests, reviewer action log and resulting packet; the source implementation alone is no measured work-saving claim.

## Acceptance controls

Run `node --test scripts/agent-operations/test/review-delta.test.mjs` for deterministic injected collector/CLI controls. Set `PUI_REVIEW_DELTA_EVIDENCE_DIR` to an owned evidence directory to retain each actual CLI invocation, source/input SHA-256 map, complete before/after/current inputs, decisions, stdout and stderr. Without that option the suite removes its temporary control files. The positive control adds one status note, retains two original scopes and the original finding/evidence without packet-field reentry, and checks the new candidate against existing review consumers. Negative controls cover a real-defect disposition, withdrawn evidence, acceptance changes, unfinished scope, failed/unknown CI and DCO, permission loss, reopened threads, changed provenance, stale plans, concurrent same-head edits, changed base/head/source membership, ambiguous IDs and incomplete pagination. These transport fixtures are deliberately injected; they are not live GitHub observations or product/native/UI proof.

Main must separately execute the serial source-bound controls and a genuine collected-input/actual reviewer scenario, inspect the complete I0→I1 material and scope transitions, and obtain independent review before original Issue840 closure. No product/browser surface is changed, so the relevant visual review is the actual internal state/material walkthrough, not a screenshot of prose or logs. The historical Nov6 0.4 deferral remains historical and is not changed into 0.3 release acceptance.
