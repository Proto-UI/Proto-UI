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

## Per-commit development progress

Prepare one progress report for each development commit pushed to a PR, including every development SHA in a multi-commit push. Confirm the commit reached the intended remote PR. Include its full SHA and link, what changed and why, validation results, and unresolved work. Preserve failures, skipped checks, and limitations alongside later successful reruns.

For UI changes, attach one or more real captures of the effect at that revision, labeled with route/state, runtime or Adapter, viewport dimensions, and theme. Identify a comparison baseline separately. Pure logic changes use executable test results and the relevant internal walkthrough instead of an invented UI screenshot. If evidence or an upload is unavailable, or checks are running, report `pending` with a reason and next action; complete the same comment when the evidence is verified. Retain the earlier failure and identify the completion update. An old image, mockup, or local file cannot stand in for a newly uploaded capture of the stated revision.

Keep one comment per commit using a stable marker such as `<!-- agent-commit-progress:OWNER/REPO#PR:FULL_SHA -->` and the returned comment ID/URL. Inspect the complete current discussion before posting; reuse equivalent existing evidence and update only the authorized Agent-owned comment after re-reading its latest body. Preserve human text. Conflicting markers, another author's comment, and uncertain write outcomes need reconciliation rather than duplicate comments or blind overwrites. Comment changes invalidate the previously collected review-input digest; recollect before review or integration.

This workflow grants no communication, upload, or storage authority. Check current authorization for the PR, content, and destination; otherwise retain the prepared report and name the blocked action. Publish only project material authorized for that audience. Keep private-project evidence in approved private destinations, and inspect page content, captions, URLs, captures, and logs for credentials or unrelated private material. The [upload guide](github-evidence-upload.md) describes mechanisms, not additional sharing permission.

## Review visual design from actual output

Use this method when a change affects how people perceive or use an interface. Scale the review to the affected surfaces and the user's goals; it is a set of design questions, not a fixed page recipe.

1. **Establish purpose.** Who is using the surface, what are they trying to do, and which content or action should they notice first? Prefer a working example or meaningful result that lets people assess product value. Ask what new fact, decision, or next action each passage adds; consolidate repeated definitions and defensive descriptions of what the product is not. Keep material constraints and risks visible where they affect a decision, using progressive disclosure for secondary explanation. Preserve established product and content decisions; separate a proposed change to those decisions from a layout correction.
2. **Choose relevant references.** Inspect current examples from the applicable design language and cite the principle being applied. Compare task, platform, density, and interaction context before borrowing a treatment. Use [shadcn's component examples](https://ui.shadcn.com/docs/components) and [semantic theming](https://ui.shadcn.com/docs/theming) for its family, [Kill AI Slop's principles](https://killaislop.com/#principles) as diagnostic questions, and [Apple HIG layout](https://developer.apple.com/design/human-interface-guidelines/layout) and [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) where relevant. These references inform judgment; they do not override project semantics or make Apple-platform point sizes, materials, or native conventions Web requirements.
3. **Inspect the composition.** Open the final rendered captures. What holds visual attention? Assess hierarchy, proportion, density, alignment, typography, spacing rhythm, control affordances, and token relationships in specific regions. Does grouping convey useful relationships, or add decoration that competes with content? Would progressive disclosure help without hiding a primary task? Name the region, observation, user consequence, and correction rather than returning generic principles or an unsupported aesthetic verdict.
4. **Check coherence and identity.** Compare related surfaces and states for consistent navigation, terminology, typography, spacing, and control treatment. Group comparisons by semantic role and task: related controls should have coherent targets, spacing, and state feedback, while different importance or usage can justify different treatment. Distinguish a brand glyph's artwork from the surrounding control shell and hit target. Share useful conventions without flattening distinct design-language identities. For repeated source/command views, compare one shared presentation grammar: meaningful metadata, toolbar density, control baseline and placement, source typography, frame boundaries, overflow and focus visibility. Remove imitation window controls when they have no action or state. Preserve useful differences such as filenames and package-manager choices; consistency does not require an empty title row everywhere. Compress extra padding before reducing an interactive target. Keep native source semantics, highlighting and exact command payloads with their owners, and distinguish a passive frame migration from an unfinished command/selection migration.
5. **Trace the design-system implementation.** When demonstrating a design system, reuse its actual components and behavior; reproducing their shell in site HTML/CSS does not demonstrate that system. Start with existing Proto UI components, compositions, and supported styling inputs. If the task exposes a necessary gap, route the smallest reusable Prototype or extension through its existing semantic and implementation gates, then use it in the product; do not add unrelated capabilities to justify a new component. Separate page layout, typography, and brand artwork from component-owned appearance and state. Put component visual changes in their owning implementation or supported inputs. Identify intentional native recipes and preserve their semantics; visual resemblance proves neither Prototype provenance nor interaction parity.
6. **Check adaptation and access.** Sample the supported screen-size and theme range, including mobile/desktop and light/dark when offered; account for relevant locales, text expansion, and zoom. Inspect both resting and meaningful active states. Verify actual target geometry, labels, focus, keyboard behavior, contrast, and reduced-motion behavior where affected against applicable platform or Web criteria. A screenshot, zero overflow, or a passing interaction test alone cannot establish all of these.
7. **Iterate and report separately.** Record functional results, accessibility evidence, and visual findings as separate judgments. A green functional test does not close a hierarchy or composition finding. Make the scoped correction, rerun affected behavior, and inspect fresh captures of the final candidate. Keep remaining tradeoffs and missing evidence explicit, with the next action; retain earlier failures and revision bindings rather than presenting an old capture as a new result.

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
