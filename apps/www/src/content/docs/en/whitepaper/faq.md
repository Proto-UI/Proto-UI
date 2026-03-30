---
title: 'FAQ'
desp: 'Common questions and boundary notes about Proto UI'
description: 'Common questions and boundary notes about Proto UI'
---

## What is this page for?

This page answers the most common misunderstandings, boundary questions, and positioning questions around Proto UI.

It does not replace the main whitepaper text, and it does not replace the later `Specifications` or `Engineering` documents.  
If you have already read the main whitepaper thread but still have questions about Proto UI's position, boundaries, or attitude toward the ecosystem, this page is a better fit.

---

## 1. Is Proto UI a framework?

**No.**

By default, Proto UI does not take responsibility for final UI composition, business integration, or framework-level scheduling, so it does not define itself as a framework.

Put more directly, frameworks usually organize how a whole application or interface runs.  
Proto UI focuses on another layer:

> **stabilizing the interaction semantics of components and bringing them into different hosts.**

Its main product is not "a whole UI," but "components that can be carried by different hosts."

For users, that also means something important:  
you do not need to master Proto UI's prototype system in full before you can start using the component results Proto UI brings.

In many scenarios, Proto UI is more like a layer of component infrastructure beside your current framework.  
It cares about:

- better component usability
- stronger accessibility support
- more consistent cross-host interaction experience
- bringing in hosts that originally had no mature component ecosystem

---

## 2. What is the difference between Proto UI and cross-platform frameworks?

**Cross-platform support is one result of Proto UI, but not its core pursuit.**

What Proto UI actually wants to solve is:

> **separating the interaction logic inside components as much as possible from any specific technical solution.**

Once that holds, cross-platform capability appears naturally,  
because the same prototype can be translated into different hosts.

But Proto UI is not focused only on "can it cross platforms?"  
It is focused on:

- whether interaction semantics can be described stably
- whether they can be reproduced in different hosts with sufficiently high fidelity
- whether they can exist as long-term maintainable public infrastructure

So cross-platform support is more like an outward capability of Proto UI,  
not the whole reason Proto UI exists.

---

## 3. What is the relationship between Proto UI and component libraries?

**Proto UI can serve as the underlying foundation of a component library.**

The core value of a component library written with Proto UI is not only that it is usable in one framework.  
It is that its component prototypes can be carried by different hosts.

That means:

- one prototype can correspond to multiple adaptation results
- a component library does not have to be rewritten from scratch for every host
- the combination of official prototypes and official adapters can naturally cover hosts that Proto UI has already landed in
- community adapters can keep extending that range further

So if you place Proto UI underneath a component library, the relationship is closer to this:

> **Proto UI is not a component library itself. It is the foundational layer that lets component libraries grow across hosts.**

---

## 4. Why doesn't Proto UI provide prototype-level composition?

**Because Proto UI does not intend to make itself into a framework.**

Once prototype-level composition keeps going further, it usually runs directly into questions like:

- how the final UI should be organized
- how different prototypes enter the business integration layer
- how events and updates should be scheduled in more complex scenarios
- which upper-layer capabilities should be taken over uniformly by the system

All of these are already very close to framework-level issues.  
And those issues themselves are usually highly host-dependent and hard to turn into a single cross-platform answer that remains stable over time.

Proto UI's choice here is:

> **focus on doing component modeling well, without trying to produce a grand unified final framework.**

This does not prevent each host from continuing to shine in the layers it is already good at.  
A system like React already has mature ways to organize and schedule things. Proto UI has no need to rebuild those layers again.

---

## 5. Why must a substructure be split once it takes on an independent information flow?

**Because at that point it is already taking on independent interaction responsibility.**

Once a substructure starts having its own `event`, `props`, `expose`, or `context` relations,  
it is no longer just a static structure inside the parent prototype.  
It has already begun exchanging information with the outside world under its own identity.

If it still remains inside the parent prototype, that usually creates two problems:

- the parent prototype's responsibilities start getting mixed together
- the boundary of interaction responsibility becomes less and less clear

So Proto UI's judgment here is direct:

> **once an independent information flow becomes valid, it should correspond to an independent prototype.**

This is not only for formal neatness.  
It is also so that every prototype corresponds, as much as possible, to one clear interactive subject.

---

## 6. Why can `feedback-only` remain unsplit?

**Because at this point Proto UI chooses a granularity that is better suited to human understanding.**

From a stricter formal point of view, as long as a substructure activates any information flow, it is reasonable to split it into an independent prototype.  
But `feedback` sits closer to the layer of presentation and perception. It is not always strong enough to require being elevated into its own prototype.

If every `feedback-only` local structure were also forcibly split,  
the prototype system would become more orderly, but also clearly more fragmented:

- more prototypes
- less information in each prototype
- harder to form an overall understanding while reading and maintaining

So Proto UI keeps flexibility here:

> **`feedback-only` may be split, but it is not required to be split.**

This is not because it is unimportant.  
It is because Proto UI cares more, at this point, about the balance between clear boundaries and overall readability.

---

## 7. How strict is the consistency Proto UI talks about?

**It depends on how much foundation the hosts share.**

A very intuitive principle is:

> **the more capability foundations hosts share, the stricter Proto UI's consistency requirement becomes.**

For example, among Web hosts, they share a lot of the same rendering and interaction foundation,  
so Proto UI usually wants their adaptation results to be as close as possible:

- structure as close as possible
- feedback as close as possible
- behavior as close as possible

In cross-platform scenarios, because interaction media, host capabilities, and rendering models differ more,  
consistency stops being only about "looking exactly the same."  
It is more about:

- whether the core interaction semantics still remain
- whether the relative lifecycle order is still consistent
- whether the difference boundary allowed by the prototype is respected

So the consistency Proto UI talks about does not mean "they must always look the same."  
It means:

> **the same prototype still remains the same interactive subject across different hosts.**

---

## 8. Why are requirements stricter among Web hosts, while cross-platform scenarios allow more difference?

**Because these two situations face different real conditions.**

Among Web hosts, the shared foundation is larger:

- similar rendering environments
- similar event systems
- similar ways of carrying feedback
- similar structural expressive power

That gives Proto UI more room to demand high-fidelity consistency.

Cross-platform scenarios face a different problem:  
different media themselves may naturally suit different interaction forms better.

For example, the same prototype on desktop and mobile  
does not necessarily need to insist on exactly the same interaction shape.  
Some interactions that feel natural on desktop can become awkward if copied directly onto mobile.

So more precisely, it is not "cross-platform is naturally looser."  
It is:

> **Proto UI would rather let a prototype present a shape that is more appropriate to that medium across different interaction media.**

Whether such differences are allowed is not decided arbitrarily by the host.  
It is constrained by the prototype's own rules.

---

## 9. How does the official project view community adapters?

**Supportive, and welcoming.**

Proto UI does not intend to monopolize the right to write adapters.  
The emergence of more community adapters is itself part of ecosystem growth.

The official attitude is closer to this:

- community adapters are welcome
- they may use their own governance style
- when appropriate, they may also be merged back into the official system
- for some hosts, the official project may even directly recommend a community implementation that is maintained more maturely

At the same time, the official project will still try to provide at least one official adapter for important hosts  
as a more neutral and stable baseline carrying solution.

Whether something enters the range of "official quality assurance" depends on:

- whether the contract is clear
- whether maintenance is stable
- whether usage and validation are sufficiently adequate

So a community adapter is not "unimportant because it is unofficial,"  
and it is not "automatically official support the moment it appears."

---

## 10. How does the official project view community prototypes?

**Also supportive, and welcoming.**

Proto UI does not intend to monopolize the right to write prototypes either.  
The community can absolutely build its own prototype systems, and may even extend its own prototype syntax for domain-specific or business-specific needs.

Of course, if such an extension has already moved away from the shared semantic baseline of official prototypes,  
then it is usually more appropriate for it to continue as its own branch, its own project, or its own fork,  
rather than necessarily being merged back into the official mainline.

What the official project hopes to do here is:

> **maintain a set of prototypes that is as neutral, stable, and suitable for public infrastructure as possible.**

That means:

- community prototypes can be more aggressive, more vertical, and closer to specific business needs
- official prototypes emphasize public value, stability, and long-term consistency more strongly

As with community adapters,  
if some community prototypes become mature and stable enough in practice, they may also be recommended officially to developers.  
What the official project maintains is a public main axis, not the only legitimate version of the prototype world.

---

## Still have other questions?

This FAQ only covers the most common questions for now.  
If you still have other questions, discussion is welcome.

Questions that are suitable for long-term accumulation and searchability fit better in GitHub Discussions.  
Questions better suited to quick exchanges, temporary follow-ups, or more open-ended discussion fit better in the [Discord community](https://discord.gg/MrWQd7h34R).

If a question comes up repeatedly, it may also later enter the FAQ or the whitepaper itself.
