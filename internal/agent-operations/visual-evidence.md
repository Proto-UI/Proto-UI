# Agent Issue and PR evidence

This is an **Agent-only soft gate** for every Issue or PR an Agent authors or materially advances, including human-authored items and historical backfill, in either execution mode. A current user's instruction to apply it immediately governs that Agent before the policy PR merges; an unmerged PR does not impose rules on unrelated contributors.

**Humans may report a symptom in plain language.** They do not have to reproduce it, upload images, create HTML artifacts, fill an Agent checklist, or disclose their prompts. The Agent owns this work. Never reject, close, downgrade, or delay human intake for missing Agent evidence. Do not introduce mandatory template fields or image-presence CI/merge blockers.

## Agent delivery

Use an `Agent evidence` section in the authored body or an additive follow-up comment. Preserve human text. Include:

1. **Request paraphrase:** a sanitized public restatement of the requested outcome and constraints, identified as the Agent's paraphrase. Link its public source when available. Separate the request from diagnosis, assumptions, and proposed solutions. If the original prompt is unavailable, say so and attribute the paraphrase to the actual Issue/maintainer discussion. Identify autonomous origins honestly; never invent a user request.
2. **Baseline and procedure:** commit/version, host/runtime/browser, fixture/page, exact steps or commands, and observation time. Separate expected behavior and its authority from observed behavior. For a PR, distinguish the failing baseline and candidate head, refreshing evidence affected by later pushes.
3. **Uploaded visuals:** readable subject-appropriate images with meaningful alt text, captions and verified accessible URLs. Show relevant initial/action/result states. A local path is not an upload. Link reproducible source, tests and searchable logs; images do not replace executable evidence.
4. **Coverage and debt:** state `complete` for the named evidence scope only, otherwise `partial` or `blocked`; list missing reproduction, hosts, states or uploads, the reason and the next Agent action. These are evidence dispositions, not Issue state or acceptance.

Inspect and sanitize paraphrases, screenshots, HTML, logs, paths and metadata before publication. Never disclose raw private conversations, hidden system/developer instructions, credentials, private endpoints, or unrelated personal data. Prefer re-capture after removing sensitive data; disclose redaction without changing the observation. This supplements [contribution provenance](../governance/contribution-provenance.md), not replaces it.

## Evidence by subject

| Subject | Agent supplies | Explicit limitation |
| --- | --- | --- |
| UI/interaction defect | Actual initial/action/result screenshots; video if motion matters; before/after for repair | Route, viewport, Adapter, input method and revision; a mockup is not reproduction |
| Runtime/state machine/CLI/build/API defect | Captured executed runner/terminal trace, deterministic fixture and raw output; state/sequence diagram when helpful | Label a rendered transcript as a transcript, not a native terminal or product UI screenshot; diagrams explain, not prove |
| Architecture/spec/research/feature proposal | Subject-specific ownership/state/sequence diagram, comparison or annotated example, grounded in cited sources | Separate observed design, proposed design, unresolved decisions and assumptions |
| Docs/design/accessibility | Actual rendered page/example capture and relevant annotated comparison | Appearance alone does not prove protocol or all assistive-technology behavior |
| Governance/other non-UI work | Concrete workflow, scope/dependency map or captured command/report appropriate to the topic | No decorative stock image, title card or generic diagram to satisfy a quota |

For multi-state or interactive explanations, include a small reproducible **HTML artifact** when it materially helps review: source/download, instructions, dependencies and an uploaded static screenshot fallback. Mark simulations as simulations; rendering a model does not prove real component behavior. GitHub does not execute arbitrary attached HTML. State hosting/download/access limitations. Do not build an artifact for its own sake when simpler evidence suffices.

Never fabricate observations with image generation or replace deterministic reproduction with arbitrary timing delays. Keep diagrams minimal and useful, with event/state/owner labels traceable to evidence.

## Soft gate and authority

Before Agent publication or a material update, inspect the paraphrase, scoped evidence and debt. Reuse verified uploads with links instead of reposting identical images on every minor reply. Missing evidence remains visible debt while useful authorized work proceeds; it is not a demand that the human do the work. Do not claim unsupported reproduction, completion or approval. Security, authorization, design and independent-review gates remain separate.

`pui-issue` and `pui-pr` report gaps read-only. This rule grants neither leaf permission to edit/comment. Uploads, comments, PR updates and asset pushes still require current authorization, live permission, exact target/scope, fresh state and idempotency. Follow the [gh evidence-upload tutorial](github-evidence-upload.md); do not infer Release or new-host publication permission.

## Historical backfill

Inventory open **and closed** Issues unless the user narrowed scope. Keep a resumable ledger: URL/state, request source, existing evidence, reproduction baseline/result, uploaded URLs, posted-comment receipt, missing work and next action. An image search in the body alone is triage, not proof that comments contain no evidence.

Work serially in bounded batches. Read relevant discussions and existing assets, then reproduce. Preserve authors' text, intent, claims and closure history; append an attributed packet rather than rewriting a report. Do not reopen, close, label, assign or claim merely to backfill. Check a stable evidence marker before posting; read back an uncertain write before retrying.

For a fixed bug, use a safe recorded affected revision where feasible and compare the fixed revision. Current-main success does not disprove an old report. If the old environment is unavailable or unsafe, record that limitation and current observations, without marking it reproduced. Research diagrams illustrate cited facts/proposals, not fictitious defects. Unknown historical prompts remain unknown.

## Acceptance examples

- A human reports “the dialog jumps” without images: accept the report; Agent investigates and captures transitions.
- An Agent posts a decorative diagram without running the alleged bug: evidence remains partial; obtain the executed trace.
- A human submits a plain-text PR: do not impose the Agent checklist on the person; the Agent can supplement it in its own follow-up.
- Agent upload fails: record public-asset debt and the next Agent action; neither a local path nor an inaccessible Gist counts as uploaded screenshot evidence.
- An old closed Issue is backfilled: retain its state and text; cite the actual source and distinguish historical/current evidence.

## Copyable Agent section

```markdown
## Agent evidence

### Request paraphrase

Agent's sanitized paraphrase with source attribution; state if the original prompt is unavailable.

### Reproduction or subject evidence

- Baseline / candidate / environment / observation time:
- Steps/command and fixture:
- Expected (authority) / observed:
- Type: actual UI capture / executed trace capture / diagram / proposal / simulation.
- Uploaded images with alt text and captions:
- HTML source/download and static fallback, when useful:

### Coverage and follow-up

- Evidence disposition: complete for the stated scope / partial / blocked.
- Not demonstrated and reason:
- Next Agent action:
```
