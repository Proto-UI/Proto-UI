---
title: 'Execution Semantics'
desp: 'Execution model and semantics'
description: 'Execution model and semantics'
draft: true
---

## What does this article answer?

The previous chapters have already discussed:

- why components can be understood as protocols
- how Proto UI identifies the core relations of a component through information flows
- when a substructure should be treated as an independent prototype

The next question is:

> how do these identified prototypes actually come to exist through time?

If a prototype were only static structure, at most it could describe what a component contains.  
But as an interactive subject, a component does not come to exist in a static way.  
It enters a host, moves through phases, activates capabilities, responds to input, produces feedback, and exits those relations when appropriate.

So this article answers:

- why Proto UI prototypes are not static descriptions
- why Proto UI must distinguish `setup` from `runtime`
- why lifecycle is not an auxiliary feature, but part of what makes interaction semantics valid
- in what sense Proto UI's idea of consistency actually holds

---

## A prototype is not static structure

In Proto UI, a prototype is not only a structural description of "what the component looks like."

It describes an interactive subject that unfolds over time.  
That subject does not have the same capabilities at every moment, and it does not carry the same responsibilities in every phase.

Some things should happen only in the definition phase, such as:

- declaring which interactions it responds to
- declaring which states and feedback it has
- planning which capabilities it will expose

Other things can happen only when it is truly running, such as:

- reading the current state
- responding to a concrete input
- triggering side effects
- adjusting behavior under context changes

If all of this is mixed at the same level, a prototype turns into something that both describes itself and executes itself on the fly.  
That mixture may work in a local implementation, but it is hard to keep as a stable protocol object.

So for Proto UI, execution semantics are not extra detail. They are a necessary condition for a prototype to stand.

Without execution semantics, a prototype has only structure.  
With execution semantics, it truly becomes an interactive subject that exists through time.

---

## Why must `setup` and `runtime` be distinguished?

Proto UI first makes a basic split in the execution process of a prototype:

- `setup`
- `runtime`

### setup

`setup` is the period of defining, planning, and declaring interaction behavior.

In this period, the prototype has not yet entered a concrete run.  
It is closer to stating:

- which capabilities this interactive subject will have
- how it will organize its flows and state
- which rules it will follow in later execution

The focus of `setup` is not "executing one interaction."  
It is "making the interactive subject clear."

### runtime

`runtime` is the period when the prototype truly enters the host and begins taking on concrete interaction responsibility.

In this period, the component is no longer only an object being described.  
It is an object in operation. It will:

- receive input
- read state
- participate in context changes
- produce feedback
- trigger side effects
- show different capabilities as lifecycle progresses

From this perspective, `runtime` is not an accessory phase attached to `setup`.  
It is the period in which the prototype really functions as an interactive subject.

---

## Why does this staging matter?

The distinction between `setup` and `runtime` first of all avoids a common kind of mixture:

> writing descriptive behavior and executable behavior at the same level.

Once that mixture appears, prototypes quickly lose several key properties:

- **understandability**: the reader can no longer tell whether a piece of content is declaring a capability or consuming one
- **translatability**: the Adapter can no longer stably tell which parts are definitions to interpret and which are runtime operations
- **verifiability**: when semantic boundaries blur, many consistency requirements degrade into "implementations should try their best to align"

Proto UI emphasizes execution periods not to make components harder to write,  
but to fix these boundaries in advance.

Only then can a prototype avoid becoming a script whose intent a host merely "roughly guesses,"  
and instead remain a translatable, constrainable interaction definition.

---

## What role does lifecycle play here?

`setup` and `runtime` distinguish definition-time from run-time,  
but that is still not enough.

Once inside `runtime`, a component still does not stay in the same state at every moment.  
It still has to face questions such as:

- when does it begin to stand up as valid?
- when are certain capabilities already active?
- when are certain capabilities still valid?
- when should it release responsibility and exit the current relation?

That is what lifecycle organizes.

From Proto UI's perspective, lifecycle is not a convenience mechanism attached to the side of a prototype.  
It is the way prototype capability boundaries continue to be organized along the time dimension.

Without lifecycle, `runtime` would only be an overly broad period.  
With lifecycle, a prototype gains a finer temporal order.

---

## `setup` and lifecycle are not the same thing

There is an easy confusion here.

`setup` and `runtime` deal with coarse-grained execution staging.  
Lifecycle handles the progression of stages and capability boundaries inside `runtime`.

That is:

- `setup` and `runtime` distinguish "definition" from "execution"
- lifecycle further distinguishes different phases inside execution

These are not substitutes for each other. They organize at different levels.

Without the split between `setup` and `runtime`,  
lifecycle easily degrades into scattered implementation-level callback conventions.

Without lifecycle,  
`runtime` becomes a broad period that lacks internal order.

Proto UI needs both layers at once  
to keep prototype boundaries clear over time.

---

## Execution semantics are not only about lifecycle

Lifecycle is a core part of execution semantics, but it is not the whole thing.

What execution semantics really cares about is:

> **for the same prototype across different adaptation results, which interaction semantics must stay consistent, and how strict that consistency should be.**

This involves at least a few typical questions.

### Consistency of `feedback`

After a prototype enters different hosts, feedback should not be merely "roughly the same idea."  
Especially when those hosts share similar capability foundations, Proto UI's requirement for consistency is not loose.

For example, when adapting to different hosts inside the Web stack, such as React, Vue, and Web Components,  
those hosts have almost the same potential in the `feedback` flow.  
That means Proto UI does not treat "looks close enough" as sufficient.

In that case, the consistency target should be as close as possible to:

- the same visual structure
- the same feedback behavior
- minimal reproduction difference

In the ideal case, they should even be close to identical in every small detail.  
At worst, they should approach what people call "pixel-level consistency."

In other words, Proto UI's requirement for consistency is not naturally loose.  
When hosts share enough carrying conditions, it demands very strict fidelity.

### Consistency of `event`

Consistency in the `event` flow is more about consistency of interaction form.

For example, for the same interaction related to "click" or "long press,"  
there may be subtle trigger differences across hosts:

- the trigger moment differs slightly
- the recognition condition differs slightly
- the behavioral boundary differs slightly under some interaction media

These differences do not necessarily break the prototype,  
but they also cannot simply be treated as "close enough anyway."

What Proto UI cares about here is:

> whether the same interaction semantic is still reproduced as the same kind of interaction responsibility in different hosts.

If the difference becomes large enough to change the nature of the interaction itself,  
then it is no longer only a host difference. The prototype semantics themselves have drifted.

### Consistency of lifecycle and capability activation

Consistency related to lifecycle is reflected in:

- when certain capabilities have already become valid
- when certain capabilities are still valid
- in which phase some interactions and feedback should happen

If these boundaries are handled arbitrarily across hosts,  
then even if the same prototype appears to "have all the features," it may still be something completely different in temporal order.

So lifecycle consistency is not an extra requirement.  
It is one of the foundational conditions for Proto UI to preserve semantic continuity.

---

## Proto UI's consistency requirements are not always equally strict

At this point, another misunderstanding also needs to be removed:

> does Proto UI require behavior in all hosts to be made as identical as possible?

The answer is not simply yes or no.  
It depends on how many capability assumptions those hosts share, and how the prototype itself defines the boundary of differences.

### Consistency is stricter among hosts with stronger common foundations

If two hosts are essentially built on similar capability foundations,  
Proto UI will ask more of them.

For example, hosts within the Web stack share many of the same capability assumptions.  
In that case, Proto UI would theoretically want them to:

- generate almost identical DOM structure
- present almost identical visual results
- have extremely similar interaction and timing behavior

The goal here is not "similar style is fine."  
It is to preserve a high-fidelity isomorphic reproduction as much as possible.

### In cross-platform scenarios, consistency is determined by prototype rules

But if the interaction medium itself changes across hosts,  
then the consistency Proto UI asks for no longer means "the visible form must look the same."

For example, an interaction presented as a dropdown on desktop  
does not necessarily need to keep the same presentation on mobile.  
In many scenarios, presenting it as a drawer-style picker is actually more natural.

The key question here is not "does it look exactly the same?"  
It is:

> **does this difference still stay within the semantic boundary allowed by the prototype?**

Proto UI does not automatically require:

- a dropdown on desktop
- and therefore also a dropdown on mobile

Instead, this kind of difference should be defined by the prototype itself.

Because a Proto UI prototype does not describe only static output.  
It can also describe:

- medium-specific event handling for different interaction media
- differentiated logic under different host conditions
- which changes count as acceptable host-specific expression, and which changes would break the interactive subject itself

So in cross-platform scenarios, consistency does not mean "forms must be identical."  
It means "within the range allowed by prototype rules, the same interactive subject is preserved."

---

## What do execution semantics really constrain?

Taken together, Proto UI's execution semantics actually constrain three things:

- **when to define, and when to execute**
- **when something becomes valid, remains usable, and is released**
- **for the same prototype across different hosts, which semantics must stay consistent and which differences the prototype may absorb**

That is why execution semantics are not only runtime detail.  
They do not decide merely whether an implementation is easy or hard to write.  
They decide this instead:

> **whether the same prototype can still be treated as the same interactive subject across different adaptation results.**

Without this layer of constraint, Proto UI could still write down a prototype syntax.  
But it would be very hard to keep those prototypes as genuine protocol objects.

---

## What does this article not expand on?

To keep the main thread clear, this article does not continue into:

- the full list of period APIs
- concrete gating points in Adapter lifecycle
- runtime architecture at the engineering layer
- how each host implements these semantic constraints one by one

These topics will continue in later chapters or engineering documents.

---

## Next

If execution semantics are in place, the next question is:

> how do these constrained prototype semantics enter a concrete host and become implemented there?

That is exactly what the next article, [Translation Layer: Adapter / Compiler](/en/whitepaper/translation-layer/), discusses.
