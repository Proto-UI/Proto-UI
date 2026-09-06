---
title: 'Component as Protocol'
desp: 'Core idea: component as protocol'
description: 'Core idea: component as protocol'
draft: true
---

## What does this article answer?

This article does not discuss specific APIs or dive into engineering implementation.  
It focuses on questions that come even earlier:

- What exactly does Proto UI mean by a "component"?
- Why can a component be treated as something describable apart from any specific technical implementation?
- Why does Proto UI go one step further and regard such an object as a "protocol"?
- Why does Proto UI use the terms `Prototype`, `Adapter`, and `Host`?

---

## Components do not exist only in code

In different technologies, components can appear in different forms:

- a class
- a function
- an object
- a piece of template plus state
- an instantiable graphical control

All of these are valid, but they are better understood as **implementation forms** of a component, not the starting point of the component concept itself.

In Proto UI, a component is first of all a relatively stable interactive unit.  
It can respond to input, produce feedback, expose capabilities, and maintain a recognizable identity in its relations with the outside world.

So Proto UI does not focus on how a given framework defines a component. It focuses on this instead:

> whether an object has already become a unit that is interactive, describable, and recoverable.

From this perspective, a component is first an **interactive subject**. Code is only one way it gets implemented in a particular host.

---

## Expectations around a component often exist before implementation

In many software collaboration contexts, components are not first recognized through code.

Before implementation exists, people are often already discussing:

- how it should behave in different states
- how it should respond in interaction
- whether it "reproduces" the intended behavior in certain scenarios

These discussions may come from design files, product prototypes, interaction specs, or internal team conventions.  
They may not be code, but they are already enough for people to distinguish:

- which implementations are closer to the expectation
- which implementations are usable, but already drift away from the component's original interactive identity

The very idea of "faithfulness of reproduction" tells us something important:

> a component is not completely identical to a piece of implementation code.

If a component were only equal to its implementation, then implementations would only stand in a replacement relationship. There would be no question of whether one implementation reproduces it well enough.

This means some key information about a component often already exists before any concrete implementation, and can already be recognized and compared.

---

## A prototype is not a floating list of capabilities

Treating a component as something describable does not mean Proto UI understands a prototype as a loose collection of capabilities that can be attached anywhere.

In Proto UI, a prototype always points to an **interactive subject that can actually stand up as one**.  
What it describes is not a cloud of abstract rules, but an object that can be hosted, unfold over time, and enter into relations with the outside world.

So a prototype cannot lose its own anchoring structure.  
It needs at least a root node, or at least an indispensable point of interactive attachment.

This does not mean "the outermost element" in a specific host.  
It is a higher-level requirement:

> a prototype must always point to the current interactive subject itself, not to a set of floating local capabilities.

That is why later syntax and boundary design in Proto UI keep emphasizing that a prototype acts on itself.  
If an object no longer has its own anchoring structure, it also becomes difficult to keep treating it as an independently valid prototype.

---

## Being abstractable does not mean it is already a protocol

At this point, we can first reach a weaker conclusion:

> a component can be understood abstractly.

But Proto UI cares about more than abstraction alone.

"A component can be abstracted" and "a component can be treated as a protocol" are two different things.

The former means:

- people can understand a component without depending on a particular code form

The latter means:

- that understanding can be described stably
- it can remain highly consistent across different implementations
- it can be translated, maintained, constrained, and evolved as shared infrastructure

In other words, abstraction emphasizes a **way of understanding**, while protocol emphasizes **stability and transmissibility**.

Proto UI does not take the position that "all components are naturally protocols." Its position is:

> there is a part of a component that can be pushed upward into the protocol layer.

That part usually has several characteristics:

- it does not depend on a single implementation in order to exist
- it can be described with relative stability
- it can enter different hosts without being completely distorted
- its consistency can be maintained over time

What Proto UI calls a "Prototype" points exactly to this layer.

---

## Why does the word "protocol" appear here?

Once a component needs to enter multiple hosts and maintain a relatively stable interactive identity across different implementations, the problem is no longer only "how do we describe it?" It becomes:

- which information belongs to the component itself?
- which behaviors must implementations respect?
- which differences are acceptable, and which ones break consistency?
- when a component enters different hosts, what needs to be translated and what must not be lost?

These questions are already close to the scope handled by a protocol.

Here, "protocol" does not mean a component is the same thing as a network protocol or communication protocol.  
It means it starts to behave like this:

> **a describable, translatable, and constrainable interactive contract.**

From this perspective, "component as protocol" does not mean a component mysteriously exists apart from implementation.  
It means the core interaction semantics of a component do not have to be monopolized by any single implementation.

---

## Why Proto UI uses Prototype, Adapter, and Host

Around this relationship, Proto UI uses three core concepts.

### Prototype

`Prototype` refers to the relatively stable, describable, reusable interaction definition inside a component.

It is not the final implementation in some framework.  
It is an independent expression of the component's interactive identity.

What matters in the word "prototype" is not only abstraction. It also provides a reference point:

> implementations may differ, but they can still all be compared against the same prototype.

At the same time, this prototype always describes an interactive subject that can stand up as one, not a set of local rules detached from any subject.

### Adapter

`Adapter` refers to the interpretive layer that translates a prototype into a specific host.

Its job is not to redefine the component, but to handle the mapping between prototype and host, such as:

- how to carry over the interaction definition in the prototype
- which capabilities the host can support directly
- which parts need to be realized in the host's own way

The existence of Adapters turns "the same Prototype entering different hosts" into something that can be organized and maintained.

### Host

`Host` refers to the actual environment where Proto UI lands.

It may be a frontend framework, a platform, a category of GUI technology, or a broader carrier environment.

Proto UI uses the word "host" to emphasize one thing:

> Proto UI does not replace these environments. It lands its interaction model on top of them.

So Proto UI does not aim to exist apart from hosts. It aims to maintain a more stable interaction-semantics layer within them.

---

## The relationship among the three

In the most simplified form, it can be written like this:

> **Prototype + Adapter = component implementation in a Host**

Here:

- `Prototype` defines the component's interactive subject
- `Adapter` translates it into the target host
- `Host` provides the actual carrying capability

This does not mean all hosts are naturally fully equivalent,  
and it does not mean any component can migrate at zero cost.

What it expresses is only this:

> there is a part of a component that can be separated from its concrete implementation and handled as a higher-level interactive object.

The models that follow in Proto UI are basically all built on this premise.

---

## Prototypes can stay open while protocols stay stable

Proto UI does not require everyone to arrive at exactly the same prototype split for components.

Different teams, products, and host constraints can naturally lead to different understandings of component boundaries.  
So as a concept, prototypes can remain open and can allow disagreement.

At the same time, something else can still hold:

> the foundational prototypes provided officially can be maintained like a protocol.

In other words:

- as a way of abstraction, prototypes can stay open
- as part of shared infrastructure, prototypes can still pursue higher consistency

What Proto UI tries to push forward is not the one uniquely correct way to divide components.  
It is to let the public parts worth stabilizing keep evolving in a protocolized way.

---

## What does this article not expand on?

To keep the main thread clear, this article does not expand on:

- which sub-capabilities exist inside a prototype
- execution periods, lifecycles, and phase rules
- the engineering structure of adapters
- how a given host is concretely implemented

These topics will continue in later chapters.

---

## Next

If a component is to be understood as a protocol, the next question is:

> which parts inside a component are truly stable enough to be worth moving into that protocol layer?

That is exactly what the next article, [Information Flow Model](/en/whitepaper/information-flow-model/), discusses.
