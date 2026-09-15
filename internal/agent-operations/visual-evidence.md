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

For the test design behind state/input attribution, CSS ownership, native-input claims and actual runner coverage, read [testing-method.md](testing-method.md) when relevant. It complements this publication policy without adding human intake requirements.

| Subject | Agent supplies | Explicit limitation |
| --- | --- | --- |
| UI/interaction defect | Actual running component captures that visibly expose the fault, with initial/action/result states; video if motion matters; affected/fixed comparison for repair | Route, viewport, Adapter, input method and revision; a mockup, painted state badge, prose screenshot or log card is not component reproduction |
| Purely internal Runtime/state machine/CLI/build/API defect | Executed reproduction plus a measured variable list and state/sequence walkthrough explaining the first divergence and its consequence | Cite actual observation points and distinguish measured values from inference; a terminal dump or prose rendered into an image alone is insufficient. Do not invent a visible component failure |
| Architecture/spec/research/feature proposal | Subject-specific ownership/state/sequence diagram, comparison or annotated example, grounded in cited sources | Separate observed design, proposed design, unresolved decisions and assumptions |
| Docs/design/accessibility | Actual rendered page/example capture and relevant annotated comparison | Appearance alone does not prove protocol or all assistive-technology behavior |
| Governance/other non-UI work | Concrete workflow, scope/dependency map or captured command/report appropriate to the topic | No decorative stock image, title card or generic diagram to satisfy a quota |

For multi-state or interactive explanations, include a small reproducible **HTML artifact** when it materially helps review: source/download, instructions, dependencies and an uploaded static screenshot fallback. Mark simulations as simulations; rendering a model does not prove real component behavior. GitHub does not execute arbitrary attached HTML. State hosting/download/access limitations. Do not build an artifact for its own sake when simpler evidence suffices.

Never fabricate observations with image generation or replace deterministic reproduction with arbitrary timing delays. Keep diagrams minimal and useful, with event/state/owner labels traceable to evidence.

### Show the failure, then explain it

For a visible defect, run the affected component through its real implementation and capture the malfunction itself. Keep enough surrounding context to compare the initial and failing states. Do not manually change CSS, attributes, state or displayed values to manufacture the reported appearance. A controlled host or synthetic event may isolate a real code path, but disclose that boundary; it is not evidence of native input or every Adapter. If the actual failure cannot be captured, record the missing reproduction instead of substituting a report screenshot.

For a purely internal defect, write a technical walkthrough rather than a picture quota. Introduce the relevant owners and invariant, then explain the trigger, the first unexpected transition, why execution takes that branch, and the downstream consequence. Use only the variables needed to follow that story: their names, values before/after, owner or epoch, and the source location where they were observed. Align the variable list with actual event order, pending work and callback/lease identity when relevant. Provide a normal control when it distinguishes the cause. Clearly mark inferred causes or proposed transitions; link the executable reproduction and searchable raw data. A source-bound variable table and sequence visualization are valid internal evidence; merely reformatting assertions, JSON or Issue prose into a PNG is not.

Inspect every published figure as a reader: can the visible defect be located directly, or can an internal reader trace the measured divergence and its consequence without guessing? Images complement the explanation, not duplicate paragraphs. Rejected or superseded figures remain historical material, not completed evidence; correct the Agent's public claim and ledger explicitly.

## Soft gate and authority

Before Agent publication or a material update, inspect the paraphrase, scoped evidence and debt. Reuse verified uploads with links instead of reposting identical images on every minor reply. Missing evidence remains visible debt while useful authorized work proceeds; it is not a demand that the human do the work. Do not claim unsupported reproduction, completion or approval. Security, authorization, design and independent-review gates remain separate.

`pui-issue` and `pui-pr` report gaps read-only. This rule grants neither leaf permission to edit/comment. Uploads, comments, PR updates and asset pushes still require current authorization, live permission, exact target/scope, fresh state and idempotency. Follow the [gh evidence-upload tutorial](github-evidence-upload.md); do not infer Release or new-host publication permission.

The registered `pui-evidence-publish` transition consumes one Issue report, a prepared evidence-publication packet and exact mutation authorization, then publishes one additive comment or returns a no-write receipt. It reuses separately authorized, verified uploads; it does not create storage or prepare reproduction. `pui-select` carries an `evidence-assessment` into the exact approved `pui-claim` text. Review packet v2 carries `agentEvidence` into the head-bound review submission body, including an empty-finding review. Missing visuals may remain explicit partial/blocked debt in each path; neither the registry nor packet validation makes humans supply images.

## Historical backfill

For review packets, distinguish publication-only debt from missing verification within the declared review scope and work truly outside that scope (`debt.kind` in packet v2). Missing uploads do not by themselves block acceptance; unverified in-scope conclusions cannot satisfy the existing complete-review conditions. Do not relabel verification debt as publication or omit it from review limitations to obtain an approval. An authorized factual comment may disclose either kind while investigation continues.

Inventory open **and closed** Issues unless the user narrowed scope. Exhaust pagination and reconcile unique Issue URLs with the live total; distinguish Issues from PRs. A sample, recent page or open-only queue never satisfies an all-history request. Keep a resumable ledger: URL/state, request source, discussion-inspection status, existing evidence and quality, reproduction baseline/result, uploaded URLs, posted-comment receipt, missing work and next action. An image search in the body alone is triage, not proof that comments contain no evidence.

Do not count inventory, a generic image, a rejected packet, or a known reproduction gap as completed backfill. Report inspected, reproduced, published/verified and still-pending scopes separately. Keep already adequate evidence with verified links; do not post duplicate comments merely to increment a counter. Fixed or closed Issues remain in scope, while their original closure and acceptance remain unchanged.

Work serially in bounded batches. Read relevant discussions and existing assets, then reproduce. Preserve authors' text, intent, claims and closure history; append an attributed packet rather than rewriting a report. Do not reopen, close, label, assign or claim merely to backfill. Check a stable evidence marker before posting; read back an uncertain write before retrying.

For a fixed bug, use a safe recorded affected revision where feasible and compare the fixed revision. Current-main success does not disprove an old report. If the old environment is unavailable or unsafe, record that limitation and current observations, without marking it reproduced. Research diagrams illustrate cited facts/proposals, not fictitious defects. Unknown historical prompts remain unknown.

## Acceptance examples

- A human reports “the dialog jumps” without images: accept the report; Agent investigates and captures transitions.
- An Agent posts a screenshot of paragraphs, assertions or JSON about a visible bug: evidence is not a component reproduction; capture the actual failing component.
- A purely internal watcher failure has no visible component: collect variable values at the exception and subsequent dispatch, explain queue ownership and event order with a source-bound sequence, and retain raw traces as supporting data.
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
- Type: actual component capture / measured internal walkthrough / subject diagram / proposal / simulation.
- Uploaded images with alt text and captions:
- HTML source/download and static fallback, when useful:

### Coverage and follow-up

- Evidence disposition: complete for the stated scope / partial / blocked.
- Not demonstrated and reason:
- Next Agent action:
```
