---
title: 'Evolution Path'
desp: 'How Proto UI starts from the Web and gradually expands to broader hosts'
description: 'How Proto UI starts from the Web and gradually expands to broader hosts'
draft: true
---

## What does this article answer?

The earlier chapters discussed Proto UI's core model, boundaries, and constraints.  
The next question is:

> how is a system like this supposed to evolve?

This article does not discuss specific version plans, and it does not replace milestone documents.  
It focuses more on Proto UI's direction:

- why Proto UI needs staged evolution
- what its near-term main axis is
- where it may go over the longer term
- which work will continue across all stages

---

## Proto UI will not arrive all at once

The problem Proto UI is trying to handle already spans multiple layers:

- how prototypes express interaction semantics stably
- how adapters carry different hosts
- how different hosts maintain sufficiently high consistency
- how the protocol layer remains valid in real engineering over the long term

Problems like these are difficult to solve in one shot through a one-time design.  
If you pursue "cover every host" or "unify all capabilities" too early, the system usually loses its boundaries first and then loses quality.

So Proto UI's evolution will not be all at once.  
It is closer to a process of standing firm layer by layer:

> first establish a semantic baseline in a more controllable group of hosts,  
> then gradually expand into more complex and more heterogeneous environments.

---

## Stage 1: stand firmly in the Web first

Proto UI will start from the Web first.

The reason is not complicated:

- the Web has a rich enough host ecosystem
- different frameworks have both differences and a large shared capability foundation
- this is a better place to first verify whether prototypes, adapters, and execution semantics really stand

So the main axis of v0 is relatively clear:

- serve multiple framework ecosystems on the Web
- establish the basic migratability of prototypes across Web hosts
- let Proto UI get initial use in real projects
- accumulate real experience with adapters and prototype libraries

The focus at this stage is not "how far can we go?"  
It is to answer a more critical question first:

> can Proto UI establish a sufficiently stable interaction-protocol foundation among a set of hosts that share strong common capabilities?

If that point cannot stand, later expansion has no meaning.

---

## Stage 2: expand into native hosts

After standing firmly on the Web, Proto UI's next step is to expand into broader native hosts.

That may include:

- Flutter
- Qt
- native technologies on different platforms
- other hosts with independent rendering and event models

The biggest difference between this stage and the Web stage is not simply that there are more hosts.  
It is that the heterogeneity among hosts becomes much stronger.

That means Proto UI has to face more issues:

- less uniform rendering capabilities
- more divergent interaction media
- more complex ways of carrying feedback
- heavier completion responsibility in adapters

So the focus of v1 will not only be "support more hosts."  
It will also include another more important thing:

> for hosts that already have official adapters and clearly defined adaptation contracts, gradually establish a higher level of quality assurance.

That level of assurance should ultimately approach industrial-grade quality.  
But whether it can truly stand still depends on actual usage scale, feedback density, and ecosystem maturity.  
Proto UI will not declare that it has already reached that point before sufficient validation exists.

---

## A longer-term direction: from covering hosts to influencing host choice

Once Proto UI can already cover enough hosts, its role may change somewhat.

At earlier stages, Proto UI is more like it is following hosts:  
where an existing ecosystem exists, it tries to translate prototypes there.

But once coverage is wide enough and the semantic baseline is stable enough, another situation may appear:

> people may begin to care not only about "can Proto UI adapt to this host?"  
> but also "given the existing adaptation conditions, which host is the better choice?"

At that point, Proto UI may no longer only lower the cost of switching hosts.  
It may start influencing host choice itself.

Longer-term directions may include:

- adaptation targets closer to lower-level runtime layers
- higher-performance compilation paths
- host support closer to graphics libraries, input systems, or lower-level carrier environments

At the moment, these directions are better treated as long-term possibilities, not concrete commitments.  
They depend not only on theory holding, but also on:

- the maturity of prototype capabilities
- the stability of the translation layer
- a sufficiently large scale of real-world usage
- continuous accumulation by the community and ecosystem

So Proto UI will keep this sense of direction, but will not turn it into a detailed roadmap too early.

---

## One line of work will run through every stage

No matter which stage Proto UI is in, one line of work will remain continuous:

> **make prototypes more faithful, and adapters more reliable.**

This will show up in several directions:

- extending the prototype's expressive power for interaction semantics
- improving how well official adapters carry prototype contracts
- improving accessibility support
- improving interaction quality in specific niche scenarios
- keeping higher consistency for the same prototype across more hosts

These capabilities will not suddenly be finished in one version.  
They are long-term work that runs through every stage of Proto UI.

From that point of view, version evolution is not only "supporting more hosts."  
It also includes:

> whether the same prototype can be reproduced with increasingly high fidelity.

---

## The toolchain will grow together with the protocol layer

As prototypes and adapters gradually mature,  
the surrounding Proto UI toolchain will also gradually appear.

That may include:

- visual design tools
- debugging tools
- playgrounds
- comparison and verification tools for adaptation results

The value of these tools is not only improving development efficiency.  
It is also to help Proto UI turn the goals of being describable, translatable, and verifiable into more concrete workflows.

At the current stage, however, the toolchain still belongs to later growth.  
It will develop together with prototypes and adapters, rather than becoming the main axis ahead of them.

---

## What does this article not expand on?

To keep the main thread clear, this article does not continue into:

- feature lists for specific version numbers
- detailed milestones for every stage
- commercialization models
- release schedules for each toolchain item

These are better placed in milestone documents, FAQ, or product explanations.

---

## Next

You can keep reading according to your own focus:

- If you want to continue clarifying Proto UI's boundaries and common questions, go to [FAQ](/en/whitepaper/faq/)
- If you care more about how these principles become formal contracts, go to [Specifications / Introduction](/en/specifications/introduction/)
- If you care more about how these principles stand in code and runtime, go to [Build / Overview](/en/build/)
- If, after finishing the whitepaper, you want to participate in ecosystem building, go to [Contribute](/en/contribute/)
