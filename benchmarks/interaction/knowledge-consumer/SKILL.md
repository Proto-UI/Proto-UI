---
name: interaction-knowledge-consumer
description: Choose an existing target library or implement a primitive from explicitly sourced interaction knowledge, then validate the actual consumer and retain comparable evidence.
---

# Use interaction knowledge in a component task

This is a repository-owned **product workflow**, read directly from this directory. It is experimental 0.4 work associated with [Issue #734](https://github.com/Proto-UI/Proto-UI/issues/734). It does not install a user skill or participate in Proto UI's contributor skill router. Start with the [worked example and execution guide](README.md).

## Establish the task and route

Record the primitive, target framework and version, host, required interaction, accessibility, application integration and exclusions. Keep business decisions in the application task: account permissions, payment rules and chat workflows do not become primitive interaction knowledge.

Inspect the target ecosystem before generating a replacement. Select a mature library when its documented API, license, target versions and maintenance fit the task. Explain the choice and any unmet requirements. Use reviewed Proto UI knowledge and criteria to implement the missing behavior when a suitable library is unavailable. An unresolved or draft criterion needs explicit review or a bounded limitation; it is not permission to invent a stable guarantee. An unsupported target is a reportable outcome.

The worked route uses React 18.3.1 and `@radix-ui/react-tabs` 1.1.13. The [clean-project example](example/) composes the library's actual public exports. It uses manual activation and explicit looping because the [public task](../cases/tabs-manual-activation.json) asks for them. These settings are task choices: Proto's draft List defaults to no looping, and both Proto and Radix document automatic activation as their default.

## Supply knowledge with its boundaries

Read the [source map](sources.json) and [portable facts](knowledge.md). For each supplied fact retain its entity/criterion, lifecycle, source revision and bytes. Distinguish portable interaction intent from Proto-specific APIs, owner retention and host projection. Never pass a final Proto implementation, generated output or evaluator answers off as knowledge.

For ordinary product use, review the requirements together with the consumer author. For a controlled study, construct participant packets separately: the baseline receives the same ordinary task and allowed ecosystem information; only the knowledge condition receives the declared additional facts. The coordinator must record what was supplied **and what was actually read**. This directory and its public checks are not a hidden evaluator boundary. An author who has read them cannot be a blind participant.

## Deliver and observe the consumer

Keep the output in a clean project with exact direct dependencies and a retained transitive lock. Include a start/build command, source attribution, target/version limits and an application-owned lifecycle example. Do not require the Proto compiler, Runtime or Adapter for this workflow.

Validate the output against the same independently reviewed expectations for each comparison path. Inspect keyboard focus and selection as separate transitions, disabled behavior, accessible names/relationships, real host actions and removal. Observe the actual page at the declared viewport and theme. A prompt review, code review or screenshot alone does not establish behavior; an accessibility snapshot is not assistive-technology testing.

## Compare and feed findings back

Use the [controlled protocol](protocol.md). Preserve mature-library delivery, knowledge-assisted generation and unassisted generation as three distinct paths. Keep the paired AI conditions' task, model/version, tools, target, environment, budget and evaluator equal. Library delivery answers the practical reuse question; the paired conditions answer the knowledge-access question. Do not attribute a difference to representation without the optional matched-information control.

Retain first-pass and final outputs, unsuccessful/aborted/excluded runs, defects and omitted requirements, repairs, tokens/compute, elapsed and human time, cost and observed maintenance work. Unknown measurements carry a reason, not a zero. Report every collected run and classify only the hypothesis actually tested as supported, weakened, inconclusive or falsified. A small public calibration supports a correspondingly small claim; no improvement threshold or compiler-completion requirement applies.

Map each observed failure to the task clause and its independent authority, then to a precise knowledge/test gap if one exists. Keep disagreements disputed until reviewed. Core interaction knowledge belongs in the existing governed definitions; business-specific blocks and scenarios need their own explicitly accepting community owner. This workflow creates neither a separate repository nor a maintenance promise.
