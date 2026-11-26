# Dialog check discrimination: executed calibration and held-out results

Issue [#754](https://github.com/Proto-UI/Proto-UI/issues/754). This follows the [November 10 preparation](2026-11-10-dialog-conformance-discrimination.md), which remains an unexecuted historical record. The current user's Sprint 7 request authorized this bounded experiment. The subject is `d0eb81d3c61c3d3e93e46c4151e78031273d6116`; execution occurred on November 23 UTC / November 24 Beijing time. No production Dialog implementation or existing repository test file changed.

**Result:** the selected existing checks caught all five exercised component-contract defects. They did not detect the independently authored consumer defect that wired Cancel to Save; the added application observation did. Both legal customizations passed. This demonstrates a boundary between component coverage and application-task coverage, not a universal defect-detection rate or a requirement for Base Dialog to implement application business actions.

The [machine-readable summary](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-dialog-conformance/summary.json), [raw evidence and reproduction instructions](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-dialog-conformance/README.md), and [archive manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-dialog-conformance/manifest.json) retain all attempts, sources, command outcomes, process-exit receipts and first divergences. The new run does not replace the historical denominators or turn earlier failed attempts into passes.

## Baseline and the entry-time limitation

The unchanged d0 source selected 28 existing checks: 17 Base Dialog, three controlled-dismissal, and eight WC overlay checks. On the first fully installed run, **26 of those 28 passed**. Five added observations passed. The two existing failures were:

- `adapter-web-component: dialog overlay traps tab navigation inside active dialog content`: the first synthetic Tab left focus on Cancel instead of moving to Confirm.
- `adapter-web-component: dialog overlay merges dialog-close and button as one group with an inner hit and focus surface`: the first synthetic Tab left focus on the nested Cancel Button instead of moving to Confirm Button.

The first failure also occurred when selected alone. Setting the two synthetic Tab events to `cancelable: true` did not fix either failure. Explicitly completing the entering transition before those two first-Tab observations made both pass, without changing their assertion identities or expected values. These diagnosis runs retain their skipped counts: one failed / seven filtered; two failed / six filtered; and two passed / six filtered respectively. They are not complete-suite acceptance.

The experiment therefore states a narrower, reviewed precondition: **active traversal after entry completion**. It does not answer whether an early Tab during entry should already work, whether the fixture observes too early, or whether current Portal/Focus entry behavior has a product defect. There is no product repair in this change. The original two failures remain separately actionable.

To preserve ordinary regression coverage, the repository WC test file remains byte-identical to d0, SHA-256 `6c7d9db272c68a669d0f3451856e203781ee07a606fcfd76775fa5100131dfe2`. Only this experiment's Vite process adds the two completion calls. The executed version has frozen SHA-256 `4540776b40b48a4ac065453e00a2f3cad1c03015406be3d80505a7f3a3069444`. Each cell archives both versions and an actual transform receipt; a missing or different prepared-check receipt fails report admission. The first-focus assertions remain before completion. This is the original 28 identities and expectations under an explicit changed timing precondition, not a claim that the unmodified original suite was green.

Two preparation defects were fixed before freezing the added observations. The consumer fixture now uses the public Root property `a11yLabel`; the old `ariaLabel` spelling did not set that fallback. Its explicit transition-completion helper now waits the current two-frame compositor conceal boundary, as the existing WC helper does. Neither change alters the five observation expectations.

## Authority, independence and freeze

The applicable repository authorities are [P-BASE-DIALOG-CONTENT](../../../../spec/prototypes/P-BASE-DIALOG-CONTENT.yaml), [P-BASE-DIALOG-CLOSE](../../../../spec/prototypes/P-BASE-DIALOG-CLOSE.yaml), and [T-BASE-DIALOG-CONTENT-0001](../../../../spec/tests/T-BASE-DIALOG-CONTENT-0001.yaml), together with their existing Focus, Transition, Root, Overlay and A11y relationships. Dialog/Focus/Transition criteria remain draft. The active WC Adapter identity does not promote them. [WAI-ARIA APG Dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) supplies an external reference for containment and naming, without imposing every recommendation on every application.

The [plan](../../../../scripts/analysis/dialog-conformance-study/plan.json) maps each criterion to existing diagnostic fragments and to a separately recorded consumer observation:

| Added observation | Authority and expected boundary | Original-check relationship |
| --- | --- | --- |
| `D754-FOCUS` | Content FOCUS: after entry completes, wrapped Cancel/Save traverse forward and backward, prevent competing host traversal, and restore the opener for keyboard Escape | Existing Tab-loop and keyboard-restoration checks |
| `D754-CONTROLLED` | Content CONTROLLED/DISMISS: one close request does not change a controlling owner's logical value; refusal/delay retains the view; owner acceptance starts leave | Existing controlled-root and none/sync/microtask owner checks |
| `D754-RELATIONS` | Content A11Y-RELATIONS: relationships resolve live Title/Description parts; removal clears them and enables the documented Root fallback; re-add restores targets | Existing live-part relationship check |
| `D754-PRESENCE` | Content PRESENCE: the configured leaving view remains before explicit unit completion; completion detaches it and releases the modal lock | Existing transition-state and controlled-owner checks |
| `D754-ACTION` | The fixture application task: Cancel invokes only cancel; after reopen Save invokes save once. Close command semantics alone do not define these business actions | No mapped original action-identity assertion |

The checker freeze was recorded at **19:06:09.472560 UTC** with SHA-256 `579eb729d4d45384df66aa2cac6e78f3e06d895f9a5ab1f19f415c9b3e438f4a`. It contains the three executed existing-suite hashes, the added oracle hash, and fixture/subject hashes. The parent Agent independently read the criteria, fixture and expectations, accepted the settled-entry synthetic scope, and authored three additional variants at **19:08:12.460527 UTC**. Its [unaltered handoff](../../../../scripts/analysis/dialog-conformance-study/freeze/held-out-variants.json), SHA-256 `32da96f6a6394ee583fb6d0e6ff4fc0d8cd8eb2c5cff2bf558e1150b579b0790`, binds that preceding freeze and records each expected result and its authority.

The child did not change checker bytes after receiving these variants. The runner verifies the frozen executed bytes, subject/fixture bytes, later authorship timestamp and exact independent variant payload. Moving the already frozen two completion calls into an in-memory preparation changed how the bytes are supplied, not the executed bytes. Six public calibration cells were run before the final combined collection and retained separately.

Independence here means a different Agent authored the additional variants after the checks were frozen and independently reviewed expected outcomes. The variants became visible to the executor after handoff. This is not secure model isolation, a formal blind Agent evaluation, or human independent review. The case set was not supplied to a blind discovery run.

## Observed results

The final collection ran from **19:12:11.785 to 19:15:04.441 UTC**, serially under Node 24.22.3, pnpm 10.32.1, Vitest 2.1.9 and HappyDOM 15.11.7. It used the real WC Adapter and Base Dialog modules, with one worker and no file parallelism. Dependencies came from the same-base locked workspace installation; this is not a packed-distribution or clean-install consumer claim.

All nine cells executed all 33 assertions: **297 executed, 274 passed, 23 intentionally mutated failures, zero skipped**. The source-bound reducer admitted every cell. There were no setup/cleanup/runner exclusions, cancelled cells or source drift in this final collection. The runner's actual aggregate exit code is **1**, preserving intentional failed assertions. The report reducer exits **0**, meaning collection integrity and classification completed, not that every mutated component passed.

| Cell | Cohort | Existing 28 passed | Added five passed | Classification |
| --- | --- | --: | --: | --- |
| `baseline` | Public valid control | 28 | 5 | Accepted under settled-entry precondition |
| `focus-no-loop` | Public broken | 26 | 4 | Caught |
| `controlled-eager-close` | Public broken | 24 | 4 | Caught |
| `description-dangling` | Public broken | 27 | 4 | Caught |
| `presence-early-complete` | Public broken | 21 | 3 | Caught; additional affected observations retained |
| `legal-rounded-border` | Public legal style | 28 | 5 | Accepted |
| `heldout-cancel-routes-save` | Independent broken application wiring | 28 | 4 | Missed by existing component checks; found by added action observation |
| `heldout-missing-live-title` | Independent broken relation | 26 | 4 | Caught |
| `heldout-legal-article-wrapper` | Independent legal wrapper | 28 | 5 | Accepted |

Public calibration caught **4/4** effective broken variants, with **0/1** legal false alarms. Independently authored held-out variants yielded **one caught and one missed out of two effective defects**, with **0/1** legal false alarms. Combining the named cases gives five caught / one missed and zero false alarms / two legal cases. The component-contract subset is **5/5 caught**; the application-task subset is **0/1 caught by the original checks**. These are small, deliberately selected case denominators, not estimates of all future defects.

### First divergence and consequence

| Effective defect | First measured divergence | Why it matters |
| --- | --- | --- |
| Focus trap/loop disabled | First forward Tab did not reach Save and did not prevent host traversal | The active scope no longer supplies the expected traversal ownership |
| Controlled owner bypassed | After a declined close request, `open` was false and `leaving` true instead of true/false | The component applied a request before its controlling owner accepted it |
| Unconditional description ID | After removal, `describedBy` still referenced `pui-dialog-3-description` | The live relation was left pointing at an absent part |
| Leave completed immediately | After logical close, state was `closed` and view detached instead of `leaving` and retained | The configured view-retention boundary was bypassed |
| Cancel routed to Save | Action log was `["save"]` instead of `["cancel"]` | Dismissal alone could hide the wrong application action; the original 28 checks observed no failure |
| Live Title relation removed | The live relation observation reported `title: false`, `description: true` | The live Title stopped naming the dialog |

Every mutation has a frozen preimage/postimage and a transform receipt. The target observation's actual divergence establishes that the mutation was behaviorally reached; transformation alone is insufficient. Criterion-linked existing diagnostics determine detection. Unrelated failures remain in the report and do not add extra detected defects. The immediate-leave mutation, for example, also disturbs the controlled journey; both failures remain, while the variant contributes only once to its intended criterion denominator.

Final-run ineffective mutations: **0**. Final-run rule disputes: **0**. Final-run unresolved cells: **0**. These values do not erase the unresolved early-entry boundary, which is outside the settled-entry scoring. Native input/paint, named assistive technology, other Adapter profiles, a generated Dialog, physical devices, paired Agent repair/maintenance, and repeated-run variance remain untested. No model execution, repair improvement, token-cost result or stable conformance claim is made.

## Retained attempts and rejected hypotheses

The archive includes the following earlier records in addition to the final run:

| Attempt | Actual outcome | Treatment |
| --- | --- | --- |
| Remote original plan | Frozen-input guard rejected current Content drift before product execution | Preserved precondition failure; never counted as a Dialog failure |
| Local `attempt-01` | Sparse checkout lacked `packages/hooks/package.json`; setup failed, then remaining work was interrupted | Preserved environment/setup failure, with incomplete cells |
| Local `attempt-02` | A sparse-checkout invocation used an unsupported flag; the inadvertently started run was interrupted | No product conclusion |
| Local `attempt-03` | Complete baseline: original checks 26/28, added observations 5/5; mutation collection stopped after baseline diagnosis | Not admitted to mutation-detection scores |
| Isolated original focus case | One failed, seven filtered | Failure survived isolation; no full-suite claim |
| `cancelable: true` hypothesis | Two failed, six filtered | Hypothesis did not resolve the first-Tab failures; source reverted |
| Explicit entry completion | Two passed, six filtered | Supports the narrower precondition only |
| Public `attempt-04` | Six complete cells; 4/4 broken caught, 0/1 legal false alarms | Same frozen executed checker; retained before held-out combined run |
| Final `final-09` | Nine complete cells, source and process receipts validated | Current bounded experiment result |

The old prepared plan's source drift was reconciled rather than silenced. The historical subject at `0607c6c5` and the original issue's source-inspection baseline at `3d9ab9f5` remain distinct from d0. Full input bytes and all observed command failures remain recoverable.

## Actionable gaps and verified ownership

The live #754 body and all **four of four** comments were read and preserved. The original five completion conditions govern this result. The September maintenance suggestions are explicit follow-ons; the November 6 research deferral to 0.4 is retained.

| Finding | Owner / existing source | Next bounded action |
| --- | --- | --- |
| `D754-EARLY-ENTRY`: two unchanged WC checks fail before settled entry | [#1178](https://github.com/Proto-UI/Proto-UI/issues/1178), the open inventory and coordination owner for remaining ordinary/native regression failures. Its original text requires individual failure identities and existing-owner links. Closed [#1161](https://github.com/Proto-UI/Proto-UI/issues/1161) supplies the original Dialog close/focus acceptance scope; closed [#1177](https://github.com/Proto-UI/Proto-UI/issues/1177) supplies the historical Focus readiness/initialization scope. | Attach the exact d0 raw failure and rejected cancelability hypothesis to #1178; identify the first Focus/Portal ownership divergence and test actual early input before deciding whether fixture timing or product behavior needs repair. Keep the ordinary suite unchanged. No cause or fix is yet established. |
| `D754-APPLICATION-ACTION`: component checks accept a fixture with Cancel wired to Save | #754's application fixture and its future maintenance-task consumer; Base Close owns dismissal, not these business actions | Keep `D754-ACTION` and this negative control with any task that claims correct Cancel/Save behavior. Do not use an all-green component suite as evidence for that task. This is injected wiring, not an observed shipped application defect. |

The November 10 record incorrectly described #1191 as a shared Focus owner. The fresh source read shows that [#1191](https://github.com/Proto-UI/Proto-UI/issues/1191) concerns mobile navigation/docs presentation and explicitly refers shared host/focus blockers to #1176/#1177. It is not assigned this new finding. Its historical record is not rewritten, and no closed owner is silently reopened or claimed to have accepted the new observation.

## Original completion ledger

This table identifies earned experimental evidence. Parent integration, exact-source review, the authorized live checkbox update and its readback remain separate delivery actions; this source worker has not written GitHub state.

| Original #754 condition | Evidence now available |
| --- | --- |
| Reproducible fixture, criterion-to-case mapping, independently reviewed expectations | Pinned real WC/Base source; public fixture; plan; independently authored review/held-out handoff; original versus prepared checker bytes; failed baseline and settled precondition disclosed |
| Recorded valid/broken/legal outcomes and genuinely separate held-out challenges | Nine complete cells including original six public cells plus separately authored Cancel, Title and article-wrapper variants; unchanged frozen checker |
| Separate misses, false alarms, ineffective mutations, disputes and untested environments | Per-cell report, public/held-out denominators, responsibility split, zero final-run ineffective/disputed/excluded cells, and explicit early-entry/native/AT/model limits |
| Existing versus added checks; preserve failed and neutral repairs if comparing repair | Original 28 identities versus added five observations shown separately. No repair comparison was run; repair failures, neutral results and costs remain unavailable rather than zero |
| Each actionable gap links to an existing owner or bounded follow-up; negative outcome allowed | #1178 receives the source-bound early-entry diagnosis; the action gap stays with its application task and #754 consumer fixture. A missed application defect is a valid experimental result |

The two unchecked current-governance bullets in #754 map to these same five conditions. After exact-source integration and readback, they can be reconciled to this bounded experiment without implying native/AT completion, production repair, release admission or a positive Agent-knowledge effect.

## Validation and Agent evidence

The classifier and source-preparation integrity controls passed **13/13**. They cover unrelated diagnostics, baseline failure exclusion, unexercised or repaired mutations, missing transforms, legal false alarms, setup/cleanup failures, inventory mismatch, cohort/responsibility separation, unchanged repository source, exact prepared bytes, and missing/ambiguous preimages. These synthetic runner controls are separate from the 297 Dialog assertions.

Agent's sanitized request paraphrase: finish Sprint 7's original Dialog check-quality experiment, including genuine execution and independent held-out challenges, while preserving historical failures and the difference between delivered implementation and overall acceptance. Source: the current user request and the public #754 scope.

Evidence type is an executed internal research comparison with source-bound state/action observations. It uses actual Proto UI modules, synthetic DOM input and explicit unit Transition completion. No screenshots were produced or uploaded, and no native, visual or screen-reader result is claimed. The state/action table above is a walkthrough of measured values rather than an illustration of an imagined UI defect. Next delivery action: parent exact-source review, integration, and live tracking/readback; wider product verification remains with the original owners.
