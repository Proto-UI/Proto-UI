---
title: 'Chapter 2: Starting from Interaction Relations'
description: 'Starting from User, Maker, Other Component, and the direction of a relationship, this chapter explains how participant identity and semantic responsibility together derive an information channel.'
---

> Without starting from the API list of a particular framework, how can we systematically describe a component's relationships with the outside world?

## How Do We Describe a Component That Has Not Been Implemented?

The previous chapter provisionally treated a component as a relatively stable interactive subject. We observed that although a component cannot actually run without an implementation, we can usually describe some of its expected interactions before deciding whether to implement it in React, Flutter, or another technology.

If this idea holds, we naturally want a way to record those expectations as clearly as possible.

The problem can be divided into two parts:

- What language should we use to record them? Logic needs a language as its medium.
- How should we organize what we record? How do we sort out logic that precedes implementation?

The first question will eventually need an answer. But we have not yet formally introduced the concept of a Prototype, and there is no need to decide at the outset what a component definition must look like. We will set that question aside for now and provide a more complete descriptive example at the end of Chapter 4.

This chapter addresses the second question first: if we do not classify a component according to React props, a Flutter widget, or another framework-specific model, how else can we describe it?

Proto UI chooses to begin with interaction relations.

## With Whom Does a Component Interact?

When we treat a Component as an interactive subject, its properties and behavior no longer appear from nowhere. Some are meant to be perceived by the person using it; some accept configuration from its caller; some report results to an application; and some support cooperation with other components.

The key question is therefore: with whom does a Component form relationships?

Proto UI currently begins by distinguishing three kinds of participants:

- **User**: the party that actually perceives or operates the component—the user of the UI.
- **Maker**: the party that consumes, composes, or configures a component. A Maker may be a developer, designer, product manager, higher-level system, or AI Agent. In the context of producing software, we also use **App Maker** for the party that uses components to build an application.
- **Other Component**: another component that exchanges information with the current Component so that they can complete an interaction together.

These terms describe roles within an interaction, not job titles or fixed identities. The same person may configure a component as a Maker and later use it as a User. An AI Agent may produce a UI in one setting and use a UI in another. What matters is how that participant relates to the Component at that moment.

## Deriving Information Channels from Relations

Listing participants is not enough.

Between User and Component, for example, information travels in at least two directions: the User can operate the Component, while the Component can communicate state and results back to the User. The same is true between App Maker and Component: the App Maker can configure the Component, and the Component can report changes or capabilities to the App Maker.

Without direction, the first two relations collapse into the vague statement that “the User interacts with the Component,” while the latter two become “the App Maker and Component exchange information.” Neither description tells us who sends information, who receives it, or what the exchange is for.

Proto UI therefore identifies a relation through three aspects:

1. who exchanges information with whom;
2. the direction in which the information travels;
3. the semantic responsibility carried by the exchange.

Proto UI calls a relation identified in this way an `information channel`.

An information channel is not a literal data pipe, nor does it refer specifically to an event bus, data flow, or one kind of API. It is a way of organizing a component's interaction relations. Whether a capability appears in a concrete framework as a parameter, callback, object method, style, or something else, we first ask which participants it connects, in which direction the information moves, and what responsibility it fulfills.

In Proto UI's current working model, which still needs to be tested in practice, this approach derives five core portable information channels:

| Information channel | Direction | Primary responsibility |
| --- | --- | --- |
| `Event` | User → Component | Carry operations, input, and interaction intent initiated by the User |
| `Feedback` | Component → User | Let the User perceive the component's presence, state, changes, and results |
| `Props` | App Maker → Component | Configure the component |
| `Expose` | Component → App Maker | Provide values, state, methods, change signals, and other outward capabilities |
| `Context` | Component ↔ Component | Let components exchange information for cooperation |

Event and Feedback both connect User and Component, but their direction and responsibility make them distinct channels. The same distinction separates Props from Expose.

The bidirectional arrow for Context does not mean that Context has “no direction.” It means that components are explicitly allowed to exchange information in both directions. In any concrete collaboration, we still need to say which Component provides what and which Component receives it.

A new API requirement does not automatically become a new information channel. If it still lets an App Maker configure a Component, Props can absorb it. If it still lets a User perceive a Component, it remains Feedback. A new channel must correspond to a stable and important participant identity or relational direction that existing channels cannot absorb, and it must carry an independently recognizable semantic responsibility.

<details>
<summary><strong>Extension: Where Do Host and Component Author Fit?</strong></summary>

A Component also relates to its **Host/environment**. A Host may be a framework, platform, device, or the environment that ultimately runs the component. A component may receive layout, input, or platform capabilities from its Host, and it may send requests and results back to the Host.

These relations are real, and Proto UI's translation layer depends on Host Capability. But they are usually tightly coupled to a particular Host and are difficult to treat directly as shared semantics across Hosts. Exchanges between Host and Component therefore remain outside the core portable channels by default. What is excluded is their identity as a “core portable channel,” not the use or support of Host capabilities in Proto UI.

The **Component Author**, the party who directly writes a component definition, is also a real role. But that role primarily relates to the Prototype definition, authoring API, annotations, and toolchain. A running Component does not gain another information channel to its author merely because the author reads its code. This chapter therefore does not list Component Author as an interaction participant of the runtime Component.

</details>

## Placing Switch in the Relation Map

Return now to Switch. We can place it in the categories above with a small piece of relational pseudocode:

```text
# This is not Proto UI syntax. It is only a sketch of the relations.

App Maker   --Props { checked, disabled }--> Switch
User        --Event { activate }-----------> Switch
Switch      --Feedback { on / off }--------> User
Switch      --Expose { checkedChange }-----> App Maker
Switch Root --Context { checked, disabled }-> Switch Thumb
```

Each line declares a relation; their order does not imply that they must execute from top to bottom.

The first four lines say, respectively, that the App Maker configures Switch, the User attempts to operate Switch, Switch presents its current state to the User, and Switch reports a change to the App Maker. The final line describes cooperation between Switch Root and Switch Thumb. Thumb reads `checked` and `disabled` from another Component outside itself—Root—and derives its display state from them. This is Context, not configuration that the App Maker should have to supply manually.

The sketch also shows why the shape of a Host API is not the same thing as a channel. In a framework such as React, configuration values and callback entry points that receive change notifications may both appear in an object called props. But configuration has the semantics App Maker → Component, while a change notification received through a callback has the semantics Component → App Maker. They therefore belong to different channels.

Switch usually preserves state during an interaction as well. But State is not itself an information channel: preserving a value does not introduce a new participant that sends information to the Component or receives information from it. State affects how these relations operate, but it has its own semantic responsibility rather than being an information channel. Chapter 4 examines this and other concepts that are necessary even though they are not channels.

## This Is Only a Skeleton

Information channels give us a skeleton for organizing a component's external relations, but they neither need to nor can explain everything about it. Chapter 4 focuses on “semantics beyond channels.”

The five channels in the current working model are not a predetermined permanent limit. If practice reveals an important relation that cannot be explained through the existing participants, directions, and responsibilities, the model can still be revised.

We now have a method for organizing interaction relations. But it does not directly tell us how to divide one Component from another. Where does each begin, and where does it end?

Switch Root and Switch Thumb, for example, can cooperate through `Context` and appear to be two interactive subjects. A layer used only for layout, background painting, or decoration may not need to become an independent Component at all. If a visual tree contains many nodes, how do we decide whether it contains one component, two components, or more?

That is the question of the next chapter—and one that information channels are particularly good at answering.
