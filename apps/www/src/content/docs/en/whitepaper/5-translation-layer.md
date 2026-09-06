---
title: 'Chapter 5: The Translation Layer'
description: 'How a Prototype enters a concrete Host through the translation layer, with explicit capability boundaries, translation outcomes, and evidence scope.'
---

> Once we have a Prototype, how do we realize it in React, Flutter, Qt, and the other technologies we know?

## A Prototype Is Not Yet a Component in a Host

By the end of the previous chapter, we had a description of a Component that was close to executable.

For a Switch family, the relevant Prototypes can say which Props Root accepts, which State it preserves, which Events it handles, which Feedback it presents to the User, which information it exposes to the App Maker, and how Root and Thumb form one Anatomy family. Each Prototype describes the obligations its interactive subject must fulfill.

React, Flutter, and Qt do not directly understand those obligations.

React Web deals with component owners, props, commits, and the DOM. Flutter has widgets, elements, and render objects. Qt has widgets, properties, signals, and its own event system. Each has its own way to express structure, state, input, and lifecycle.

Proto UI calls a concrete technical environment like this a Host. The translation layer is responsible for mapping the obligations declared by a Prototype into a Host.

```text
Obligations declared by a Prototype
                 │
                 ▼
          Translation layer  ◀──── Host capabilities and constraints
                 │
                 ▼
             Host artifact
```

A Host artifact is what actually exists in the target technology after translation. It does not have to be a generated source file. It may be a running React component with DOM and event bindings, a Custom Element class and its instances, a platform widget, a controller, styles, registration data, or a runtime result composed of several of these things.

Prototype and Host artifact are not two names for the same object. The former describes an interaction identity and obligations that hold across technologies. The latter implements those obligations in one concrete Host.

## The Challenge of the Translation Layer

The task now appears straightforward: build a tool that maps an explicit Prototype into different Hosts while keeping semantic loss under control.

But if every new Host requires an undertaking comparable to building React Native or Flutter from the ground up, the cost-benefit ratio of realizing Prototypes will fall sharply. Proto UI might remain a useful theory for analyzing components, but it would struggle to become an engineering foundation that can keep expanding.

The translation layer must therefore answer another question: how can developing a translator be divided into reusable, implementable, and verifiable work instead of becoming one enormous project with unclear boundaries?

Proto UI controls this complexity from both sides:

- On the Prototype side, it preserves semantics that can be analyzed and transported, avoiding Host-specific objects and scheduling models inside the component itself.
- On the translation side, it separates recurring semantic responsibilities from Host integration points, so translators can reuse the former and implement only the latter.

This is where Module and Host Capability enter the picture.

## Module and Host Capability

The first four chapters introduced semantics such as Props, Event, Feedback, Context, and State. Every Host must ultimately make these semantics run, but much of the necessary logic does not need to be reinvented by every translator.

Proto UI uses Modules to encapsulate reusable semantic implementations and responsibilities. The Props Module, for example, handles Props declarations, defaults, fallback logic, and change processing. The State Module stores and provides access to state inside a Component instance. Event-related Modules organize input events into forms that a Prototype can handle.

Modules are not a one-to-one catalog of the concepts introduced earlier. One semantic domain may require several Modules to cooperate—the event domain contains many Modules. Cooperation across domains may produce independent semantics that need their own Module, as with expose-state. Some cross-domain execution order is jointly owned by the Runtime—the architectural layer in Proto UI that orchestrates Modules, lifecycle, and rendering while connecting Adapter and Host—and the translator, rather than by a separate Module, as with lifecycle. Other Modules, such as state, handle only internal Proto UI logic and need no capability from the Host at all.

A Module requests a Host Capability only when it genuinely needs to interact with a concrete Host.

A Host Capability describes one minimal fact or action that the translation layer must obtain from the Host. It asks whether the Host can do something; it does not require every Host to expose the same API, and it does not leak a DOM node, Flutter controller, or Qt object directly into a Prototype.

The current Context implementation, for example, must search a logical structure for an information provider. To do that, the translation layer must answer two questions:

- What token can stably identify a Component instance within the current runtime scope?
- Given an instance token, how can the logical parent Component be obtained?

React, Vue, and other Hosts may answer these questions through entirely different objects and structures. As long as the facts they provide satisfy the contract, Context lookup, subscription, and update logic need not be rewritten in every translator.

State, by contrast, preserves facts inside a Proto UI instance; ordinary State does not inherently need the Host to supply another state system. Lifecycle also need not be wrapped in a Module merely for formal symmetry. It is better understood as an execution agreement between Runtime and Adapter concerning instances, views, mounting, and disposal.

Developing a translator can therefore move away from “reimplement all of Proto UI” and toward several questions with clearer boundaries:

1. Which governed semantic capabilities will this translator support? For which Modules does its profile contain reviewed support or omission decisions, and how will Runtime and Adapter connect them?
2. Which Host Capabilities do those capabilities require, and how will the target Host provide them?
3. How do the Host's lifecycle, input, structure, and public interface map to a Proto UI instance and its final artifact?
4. At what boundary are unmet requirements rejected or reported, and what evidence demonstrates that the supported requirements have been fulfilled?

This is still far from a system where checking every box automatically means “correct.” It does, however, make translator work divisible, reusable, and reviewable. Similar Hosts may share further implementation. React and Vue translators, for example, can reuse some Web-platform capabilities while separately handling their frameworks' component lifecycles and calling conventions.

## Translation Can Happen at Different Stages

### Adapter

An Adapter interprets and executes a Prototype in the runtime of a target Host. It can read the real input of this Component instance, synchronize with the Host lifecycle, establish dynamic event bindings, and complete projections through the Host Capabilities currently available.

This is the primary translation path that Proto UI has implemented and brought under governance today. The existing official React Web, Vue, and Web Component profiles are runtime Adapters; their evidence currently covers mainly the Web family.

### Compiler

A Compiler analyzes a Prototype before the program runs and converts what is already known into target code, structure, styles, registration data, or another static Host artifact.

This is a translation form worth exploring, but it is not yet a completed Proto UI product guarantee. How much static analysis can handle in advance depends on how much information is known at compile time. Inputs, lifecycle, and dynamic capabilities that appear only at runtime still require other mechanisms.

### Hybrid

Real systems may combine both forms: a Compiler generates static structure and anything that can be analyzed in advance, while Runtime and Adapter handle dynamic State, Lifecycle, Host binding, and capability negotiation.

Adapter, Compiler, and hybrid answer when translation happens and which engineering form it takes. They do not automatically determine translation quality. A Compiler is not inherently faster, more faithful, or more “native” merely because it generates code. An Adapter does not necessarily imply an inefficient layer of indirection.

## A Change in Form Is Not Necessarily Semantic Loss

The form almost always changes between Prototype and Host artifact, but the interaction semantics need not be damaged as a result.

For example, the `checkedChange` Expose event that Switch sends to the App Maker may be received by an `onCheckedChange` callback prop in a React Web Host API and represented as a `CustomEvent` in a Web Component. The APIs and Host artifacts differ, but the information-channel identity in the Prototype has not changed. If the direction, triggering conditions, and payload obligations still hold, translation has not lost semantics merely because the result “looks different.”

Hosts do have differences that cannot be erased easily. Translation outcomes must honestly distinguish three cases.

### Faithful

`faithful` means that, under the declared Host, profile, and runtime conditions, every required obligation of the Prototype is preserved.

It does not require identical internal code, Host trees, or native objects. What must remain the same is the interaction identity and its governed semantic responsibilities.

### Authorized Bounded Degradation

Some target media cannot and need not reproduce every form of presentation available in another medium. When a Prototype, Contract, or governed profile states in advance what may be omitted, under which conditions, and what remains guaranteed by the substitute, the result may be called `authorized bounded degradation`.

The important words are `authorized` and `bounded`. A translator may not relax a Prototype's requirements merely because they are difficult to implement. Nor may the omitted content be hidden behind a vague phrase such as “limited compatibility.”

### Unsupported

If a Host cannot preserve a required obligation and no authorized substitute exists, the outcome is `unsupported`.

This is not a criticism of the Host or translator. Explicitly acknowledging a lack of support is often more reliable than generating an artifact that appears to run but has already changed the Component's identity.

Obligations cannot simply be averaged together. A Switch may reproduce every visual detail and still fail to be faithful if activation does not work or if `checked` is no longer owned by the correct interactive subject. High fidelity in one dimension cannot compensate for a missing critical obligation in another.

## Terminal UI as an Example

A Terminal UI, or TUI, is a character-based interface that runs in a terminal and relies mainly on keyboard input and text layout.

To challenge the boundary, consider an example that is less conventional in the GUI world.

Suppose we translate an official Prototype into a Terminal UI. The translator's primary goal is not to reproduce every GUI pixel. It should produce a Component that follows TUI interaction and presentation conventions and is genuinely usable.

But this does not allow a TUI Adapter to delete any Feedback that is inconvenient to implement.

- If the Prototype already declares an equivalent presentation for a character interface or nongraphical medium, and the required interaction semantics still hold, the outcome may be faithful.
- If the applicable Prototype or governed profile explicitly permits part of the visual presentation to be omitted and specifies both a substitute and the remaining guarantees, the outcome is authorized bounded degradation.
- If required Feedback, identity, or operational obligations cannot be preserved and no substitute is authorized, the Prototype is unsupported for that TUI profile.

A TUI translator should therefore not be judged solely by GUI pixel reproduction. But “following TUI conventions” cannot become a license for the translation layer to rewrite the Component. The target medium determines what an implementation may look like; the Prototype and governed rules determine which changes still count as the same Component.

## Four Questions That Must Not Be Confused

When discussing a translator, four kinds of judgment can easily be substituted for one another. Placing them in one table makes the separation clearer:

| Question | What does it answer? | Possible answers |
| --- | --- | --- |
| translation form | When and in what form does translation happen? | Adapter / Compiler / hybrid |
| capability realization | How is a Host Capability fulfilled? | native / translated / emulated |
| conformance outcome | Do the Prototype's obligations ultimately hold? | faithful / authorized bounded degradation / unsupported |
| evidence state | What justifies that conclusion? | verified / planned / uncataloged / known unsupported |

There is no need to memorize this table. Its purpose is simply to remind us that these four questions cannot answer one another.

A runtime Adapter may call the Host's native scrolling engine, but `native` describes only how a capability is fulfilled; it does not prove that every Scroll Area obligation is faithful. Conversely, an emulated capability need not be judged low-fidelity if it reliably fulfills the required obligations.

Likewise, the existence of an Adapter package in the repository does not mean that it has verified support for every Prototype. Support or refusal that has not been reviewed remains uncataloged. We should not collapse pass rates across Modules into one score that lets many secondary capabilities obscure one missing critical obligation.

Capability matrices remain useful, but every cell must say which profile and semantic or Host Capability the conclusion concerns, what the outcome is, and how far the evidence reaches.

## Report Problems at the Earliest Reliable Boundary

If the translation layer already knows that it cannot fulfill an obligation, it should not remain silent until the User encounters an ambiguous no-op at runtime.

Of course, “early” does not mean guessing. Some conclusions can be reached at compile time; some require the Adapter to see the concrete Prototype; and others become known only after a Host session exists and real capabilities have been negotiated.

A more precise principle is therefore: report degradation or inability at the earliest reliable boundary.

- When a Compiler already has all necessary information, it can report before generating the artifact.
- A problem that an Adapter can confirm only while creating a Component instance should be reported during setup or binding.
- A limitation that can be known only after the actual Host surface exists should be diagnosed as soon as that fact becomes certain.

A useful report should at least state which obligation cannot be fulfilled, which Host/profile the conclusion concerns, whether an authorized substitute was used, and which guarantees remain after that substitution.

## Translation Conclusions Need Evidence

A translator that runs has not necessarily completed its translation responsibility. We still need evidence that the observable behavior of the final Host artifact conforms to the corresponding Prototype or Contract.

Evidence must be bound to a concrete scope: which obligation, which Adapter profile, which Host/runtime version range, and which results were verified. A React test cannot speak for Qt, and a Web Component DOM result does not automatically prove that Flutter will have the same semantics.

Proto UI currently has governed runtime Adapter profiles and some Web-family evidence. Realizations for Compiler, Qt, Flutter, and broader media remain directions that the translation model can accommodate but that existing evidence has not proved.

## Translation—But Consistent to What Degree?

The translation layer gives a Prototype a concrete Host artifact and provides a place to describe capability boundaries, translation loss, and evidence.

The next question is this: when two Host artifacts use different structures, event systems, and rendering methods, what lets us say they still implement the same Component? Must consistency extend to behavior, structure, or pixels? Without a standard, translation has no clear end or target.

The next chapter examines how Proto UI understands and evaluates consistency, along with the conditions and boundaries under which that consistency holds.
