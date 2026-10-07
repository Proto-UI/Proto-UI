# Product and compiler discussion, 2026-09-24

This edited English record covers the Proto-UI portion of a private meeting held on 2026-09-24. It was prepared with AI-assisted transcription and translation from the Chinese audio. Speaker names and personal details are omitted. A short passage of unrelated or unclear background speech is not included here.

This is a structured rendering, not a verbatim transcript. The source transcription is noisy. The meeting nevertheless established a work direction and converged on restricted TypeScript as a neutral source form; it did not finalize a grammar, IR, implementation language, product name, release commitment, or adoption target. The 2026-09-25 correction distinguishes these levels instead of describing every topic as undecided.

## Directions carried forward

The closing summary identified three workstreams: expand prototypes, turn the interaction knowledge base into a usable skill library, and actively advance a compiler proposal (approximately 61:39–62:34). Earlier, the participants said to expand prototypes first, revise abstractions when needed, and produce the compiler plan now (51:18–52:13). These statements do not require the knowledge-library work or prototype expansion to wait for a compiler implementation.

GPUI work should continue. Flutter was also discussed as practically valuable (62:33–63:01). No React-first product priority or numerical evaluation gate was established by this meeting.

## Why the discussion happened

The group wanted to look beyond its own assumptions and identify real users, concrete needs, and places where Proto-UI's existing interaction knowledge, examples, and tests could help. The immediate question was how to make useful outputs available before asking people to adopt Proto-UI itself.

## Ship usable output before asking users to adopt the framework

One proposed path is to turn a prototype into editable source code for a target technology and write that code into the user's project. Users could build on it and change it without first learning Proto-UI. Reducing the component's delivery burden is a goal; the discussion also considered modular dependencies and host bridges. It did not rule out every explicit helper or bridge. Adapters and a compiler or transpiler could make source delivery practical across several ecosystems.

This was presented as a gradual route to adoption: first give people components that solve a problem in the framework they already use; later, some may become interested in Proto-UI's shared interaction model and cross-platform consistency.

The discussion also treated ecosystem gaps as possible entry points. Native Rust UI, GPUI, Flutter, and mini-program environments were mentioned. The GPUI work was described as a related but separable track, not as the only intended target. The supplied chat cited [GPUI Kit](https://github.com/longbridge/gpui-kit) as an example with more than 75 components and primitives; that was a coverage reference, not a target Proto-UI committed to match.

The preceding chat gave GPUI as one concrete ecosystem motivation: one participant viewed it as a usable native Rust GUI framework whose low-level API leaves room for a stronger component layer. This is an individual motivation and a hypothesis about an ecosystem gap, not evidence of general demand.

## Grow the prototype library

Current prototype coverage was considered too small for broad use. The conversation used roughly 50 common components as an order-of-magnitude reference for a useful library, with forms, navigation, overlays, data display, editing, feedback, and layout among the kinds of coverage users expect. This was a planning estimate, not an agreed acceptance threshold.

The discussion prioritized prototype expansion while asking for a compiler plan now. The preceding chat floated compiler readiness around versions 0.4–0.5; the call used other tentative version references. None is a release commitment or a reason to postpone the parallel knowledge-library work.

Ready-made blocks may be easier for users and coding agents to apply than isolated primitives. A Chat UI was offered as one example of a block that could serve as a worked starting point.

## Compiler and target-platform questions

The proposed compiler's output would be source code in the target ecosystem, not machine code. Version differences may require separate backends or compiler profiles, though experience with one version could make another easier to support. The group had not settled whether to call this a compiler or a transpiler.

Generated code should feel reasonably native to the target platform while preserving the prototype's interaction intent. That raises questions about rendering and state semantics. For example, a prototype may rebuild infrequently, while a target framework commonly re-renders; generated code may need to follow the target's expected conventions even if that means extra rendering. Some platforms may also need bridge code for context, parent-child relationships, styling, or communication with native components.

TypeScript was discussed as a practical starting point because the current project already uses it. A restricted, neutral subset of TypeScript or an intermediate representation could help avoid maintaining separate source definitions for every backend. Rust and WebAssembly were mentioned as possible future options for native use, but no implementation language or architecture was selected.

The late discussion converged on trimming readable TypeScript into a smaller neutral source language, using specially named files such as `.proto.ts` and rejecting unsupported syntax (68:24–71:34). Shared modules may need a separate neutral-source convention, whose name would be discussed in a proposal. This is a direction to develop, not a finished grammar or adopted IR. The call also noted that callbacks and executable logic complicate a serializable representation, and considered shared TypeScript versus separate TypeScript and Rust implementations and JavaScript/WebAssembly boundary costs. Those implementation choices remained open. These details come from ASR, not a full listening review.

The compiler could emit code directly into consumer repositories. That makes output size, readable code, target-version support, and how consumers update generated components important design questions. A WebAssembly build might also support a browser playground where users edit a prototype and inspect its generated target code, if the build size and performance are practical. The meeting did not resolve these details.

Web Components illustrated how one target may need distinct adapter profiles: light-DOM and shadow-DOM modes differ in behavior, styling, and integration costs. The group did not settle how such target-specific options should be exposed.

The call further emphasized target-native interoperability. Prototype or generated components should be able to participate in a host framework's component tree and interact with native components where the host supports it. The discussed bridge responsibilities included identifying the current component/node, representing parent-child relationships, and forwarding values or props across the boundary. Styling, rendering, scheduling, and state semantics can also differ by host. If a target cannot provide the required capabilities without effectively building a separate framework, deferring that target was considered preferable to claiming seamless portability.

## Reuse the interaction knowledge with AI

The group discussed packaging Proto-UI's interaction knowledge, examples, and tests as a skill or prompt library for coding agents. The idea was to use an established component library when the target ecosystem already has a suitable option; where it does not, the agent could build from Proto-UI's reviewed knowledge and test cases.

This route can be tested before a compiler or adapter is built (21:36–25:40). The aim is better interaction behavior and more consistent design. The comparison includes mature libraries, knowledge-assisted AI generation, and generation without the knowledge base. Possible checks included rendered appearance, focus behavior, and rendering or adapter costs. Even an unsuccessful product experiment can expose gaps that improve the knowledge base. No results or fixed sample-size thresholds were presented.

The full-call transcript also floated organizing shared test cases around interaction features rather than implementation language, so different target implementations could be checked against the same behavioral intent. That would still require target-specific integration tests for host behavior; no conformance suite was adopted.

A separate project for the skill/library route was explicitly discussed. Component interaction knowledge could receive continuing maintenance, while business-specific blocks and scenario skills would mainly accept community contributions rather than make arbitrary business logic a core responsibility (27:54–30:10). Its contributors need not all be Proto-UI organization members. Findings should feed back into the core knowledge. The final name, repository and detailed product boundary remain open; the discussion also questioned how much value a standalone UI skill would retain as models improve.

## Finding users and sharing the work

The discussion proposed weekly demand scanning and participation in relevant community conversations under the project's name. The stated goal was to hear recurring problems and make useful artifacts available early, not to claim that demand or adoption had already been proven.

The intended maintenance split keeps knowledge, semantics and prototypes with the core, while relying mainly on community contributors for the wider range of adapters, compiler backends and target versions (47:15–50:25). A small official set and recognition of strong community implementations were discussed. The prototype and adapter/compiler ecosystems should develop separately. Detailed certification criteria and a stable extension interface were not finalized.

## Open questions

- Which users and ecosystems should be tested first, and what evidence would count as real demand?
- Which common components and blocks should fill the prototype gaps?
- What is the first compiler slice, and what precise grammar, shared-module convention and IR should implement the restricted-TypeScript direction?
- How will target-language versions, readable output, consumer edits, and future regeneration be handled?
- Which interaction, accessibility, visual, performance, and output-size checks should a generated component pass?
- What parts of a UI skill remain useful as coding models absorb more design patterns?
- What are the name, repository and precise maintenance boundary of the proposed separate skill/library project, and how should it feed findings back into Proto-UI?
- Which adapters should remain officially maintained, and what would an external adapter need to qualify for an official designation?

## Source and confidence

The recording is private and is not included in this document. The raw automatic Chinese transcript has 161 overlapping segments spanning 72:24.64. Its automated clean copy has two gaps, at approximately 41:25–41:51 and 59:25–60:18. This English record uses the full-coverage transcript and is an edited rendering of project-relevant discussion, not a complete verbatim translation. The work directions and source-form convergence above are distinguished from tentative ideas and unadopted implementation details. Exact technical wording should be checked against the recording and current contracts before becoming normative requirements; no new specification or release was adopted by this record.

## Subsequent planning

The separate [2026-09-25 implementation direction](2026-09-25-meeting-follow-up-and-compiler-plan.md) distinguishes later engineering proposals and implementation authorization from this meeting record.
