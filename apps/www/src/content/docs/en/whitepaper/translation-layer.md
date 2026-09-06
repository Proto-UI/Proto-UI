---
title: 'Translation Layer: Adapter / Compiler'
desp: 'Adapters and compilers'
description: 'Adapters and compilers'
draft: true
---

## What does this article answer?

The previous chapters have already discussed:

- why components can be understood as protocols
- how Proto UI identifies the core relations of a component through information flows
- why prototype boundaries cannot be split arbitrarily
- why prototype semantics must remain stable through execution

The next question is:

> how do these prototypes, already defined, constrained, and organized, enter concrete hosts?

Proto UI prototypes are not the final implementation inside some host.  
They describe a higher-level interactive object, while a host accepts only the concrete artifacts it can actually carry.

So this article discusses:

- why a Proto UI prototype cannot be equated directly with host implementation
- why a prototype needs a translation layer in order to land
- what `Adapter` and `Compiler` each mean here
- how host boundaries affect the degree of reproduction

---

## A prototype is not an alias for host implementation

In Proto UI, a prototype describes the interaction semantics of a component.  
It answers questions such as:

- how this component exchanges information with the outside world
- on what boundary it stands
- how it unfolds through time
- which interaction semantics need to be preserved

What the host actually carries is something else:

- framework components
- platform controls
- DOM structure
- render trees
- handling logic inside the host's event system
- state and side-effect organization that fit host constraints

The relationship between a prototype and a host implementation is not "the same object written in another syntax."  
They are objects at two different levels.

Proto UI needs to let the prototype stay first at the interaction-semantics level,  
then enter a concrete host through an intermediate layer.  
That step is the translation layer.

---

## Why is a translation layer needed?

Proto UI needs a translation layer because what a prototype expresses is not host syntax, but interaction semantics.

Different hosts naturally have many differences:

- different capability boundaries
- different performance constraints
- different rendering models
- different state management patterns
- different ways of handling references and side effects
- different best practices and ecosystem habits

These differences do not disappear automatically just because the prototype is abstract enough.  
The more the prototype tries to stay host-independent, the clearer the translation layer has to be.

Without the translation layer, a prototype can only remain at the level of description.  
With the translation layer, it can become a real product inside the host.

---

## The translation layer is not only syntax conversion

The translation layer does more than rewrite one form into another.

In many cases, the host does not naturally provide all the capabilities required by the prototype contract.  
At that point, the translation layer not only translates, but also fills in what is missing.

For example, across Web technologies, hosts differ in how much direct support they have for `context`.  
React and Vue already have relatively mature context mechanisms, so connecting to the `context` contract in a prototype is comparatively direct.  
But Web Components do not have a native Context API. In that case, the Adapter has to build an additional working mechanism to carry the prototype's `context` semantics through.

Styling and feedback work in a similar way.  
On the Web, style tokens in a prototype can be handled relatively naturally by the CSS system, so different Web hosts can share a similar Styler.  
But in technologies without an external styling system, such as GUI hosts with their own rendering strategy, the translation layer needs an additional Styler module to connect feedback contracts with the host's rendering capabilities.

So the translation layer usually handles two things at once:

- mapping prototype semantics onto host capabilities
- filling in carrying mechanisms that the host itself does not directly provide

That is also why adapter-related engineering constraints are usually numerous.  
Whether a prototype contract can enter a host is ultimately concentrated in the translation layer.

---

## What do Adapter and Compiler each mean?

In Proto UI, the translation layer currently has two typical forms:

- `Adapter`
- `Compiler`

### Adapter

`Adapter` is closer to interpreting a prototype on the host side or during runtime.

It usually handles:

- connecting prototype semantics to host capabilities
- dealing with host-specific runtime organization
- filling in missing carrying capabilities when needed
- maintaining prototype contracts in a real runtime environment

At the current stage of Proto UI, `Adapter` is the more direct main path.  
It is easier for it to build a verifiable landing path in existing hosts.

### Compiler

`Compiler` is closer to transforming a prototype into artifacts for the target host at a more static stage.

It usually handles earlier generation work, such as:

- host component code
- more stable artifact structure
- implementation forms closer to host best practices

In the long run, `Compiler` will be an important direction for Proto UI.  
When prototype semantic boundaries are clear enough, a lot of translation work can happen earlier, bringing:

- better performance
- stronger analyzability
- artifact forms closer to host conventions

### They share the same semantic baseline

The difference between `Adapter` and `Compiler` lies mainly in translation style and timing.  
What they process is still the same set of prototype semantics:

- what the prototype defines
- which semantics must be preserved
- which differences can be absorbed

This does not change just because translation happens at runtime or at a more static stage.

---

## Why can translation be lossy?

Different hosts do not share exactly the same capability boundaries.  
That means the same prototype may naturally be reproduced to different degrees after entering different hosts.

Some hosts:

- carry certain interactions more easily
- preserve certain forms of feedback more easily
- express some context mechanisms more easily
- fit certain rendering and reference strategies better

Other hosts may:

- lack some native capability
- require heavier engineering completion
- reproduce certain kinds of feedback or interaction only approximately
- have to make real tradeoffs between performance and semantics

So translation loss is normal.  
Proto UI is not focused on "all hosts must be fully equivalent."  
It focuses on whether the core interaction semantics still stand after a prototype enters different hosts.

---

## How do host boundaries affect reproduction?

Host boundaries directly affect how faithfully a prototype can be reproduced.

These constraints may come from:

- the capability limits of the host
- the host's existing rendering and state model
- engineering cost and complexity
- differences in interaction media themselves

So the same prototype may legitimately show expression-level differences across hosts.  
The more important question is:

> are these differences still within the semantic boundary allowed by the prototype?

If the difference is only a different host expression while the core interaction responsibility remains unchanged,  
then it can still be treated as a valid landing of the same prototype.

If the difference has already broken the prototype's key flows, boundaries, or timing semantics,  
then it is no longer merely a matter of reproduction quality. It means the prototype was not correctly carried over.

---

## The `host` flow is not part of the default cross-platform core commitment

Proto UI can acknowledge that components have direct relations with hosts.  
Those relations matter in many scenarios.

But by default, the `host` flow is not part of Proto UI's main cross-platform commitment.

The reason is direct:

- the more specific the host, the harder its capabilities are to abstract
- the closer something is to the host itself, the harder it is to turn into protocol content shared across hosts

This does not prevent the `host` flow from existing,  
and it does not prevent some adapters from giving it important responsibility.  
It only means that for cross-platform prototypes, the more stable and more easily shared flows still enter the core commitment first.

So the closer a capability is to the host itself, the more it needs to be handled through the translation layer.

---

## What does the translation layer mean, in the end?

The existence of the translation layer means there is originally a distance between a prototype and host implementation that has to be dealt with.

The prototype describes interaction semantics.  
The host carries concrete implementation.  
Proto UI handles these as two separate things, and therefore must also separate out the step in between.

That step is the translation layer.

It is responsible for connecting prototypes to host capabilities,  
and for filling in missing carrying mechanisms when necessary.

The more independent the prototype is, the more obvious the importance of the translation layer becomes.  
The more real host differences are, the heavier the translation layer's responsibility becomes.

---

## What does this article not expand on?

To keep the main thread clear, this article does not continue into:

- the concrete API design of `Adapter`
- capability matrices for different hosts
- detailed constraints for `Host Caps`
- the specific `Adapter Guide`
- engineering modularization across different translation layers

These topics will continue in later engineering chapters and contract documents.

---

## Next

If the translation layer is in place, the next question is:

> in order to make prototypes, execution semantics, and the translation layer stand together, which constraints and tradeoffs does Proto UI need to accept proactively?

That is exactly what the next article, [Design Constraints](/en/whitepaper/design-constraints/), discusses.
