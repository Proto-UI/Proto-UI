# Primitive specification discovery study (Round 1 preparation)

This directory freezes the public-development inputs for Issue #748. It is a study harness for measured semantic comparison, not a new benchmark track, product capability, release gate, or proof that an Agent did or did not rediscover Proto UI knowledge.

## Current study version

`discovery.study.json` records the selected public development cases, prompts, source snapshots, criterion reference IDs, limits, and repeated-run policy at repository revision `0607c6c5c386b8a932ab850e92a8873b2121dc45`. The selected set is:

| Parent public case | Discovery prompt | Frozen Proto reference boundary |
| --- | --- | --- |
| `dialog-open-close` | `prompts/dialog-open-close.txt` | `P-BASE-DIALOG` root/part catalog entities and `T-BASE-DIALOG-0001` |
| `tabs-manual-activation` | `prompts/tabs-manual-activation.txt` | `P-BASE-TABS` root/part catalog entities and `T-BASE-TABS-0001` |
| `select-keyboard` | `prompts/select-keyboard.txt` | `P-BASE-SELECT` root/part catalog entities and `T-BASE-SELECT-0001` |

Parent case IDs are reused only as stable development-case identities. Their fixture implementation and public native checks are **not** the study's Proto oracle. The native select fixture commits during keyboard navigation and must not be treated as parity for the popup navigation/commit boundary. No source in this directory is held out.

## Execution protocol

1. Produce a frozen archive:
   ```sh
   node scripts/benchmark/discovery-study.mjs freeze --out /tmp/issue748-discovery-freeze
   ```
   This writes `study.json`, `sources/**`, `participant/<case>/prompt.txt`, discovery harness snapshots, `inventory.json`, and `seal.json`. It does not launch a participant, browser, server, model, test or evaluator.

2. Register the plan **before** any formal attempt. Record a `plan` document with unique `caseId × setupId × condition × repeat` cells. Round 1 aims for at least three independent blind repeats per `case × model setup`; prefer fewer models to fewer repeats. The model ladder declares `frontier`, `mainstream`, and `lower-cost-fast` as measurement axes, but a run must not be invented when resources are absent.

3. Deliver only `participant/<case>/prompt.txt` to a genuinely fresh subject for a blind run. Keep exact delivered copies/digests, accessed material, context evidence, model/provider/snapshot/date, reasoning mode, sampling, context/tool limits, seed or null reason, tool access and time/token/compute limits. A knowledge-visible calibration packet may add declared source material, but it is excluded from blind-discovery estimates and must follow every blind attempt.

4. Preserve every attempt exactly once: completed, failed, excluded, deviating, and unstarted planned cells all require records. `runInventory` declares the available scope, collection method and completeness limit; the reducer rejects undeclared duplicates or missing inventory. `registeredPlan` distinguishes planned cells from late/unplanned deviations.

5. Keep raw participant output separately. `submission.proposals[]` contains only the extracted proposal IDs, kind (`property` or `test`), statement and optional exact citation. Extraction completeness must be independently evidenced; the reducer cannot infer omitted natural-language requirements.

6. An independent reviewer adjudicates a complete `review` per completed measured submission. Every selected Proto reference criterion gets exactly one eligibility disposition. Every raw proposal gets exactly one semantic disposition. No proposal or eligible reference is merged, dropped, or silently inferred across runs.

## Comparison semantics

Rows use the six Issue categories plus the existing public scoring vocabulary's separate false-requirement disposition:

- `both`: an Agent proposal directly represents an eligible Proto reference.
- `agent-only-valid`: an Agent proposal is accepted as valid but does not map to a Proto reference; it requires a feedback artifact.
- `proto-only`: an eligible Proto reference remains undiscovered.
- `semantically-equivalent`: an Agent proposal and an eligible Proto reference express the same requirement differently.
- `missing-from-proto`: an Agent proposal is accepted as a genuine gap after a scoped reference search; it requires `missingSearch` and a feedback artifact.
- `ambiguous-disputed`: the claim remains ambiguous, disputed or unresolved.
- `unsupported-false`: an Agent-invented false or unsupported requirement, kept distinct from valid Agent-only findings.

Every row requires reviewer rationale, exact citations and at least one measured dimension. Reference rows must cite the frozen file and line range containing the criterion ID, not merely a path or matching wording. Eligible-reference agreement is `intersection / union` of adjudicated `both + semantically-equivalent` reference IDs between two usable repeats; an empty union is `null`, not perfect agreement.

`agent-only-valid`, `missing-from-proto` and `ambiguous-disputed` rows preserve candidate project feedback. They are not spec amendments. `unsupported-false` stays separate and must not be collapsed into the discovery overlap.

## Cost and consistency accounting

The report separately records wall elapsed seconds, input/output tokens, compute seconds and iterations. A missing value is `null` with `unavailableReason`; totals and means include denominators and never turn unavailable data into zero. Costs summarize all retained attempts and exclude unusable runs from eligible-blind estimates. Multiple completed attempts for the same planned repeat make the cell unusable; a reused declared participant/context identity cannot count as independent repetition.

A run is usable for blind discovery only when it is a completed planned blind run after the registered plan, has fresh context/no prior output access, delivered the exact ordinary prompt and no undeclared extra material, has no outside access or leakage, has a complete independent review, and has no deviation. This is the strictest available public-development result; it still does not attest external isolation.

The independent assessment may classify the hypothesis as `supported`, `weakened`, `inconclusive`, or `falsified`. `injected-control` input and observations with zero usable blind runs are always `inconclusive`; schema validation cannot manufacture semantic truth.

## Boundaries

- No strict blind evaluation or formal result is admitted until a separately reviewed executor prevents filesystem, Git, network, history/context and tool leakage. `exposure.boundary` is fixed to `public-development-no-verified-isolation`.
- Do not publish actual held-out answers or private evaluation material in this repository, Issue, prompt or accessible retrieval path.
- Draft lifecycle is preserved. A passing analysis does not promote spec entities, test entities or product guarantees.
- A public prompt intentionally contains ordinary task context and an explicit output contract; it still reveals task language, not criteria/test IDs. The root implementation sources contain criterion comments, so they are evaluator reference material, not participant packets.
- Business workflows, real product usability, screen-reader/AT behavior, generated Proto consumers and native implementation conformance remain outside this study.
