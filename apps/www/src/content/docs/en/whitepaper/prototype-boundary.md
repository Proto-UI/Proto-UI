---
title: 'Prototype Boundary'
desp: 'What should go into a Prototype, and how prototypes should be split'
description: 'What should go into a Prototype, and how prototypes should be split'
draft: true
---

## What does this article answer?

The previous article discussed how Proto UI understands components through information flows.  
The next question is:

> when a component contains multiple substructures, which parts should stay in the same prototype, and which parts must be split into independent prototypes?

This is not only an engineering organization issue.  
It is about how Proto UI understands who a prototype is actually describing.

This article answers:

- why Proto UI cannot split or merge prototypes arbitrarily
- when a substructure must be treated as an independent prototype
- why "whether an information flow is activated" becomes the basis for judging prototype boundaries
- why this boundary is not only a modeling principle, but also appears in prototype syntax

---

## Proto UI cares about interactive subjects, not just chopping structure

If a prototype were only a way to write a visual tree, then the splitting rule would not matter much.

You could of course split:

- by visual region
- by DOM hierarchy
- by file size
- by author preference

All of those can work at the engineering level.  
But prototypes in Proto UI are not meant to describe "how many pieces the screen is cut into." They are meant to describe:

> **who is taking on an independent interaction responsibility.**

That means Proto UI cannot understand prototypes as arbitrary fragments of structure.  
Without a boundary principle, prototypes would degrade into a more abstract template-splitting system and lose their meaning as interactive subjects.

At its core, Proto UI cares about prototype splitting because it cares about this:

> whether a substructure has already formed an independent boundary of interaction responsibility.

---

## A prototype cannot lose its own anchoring structure

In Proto UI, a prototype is not a set of floating local rules.  
It has to attach to a clear interactive structure in order to count as a prototype.

So a prototype needs at least a root node,  
or at least an indispensable interactive anchoring structure.

The meaning of this constraint is not only structural.  
It guarantees that a prototype is always describing an interactive subject itself, rather than a loose set of capabilities that could be attached anywhere else.

That is also why the prototype syntax in Proto UI acts on the current prototype itself by default.  
If a structure has already broken away from that root attachment,  
it more likely means another prototype is already needed there.

---

## When should a substructure be treated as an independent prototype?

Proto UI uses a simple core judgment:

> **look at whether this substructure has begun to take on its own information-flow responsibility.**

In other words, to decide whether a substructure is still just part of its parent prototype,  
you cannot only look at whether it "looks like a local component." You have to look at whether it has begun exchanging information with the outside world in its own identity.

From this perspective, the boundary of a prototype is first of all not a visual boundary and not a code boundary.  
It is an **interaction-responsibility boundary**.

---

## Proto UI's splitting rules

In the current Proto UI, you can first understand prototype splitting with this set of rules:

### 1. If a substructure has any information-flow requirement other than `feedback`, it must be split into an independent prototype

Here, "information-flow requirement" includes but is not limited to:

- it begins responding to its own `event`
- it has its own independent `props`
- it `expose`s its own capabilities outward
- it subscribes to or distributes `context`

Once these relations appear, that substructure is no longer just an internal construction inside the parent prototype.  
It has begun facing users, makers, or other components in its own way.

From Proto UI's point of view, that means it has already become an independent interactive subject, and should therefore have an independent prototype.

### 2. If a substructure activates only the `feedback` flow, splitting is optional

If a substructure only handles `feedback`, things are less absolute.

Such a substructure is indeed participating in the information relationship between the component and the user,  
but it participates at a layer closer to presentation and perception.  
That alone does not necessarily mean it has already formed an independent center of interaction responsibility.

So Proto UI allows some flexibility here:

- you may keep it inside the parent prototype
- or you may split it out for reuse, clarity, or implementation convenience

### 3. If a substructure activates no information flow at all, it must not be split

If a substructure neither receives input, nor provides feedback outward, nor takes on configuration, exposure, or collaboration relations,  
then inside Proto UI it is still just an internal piece of the parent prototype.

If you force a split in that case, what you get is not a new interactive subject,  
but only an extra name for an internal structure.

That kind of split does not strengthen the expressive power of prototypes. It weakens their meaning instead.

---

## Why can `feedback-only` remain unsplit?

This is the easiest part of the rule set to pause over and question.

From a stricter logical point of view, as long as a substructure activates any information flow at all,  
it is entirely reasonable to split it into an independent prototype.  
After all, it is no longer a completely static and fully closed internal fragment.

But Proto UI does not take the most formal route here.  
The reason is simple:

> **engineering readability is also a real constraint in prototype design.**

The `feedback` flow sits closer to the layer of presentation and perception.  
If a substructure only handles `feedback`, it may indeed carry local meaning,  
but that meaning is not always strong enough to justify promoting it into an independent prototype.

If splitting were enforced uniformly here, then in theory you could get a more fine-grained and more uniform formal system.  
But in practice it often brings another problem:

- the number of prototypes rises quickly
- each prototype carries less information
- human developers have to switch back and forth among more tiny units
- the final result becomes more fragmented and harder to understand as a stable whole

In other words, `feedback-only` being optional is not because it is philosophically identical to "no flow activated."  
It is because Proto UI acknowledges a reality here:

> for human authors and maintainers, prototypes need to be not only correct, but also readable.

So this is an explicit engineering compromise.  
It preserves the main structure of the formal system while avoiding a prototype granularity that becomes too fine for humans.

---

## Once an independent flow appears, splitting is no longer a matter of style

Unlike `feedback-only`, once other flows appear, splitting stops being a preference choice.

### A substructure responds to its own `event`

If a local structure begins receiving input independently,  
it is no longer merely "being displayed." It is already participating in interaction decisions.

That means it is forming its own user flow.  
If you keep burying it entirely inside the parent prototype, the parent prototype starts taking on too much local interaction responsibility, and the boundary becomes confused.

### A substructure has independent `props`

When a substructure needs to be configured independently, it is no longer merely an internal detail of the parent structure.  
It becomes an object that upper layers can control explicitly.

At that point its relation with the `Maker` has already become independently valid,  
so Proto UI considers that it should have its own prototype boundary.

### A substructure `expose`s state or methods outward

If a substructure begins proactively exposing capabilities outward,  
then it is no longer only a piece of implementation inside the parent prototype. It is participating in a larger interaction system under its own identity.

Once that boundary appears, continuing to treat it as purely internal structure usually mixes prototype responsibilities together.

### A substructure subscribes to or distributes `context`

When a substructure begins sensing and participating in the environmental relationships of the component network,  
it has already entered another independent information flow.

At that point, what it takes on is no longer only local rendering responsibility, but a form of inter-component collaboration responsibility.  
Proto UI treats that as a sufficiently clear signal for an independent prototype.

---

## How Proto UI enforces prototype boundaries

In Proto UI, prototype boundaries are not only modeling advice.  
They also appear directly in syntax design.

For a substructure that still remains inside the parent prototype, Proto UI does not, by default, give the author capabilities like these:

- setting `props` for it independently
- binding `event`s for it independently
- letting it `expose` capabilities independently
- letting it participate in `context` relations independently

In other words, Proto UI does not support secretly making a substructure take on a second set of information-flow responsibilities before it has been split into an independent prototype.

That makes prototype splitting not a cleanup style applied afterward,  
but a boundary judgment constrained in advance at the syntax level.

The only flexibility kept here is the `feedback-only` case.  
If a substructure only handles `feedback`, Proto UI allows it to stay inside the parent prototype.  
But once it begins taking on other information-flow responsibilities, splitting stops being optional.

This restriction also feeds back into how prototype authors write.

Because Proto UI does not provide prototype-level structural composition by default,  
the author also cannot assume in advance how a substructure will later be combined with other prototypes.  
Under that condition, the more natural writing style is usually:

> keep interaction state and interaction responsibility as much as possible inside the current prototype itself,  
> rather than handing control in advance to an external prototype that does not yet actually exist.

From that perspective, prototype boundaries in Proto UI are not maintained only by conceptual explanation.  
They are fixed directly during writing through the deliberate absence of certain syntax capabilities.

---

## After splitting, composition returns to the host side

Proto UI requires substructures to be split into prototypes after they activate independent information flows,  
but the final composition among those prototypes is not completed on Proto UI's default main axis.

Proto UI does allow logic reuse at the prototype layer,  
for example by merging another piece of prototype logic into the current prototype.  
That is closer to inheritance or hook calls. It handles logic reuse, not final UI structural composition.

As for how multiple independent prototypes are assembled into the final interface, how they enter the business integration layer, and how they participate in more complex scenario scheduling,  
those things return to the host side by default.

That is also why Proto UI is not emphasizing "how to stitch structures together" here.  
It is emphasizing "which things must already be recognized as independent prototypes first."

---

## Prototype splitting is not about making things as fine-grained as possible

At this point, a common misunderstanding naturally appears:

> since Proto UI emphasizes boundaries so much, does that mean the finer you split prototypes, the better?

The answer is no.

Proto UI does not aim to keep cutting components into ever smaller units.  
It aims to make each prototype correspond, as much as possible, to one clear interactive subject.

Too little splitting mixes multiple responsibilities together.  
Too much splitting harms readability and degrades into purely formal micro-fragmentation.

So what Proto UI pursues is not the "smallest possible prototype," but:

> **a prototype granularity where interaction-responsibility boundaries are clear and still suitable for human understanding.**

That is also why information flow becomes the basis for judgment.  
It is closer than visual trees, template hierarchy, or implementation style to the question of whether a structure is truly taking on interaction responsibility independently.

---

## The real meaning of a prototype boundary

In Proto UI, an independent prototype is not only a structure that "can be named separately."  
It means something more specific:

> **this object already has an independent boundary of interaction responsibility.**

It needs to be described separately  
not because the author wants to split code apart,  
but because it has already begun to exist as its own interactive subject.

From this perspective, a prototype boundary is really answering:

- who this responsibility belongs to
- who is actually carrying this information flow
- which interactions should still be treated as internal details of the parent prototype, and which ones must already be modeled independently

That is why Proto UI keeps emphasizing prototype boundaries.  
Without that boundary, a prototype keeps sliding back and forth between "interactive subject" and "arbitrary structural fragment."

---

## What does this article not expand on?

To keep the main thread clear, this article does not continue into:

- the formal contract of each information flow
- the concrete writing style of prototype APIs
- how split prototypes are consumed by adapters
- how split semantics are kept consistent across different hosts
- how the host side takes on final composition and business integration

These questions will continue in later chapters.

---

## Next

If prototype boundaries have been established, the next question is no longer:

> which things should be split apart?

It becomes:

> **how do these identified prototypes and capabilities keep a stable order across time and execution?**

That is exactly the question discussed in the next article, [Execution Semantics](/en/whitepaper/execution-semantics/).
