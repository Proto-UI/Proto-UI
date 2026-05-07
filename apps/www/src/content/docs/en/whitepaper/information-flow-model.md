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

The following diagram summarizes the relationships described above. The caption describes the same relationships so the model remains understandable without the image:

<figure class="information-flow-diagram" style="margin: 2rem 0;">
  <svg role="img" aria-labelledby="information-flow-diagram-title information-flow-diagram-desc" viewBox="0 0 960 460" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%; height: auto; color: var(--sl-color-text, #111827); font-family: var(--sl-font-system, system-ui, sans-serif);">
    <title id="information-flow-diagram-title">Information Flow Model</title>
    <desc id="information-flow-diagram-desc">User event and Maker props enter the Component. Inside the Component, intent and state organize behavior. Feedback leaves the Component through host rendering and returns to the User. Other Component exchanges context with the Component, and the Component can expose capabilities back to Maker.</desc>
    <defs>
      <marker id="flow-arrow-accent" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0 0L10 5L0 10Z" fill="var(--sl-color-accent, #2563eb)" />
      </marker>
      <marker id="flow-arrow-muted" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10Z" fill="var(--sl-color-gray-4, #94a3b8)" />
      </marker>
    </defs>
    <rect x="32" y="24" width="896" height="390" rx="18" fill="var(--sl-color-bg-nav, #f8fafc)" stroke="var(--sl-color-gray-5, #cbd5e1)" />
    <text x="480" y="58" text-anchor="middle" fill="currentColor" font-size="24" font-weight="700">Information Flow Model</text>
    <rect x="80" y="76" width="180" height="70" rx="10" fill="var(--sl-color-bg, #ffffff)" stroke="var(--sl-color-gray-5, #cbd5e1)" />
    <text x="170" y="119" text-anchor="middle" fill="currentColor" font-size="18" font-weight="650">User</text>
    <rect x="80" y="190" width="180" height="70" rx="10" fill="var(--sl-color-bg, #ffffff)" stroke="var(--sl-color-gray-5, #cbd5e1)" />
    <text x="170" y="233" text-anchor="middle" fill="currentColor" font-size="18" font-weight="650">Maker</text>
    <rect x="80" y="322" width="180" height="70" rx="10" fill="var(--sl-color-bg, #ffffff)" stroke="var(--sl-color-gray-5, #cbd5e1)" />
    <text x="170" y="351" text-anchor="middle" fill="currentColor" font-size="17" font-weight="650">Other</text>
    <text x="170" y="374" text-anchor="middle" fill="currentColor" font-size="17" font-weight="650">Component</text>
    <rect x="360" y="122" width="260" height="220" rx="14" fill="var(--sl-color-bg, #ffffff)" stroke="var(--sl-color-accent, #2563eb)" stroke-width="2" />
    <text x="490" y="156" text-anchor="middle" fill="currentColor" font-size="20" font-weight="700">Component</text>
    <rect x="392" y="184" width="88" height="54" rx="8" fill="var(--sl-color-bg-nav, #f8fafc)" stroke="var(--sl-color-accent, #2563eb)" />
    <text x="436" y="218" text-anchor="middle" fill="currentColor" font-size="17" font-weight="650">intent</text>
    <rect x="500" y="184" width="88" height="54" rx="8" fill="var(--sl-color-bg-nav, #f8fafc)" stroke="var(--sl-color-accent, #2563eb)" />
    <text x="544" y="218" text-anchor="middle" fill="currentColor" font-size="17" font-weight="650">state</text>
    <rect x="392" y="266" width="88" height="42" rx="8" fill="var(--sl-color-bg-nav, #f8fafc)" stroke="var(--sl-color-gray-5, #cbd5e1)" />
    <text x="436" y="293" text-anchor="middle" fill="currentColor" font-size="14" font-weight="600">lifecycle</text>
    <rect x="500" y="266" width="88" height="42" rx="8" fill="var(--sl-color-bg-nav, #f8fafc)" stroke="var(--sl-color-gray-5, #cbd5e1)" />
    <text x="544" y="293" text-anchor="middle" fill="currentColor" font-size="14" font-weight="600">meta</text>
    <rect x="720" y="190" width="170" height="80" rx="10" fill="var(--sl-color-bg, #ffffff)" stroke="var(--sl-color-gray-5, #cbd5e1)" />
    <text x="805" y="223" text-anchor="middle" fill="currentColor" font-size="17" font-weight="650">host</text>
    <text x="805" y="247" text-anchor="middle" fill="currentColor" font-size="17" font-weight="650">rendering</text>
    <path d="M260 111C308 111 313 177 360 194" fill="none" stroke="var(--sl-color-accent, #2563eb)" stroke-width="2" marker-end="url(#flow-arrow-accent)" />
    <rect x="292" y="104" width="66" height="28" rx="14" fill="var(--sl-color-bg, #ffffff)" stroke="var(--sl-color-gray-5, #cbd5e1)" />
    <text x="325" y="123" text-anchor="middle" fill="currentColor" font-size="14" font-weight="650">event</text>
    <path d="M260 225L360 225" fill="none" stroke="var(--sl-color-accent, #2563eb)" stroke-width="2" marker-end="url(#flow-arrow-accent)" />
    <rect x="293" y="207" width="64" height="28" rx="14" fill="var(--sl-color-bg, #ffffff)" stroke="var(--sl-color-gray-5, #cbd5e1)" />
    <text x="325" y="226" text-anchor="middle" fill="currentColor" font-size="14" font-weight="650">props</text>
    <path d="M360 257L260 257" fill="none" stroke="var(--sl-color-gray-4, #94a3b8)" stroke-width="2" stroke-dasharray="7 6" marker-end="url(#flow-arrow-muted)" />
    <rect x="292" y="263" width="72" height="28" rx="14" fill="var(--sl-color-bg, #ffffff)" stroke="var(--sl-color-gray-5, #cbd5e1)" />
    <text x="328" y="282" text-anchor="middle" fill="currentColor" font-size="14" font-weight="650">expose</text>
    <path d="M260 357C308 357 314 313 360 303" fill="none" stroke="var(--sl-color-gray-4, #94a3b8)" stroke-width="2" stroke-dasharray="7 6" marker-start="url(#flow-arrow-muted)" marker-end="url(#flow-arrow-muted)" />
    <rect x="292" y="332" width="78" height="28" rx="14" fill="var(--sl-color-bg, #ffffff)" stroke="var(--sl-color-gray-5, #cbd5e1)" />
    <text x="331" y="351" text-anchor="middle" fill="currentColor" font-size="14" font-weight="650">context</text>
    <path d="M620 230L720 230" fill="none" stroke="var(--sl-color-accent, #2563eb)" stroke-width="2" marker-end="url(#flow-arrow-accent)" />
    <rect x="638" y="205" width="94" height="28" rx="14" fill="var(--sl-color-bg, #ffffff)" stroke="var(--sl-color-gray-5, #cbd5e1)" />
    <text x="685" y="224" text-anchor="middle" fill="currentColor" font-size="14" font-weight="650">feedback</text>
    <path d="M805 190C805 84 404 64 260 100" fill="none" stroke="var(--sl-color-accent, #2563eb)" stroke-width="2" marker-end="url(#flow-arrow-accent)" />
  </svg>
  <figcaption style="margin-top: 0.75rem; color: var(--sl-color-text-secondary, #64748b); font-size: 0.95rem;">Figure: The Information Flow Model. <code>props</code> and <code>event</code> enter Component from Maker and User. Inside Component, <code>intent</code> and <code>state</code> organize behavior, while <code>lifecycle</code> and <code>meta</code> remain internal dimensions. <code>feedback</code> reaches User through host rendering. <code>context</code> connects Other Component, and <code>expose</code> points back to Maker.</figcaption>
</figure>

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
