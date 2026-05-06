---
title: 'Information Flow Model'
desp: 'How Proto UI defines components'
description: 'How Proto UI defines components'
---

## What does this article answer?

In the previous article, components were understood as interactive objects that can be handled as protocols.  
The next question is:

> if a component is to be described completely, what is the most natural way to divide it?

Proto UI does not start from an API list, and it does not start from host implementation either.  
It starts from something more basic:

> **who this component is exchanging information with.**

This article discusses the foundational perspective Proto UI uses to organize prototype capabilities: the **Information Flow Model**.

---

## Components do not exist in isolation

A component becomes a component not only because it has internal state, structure, or logic,  
but because it always exists in relationships.

It is operated by people, used by applications, influenced by other components, and may influence the outside world in return.  
If all of these relations are erased, what remains is only an implementation, not an interactive unit.

So when describing a component, the most natural questions are often not:

- which functions it has
- which fields it has
- how it is declared in some framework

But:

- which objects it faces
- what information it exchanges with them
- in which direction those exchanges happen

Proto UI calls this perspective the **Information Flow Model**.

---

## Proto UI starts by splitting component relations through "users"

In Proto UI, a component usually faces at least three typical kinds of objects:

- **User**
- **Maker**
- **Other Component**

Here, "users" does not mean job roles in a product team, nor divisions of labor.  
They are abstractions of a component's interaction relationships.

### User

`User` refers to the object that directly perceives and operates the component.  
Usually, that means the end user of the product.

The component provides visual, auditory, tactile, or other forms of feedback to the user,  
and the user acts on the component through clicks, typing, gestures, focus changes, and so on.

### Maker

`Maker` refers to the person or system that assembles, configures, and consumes the component.  
It does not have to be a human. It may also be application code, a page author, or upper-level business logic.

In this relationship, the component is not being directly operated. It is being set, read, and connected into a larger system.

### Other Component

Components do not relate only to end users or consuming code.  
They may also sit inside a component network, sharing environment, conveying semantics, or building cooperation with other components.

So Proto UI needs to account for a third relationship target as well: **Other Component**.

This relationship is not always explicit, and not always as direct as `props`.  
But it is still part of the component's interaction.

---

## What is an information flow?

When a component exchanges information with these objects, what forms is what Proto UI calls an **information flow**.

An information flow is not a set of API names,  
and it is not only a documentation-level categorization trick.  
It is closer to an organizing principle:

> **first look at who the component is exchanging information with, then look at what capabilities are needed to express that exchange.**

From this point of view, many capabilities that originally look different are really only specific manifestations on different flows.

That is also why Proto UI does not first enumerate a batch of capabilities and then look for reasons to justify them.  
Instead, the organization of capabilities itself is derived from these relationships.

---

## Which core capabilities follow from the information flows?

If you look at the directions of information exchange, several core capabilities in Proto UI emerge naturally.

### User ↔ Component

The relationship between user and component contains at least two directions:

- the user brings information to the component
- the component feeds information back to the user

So two core capabilities appear:

- `event`: User → Component
- `feedback`: Component → User

`event` describes how the user acts on the component.  
`feedback` describes how the component feeds its state and result back to the user.

These are not arbitrary names matched together.  
They are the natural unfolding of the user flow in two directions.

### Maker ↔ Component

When a component is used by an upper-level system, there are also two basic directions:

- the upper layer passes configuration or input to the component
- the component exposes capabilities or results to the upper layer

So another two capabilities appear:

- `props`: Maker → Component
- `expose`: Component → Maker

`props` do not exist merely because some framework happens to have props.  
They exist because a component, as something being used, inherently needs to receive information from its external assembler.

`expose` is not an extra feature either.  
It exists because a component does not only receive passively. It also needs to provide consumable capabilities outward.

### Other Component ↔ Component

When a component sits inside a larger component network, another kind of relationship appears.  
It is not directly facing the end user, and it is not only being assembled unilaterally by a Maker. It exists inside a shared environment or semantic linkage.

Proto UI collects this part into:

- `context`

`context` does not correspond to a single one-shot input/output direction.  
It corresponds to a more environmental relationship: how a component senses its surrounding context and forms stable cooperation with nearby components.

So the appearance of `context` is not to round out an API style. It is because the component network itself forms an independent information flow.

---

## Why are these capabilities not arbitrarily enumerated?

From the perspective of the Information Flow Model, `feedback`, `event`, `props`, `expose`, and `context` are not just a few high-frequency words picked at random.

They become Proto UI's core sub-capabilities because:

- each of them corresponds to information exchange between the component and a typical relation target
- these exchanges are not unique to one framework, but are recurring basic relations whenever a component acts as an interactive object
- without any one of them, the description of the component becomes obviously distorted in some direction

In other words, this set of capabilities is not distilled from implementation habits.  
It is derived from the question of how a component must relate to the outside world.

That is why the Information Flow Model is not only a categorization technique.  
It is the basis for how Proto UI organizes prototype syntax.

---

## Information flows are not the whole component

Information flows explain most exchange relations between a component and the outside world,  
but they still do not cover the whole component.

Besides "who exchanges what information with whom," a component also has internal dimensions that do not directly belong to external exchange, such as:

- `state`
- `lifecycle`
- `meta`

Their roles are not the same:

- `state` handles the internal statefulness of the component
- `lifecycle` handles order across time and execution phases
- `meta` handles self-description and extra semantics

These dimensions cannot simply be folded into one information flow,  
but they are still necessary parts of what a prototype must face.

So Proto UI's definition of a component is not only "flows."  
Outside information flows, it still keeps a set of independent internal dimensions.

---

## Can information flows be extended?

Yes.

The Information Flow Model is not closed.  
If a component faces a new kind of relationship target that is stable and important enough, then a new flow can become valid.

For example, there may be a more direct relationship between a component and the host itself.  
It may involve platform capabilities, system environment, device preferences, or other exchange patterns that do not fit naturally into `User`, `Maker`, or `Other Component`.

Proto UI can acknowledge that direction and treat it as a potential `host` flow.

But by default, Proto UI does not make these highly host-dependent capabilities the main axis of cross-platform prototypes.  
The reason is simple:

> the more specific the host, the weaker the generality;  
> the closer something is to the host itself, the harder it is to make it part of a cross-host protocol.

So the Information Flow Model is open,  
but Proto UI still remains cautious about which flows should enter the core prototype.

The following diagram summarizes the relationships described above:

```mermaid
graph TB
    User["User"] -->|"event"| Component["Component"]
    Component -->|"feedback"| User
    Maker["Maker"] -->|"props"| Component
    Component -->|"expose"| Maker
    Other["Other Component"] <-.->|"context"| Component
    Component --- State["state"]
    Component --- Lifecycle["lifecycle"]
    Component --- Meta["meta"]
    Host["Host"] -.->|"host (potential)"| Component
```

*Figure: The Information Flow Model. The component exchanges information with User, Maker, and Other Component through event, feedback, props, expose, and context. Internal dimensions (state, lifecycle, meta) handle aspects that do not directly belong to external exchange. The host flow (dotted) is a potential extension.*

---

## What does this article not expand on?

To keep the main thread clear, this article does not continue into:

- the formal contract of each flow
- the concrete API of each sub-capability
- how prototypes should be split
- how different capabilities are constrained during execution

These questions will be discussed separately in later chapters.

---

## Next

If the Information Flow Model holds, the next question becomes:

> when a component contains this many relations and dimensions, which parts should stay in the same prototype, and which parts should be split apart?

That is exactly what the next article, [Prototype Boundary](/en/whitepaper/prototype-boundary/), discusses.
