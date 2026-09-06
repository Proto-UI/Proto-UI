---
title: 'Chapter 7: Evolving Within Boundaries'
description: 'How the current approximation can keep accepting revisions from theory, prototype libraries, and translation practice while preserving explicit boundaries.'
---

> If a Prototype is only our current approximation of a component's “essence,” how should Proto UI develop it, and how should it regard other possibilities that the official project has not chosen?

## One Viable Path, Not the Only Answer

Across the six chapters of its first two parts, this whitepaper has proposed the Prototype model and examined its translation layer. Together, they form one Proto UI answer to the problem of reusing interaction semantics across technologies.

But this is not the only possible answer.

Proto UI does not intend to monopolize the possibilities of Prototype or dictate which path of development is more “orthodox.” We hope to see more attempts to preserve shared assets for human-computer interaction—not people who accept similar ideas rejecting one another because they chose different implementation approaches.

This openness does not weaken Proto UI's own boundaries. Proto UI currently chooses to work at the Component level: it describes the identity and obligations that an interactive subject must retain across technological change, then translates them into existing Hosts. How a particular product composes components, how an application coordinates pages, and how a Host implements its own input and rendering mechanisms do not automatically become part of a Prototype merely because they are important.

A capability that does not enter Proto UI's portable core is not thereby without value. The distinction is who owns it. Requirements from a particular product may be owned by a Maker or higher-level system. Capabilities that depend on a Host may remain with the translation layer or Host. Another project may begin from the same problem and make entirely different choices.

Proto UI proposes a bounded approximation that can run and be tested. It does not claim the right to define the problem itself or exclusive authority to solve it.

## The Three Lines Proto UI Chooses to Pursue

Proto UI's work proceeds along three broadly connected lines.

### Prototype Libraries

Prototype libraries explore the identity of concrete Components one by one.

Proto UI maintains the Base prototype library to record foundational interaction semantics that depend as little as possible on any design language. Libraries with a particular visual and design direction can then be formed on top of it. The unofficial shadcn/ui-derived Prototypes maintained by Proto UI are one current example. They are still being cataloged, and within the scopes already made explicit they inherit the interaction foundation provided by Base and add the corresponding design-language projection.

This work is not just a matter of increasing component count. How should Switch behavior parameters be designed? May Select change form across media? Which Scroll Area mechanics should remain with the Host? Every Prototype tests again which semantics can be preserved across technologies.

Adoption can also be incremental. A Maker may use selected Prototypes only where cross-technology consistency is genuinely needed, without first turning the entire application into another framework.

### Translation Layer and Ecosystem

Without a translation layer, a Prototype cannot enter a new Host. A new translator also serves more than one component: it may expand the realization range of many existing Prototypes at once.

This relationship creates a compositional multiplier. When a Prototype for a design language and an Adapter for a Host both exist, and the Adapter can satisfy the Modules, Host Capabilities, and semantic obligations required by that Prototype, there is no need to write an entirely separate Host implementation for every component from the beginning.

This is not an unconditional Cartesian product. The existence of an Adapter does not mean it supports every Prototype. The ability to generate a Host artifact does not mean every semantic obligation has been faithfully translated. The range that can be composed still depends on concrete capabilities, translation outcomes, and evidence.

Translators also leave room for continued exploration. Different Adapters may connect to the same Host in different ways, and a Compiler may eventually perform more static work. Better performance, a more natural Host API, or greater fidelity all require concrete implementation and evidence; none follows automatically from choosing a translation form.

### Theory and Kernel

Theory and kernel maintain the expressive and runtime foundations shared by these explorations.

Is a new relation sufficient to become an information channel? Which responsibilities should a new Module own? As Prototypes become more complex, how can their expressive power grow without allowing Host details into portable semantics? These questions do not disappear when the first protocol version is complete.

Theory and kernel do not merely prescribe rules before practice begins. Problems encountered by prototype libraries and the translation layer test whether current concepts are complete, whether their boundaries are sound, and which responsibility a constraint actually protects.

The three lines are therefore not stages waiting on one another. Theory and kernel provide an expressive foundation; prototype libraries explore the identity of concrete Components; and the translation layer confronts those approximations with real Hosts. Each returns the questions it discovers to the same evolutionary process.

## A Path Outside the Main Lines May Still Be Valuable

Directions that Proto UI does not choose may still produce valuable results.

Someone may believe, for example, that Prototype theory contains foundations for building a cross-platform framework and want it to take responsibility for application structure, component composition, and framework-level coordination as well. This path extends beyond Proto UI's current Component boundary, but that does not make it wrong. It chooses to carry a different set of responsibilities and must face a different set of engineering costs.

People may also maintain custom Prototypes and Adapters for a particular business, fork Proto UI into a more radical or vertical version, or create an unrelated project that pursues the reuse of interaction knowledge through a completely different model and syntax.

These directions do not need Proto UI's approval before they can have value. Their successes, failures, and different tradeoffs may in turn reveal what the official path has overlooked. Proto UI chooses to maintain one shared main line; it does not claim to be the only legitimate version in this problem space.

## How Practice Revises the Current Approximation

Leaving room for other possibilities and revising Proto UI's own approximation are two sides of the same principle. If a Prototype is not a final definition, new practice must be allowed to show where it is inadequate.

Return once more to Switch. Earlier chapters began with the differences among Switch, Toggle, and Checkbox; divided Switch into Root and Thumb; described State, Lifecycle, and information channels; and attempted to translate those semantics into different Hosts.

This work increases our confidence in the current Switch Prototype, but it cannot prove that the Prototype is complete. A new implementation may discover an operation that cannot be expressed. A new interaction medium may make existing Feedback meaningless. A non-Web Host may reveal that we mistook a Web convention for a universal semantic.

We cannot respond by putting every problem into the Prototype, nor by assigning every problem to the Adapter. Different failures point to different objects of revision:

- If the Prototype states an obligation clearly but one implementation does not fulfill it, the problem is an implementation deviation.
- If the semantics can hold but the translation layer does not yet have the necessary Host capability, the problem is a translation capability gap.
- If a necessary Switch semantic has never been described, or the current definition overfits one class of Host, the Switch Prototype needs to be revised.
- If a failure reveals a new participant relation that no existing information channel can explain—or even a counterexample in which something must remain a Component despite having no external relation at all—then the more fundamental theory needs to be reexamined.

The evolutionary loop Proto UI seeks is this: propose an approximation, express it as a Prototype, realize it through Core, Runtime, and the translation layer, collect evidence from conformance tests, implementation failures, and real use, determine which layer of understanding was wrong, and revise that layer explicitly.

The word “explicitly” matters.

When an implementation differs from expectations, that implementation does not automatically become the new standard. A runnable Prototype does not make every judgment inside it a stable truth. Counterexamples from practice deserve careful attention, but we must still decide whether each exposes a local defect or justifies revising a more general theory.

The whitepaper provides philosophical direction. Spec refines the parts that can be governed by engineering into checkable obligations. Implementations and tests provide evidence of current behavior. Practice can drive changes to the whitepaper, Spec, a Prototype, or a translation boundary, but it should not silently override them. Otherwise, we cannot tell whether we are revising our understanding or merely finding explanations for accidental implementation outcomes.

## More Distant Tests Are Still Needed

Proto UI's current executable evidence still comes mainly from the Web family. Practice across React, Vue, and Web Component is valuable, but these technologies share many foundational conditions. They cannot by themselves prove that the same approximation holds in Flutter, Qt, or technologies that do not yet exist.

A new non-Web implementation therefore does more than expand a support list. Different structures, inputs, lifecycles, and rendering models test how far the current abstractions can travel. If future evidence shows that certain semantics cannot cross those boundaries, a reasonable outcome may be to improve the translation layer, revise a Prototype, narrow the theory's scope, or acknowledge that a combination is unsupported.

Another framework, a community Prototype, or even another Proto UI may provide equally important evidence. It does not need to follow the official path to help people understand this problem space more accurately.

An approximation that can be narrowed by counterexamples, corrected by practice, and coexist with other answers is more valuable than a theory that can explain every result and therefore can never fail.

If this exploration can continue over time, what we preserve will be more than one generation of component code. It will be a body of interaction knowledge that new technologies can continue to test, carry forward, and revise.
