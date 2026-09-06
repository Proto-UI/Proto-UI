---
title: 'Chapter 3: Component Boundaries'
description: 'Using independent participant relations and the feedback-only exception to determine the boundaries of a Component and its Prototype.'
---

> In a visual tree containing Root, Thumb, Caret, Arrow, Content, Trigger, and ordinary containers, which structures are independent components and which merely belong to another component?

## How Should Components Be Divided?

Ask when a component should be split, and many answers are possible: by amount of code, complexity of logic, atomicity of capability, or simply team convention. Component decomposition has always admitted more than one reasonable opinion.

We can also look for clues in successful headless component libraries. They often divide Switch into Root and Thumb, and Dialog into parts such as Trigger, Content, and Close. These designs have seen substantial use and are genuinely useful when customizing components.

But a popular library's part inventory can only show that a decomposition is valuable in practice; it cannot become a universal rule by itself. Different libraries may expose different parts, and a structure does not automatically become an independent component merely because one library calls it Root, Portal, or Arrow.

Proto UI asks a further question: why are these structures worth separating? If we can find a more stable test, we can apply it to more components without guessing again from the API of each framework or component library.

The information channels introduced in the previous chapter give us a starting point.

## Using Information Channels to Find Component Boundaries

For a substructure that might become a component, we do not begin with its line count or the area it occupies in the visual tree. We ask whether it establishes relations with the outside world under its own identity.

In the current working model, which still needs to be tested in practice, the result can first be summarized in three cases:

| Information channels enabled by the substructure | Current judgment |
| --- | --- |
| Any independent `Event`, `Props`, `Expose`, or `Context` relation | It must be an independent Component |
| `Feedback` only | It may belong to its parent Component or be split out |
| No portable information channel | It should not be treated as an independent Component |

To avoid making you return to the previous chapter for every definition, we can expand the questions that apply when a channel exists:

- Is this structure an independent semantic target of a User operation through `Event`? If so, it already owns an Event relation.
- Can a Maker configure it as an independent object? If so, it already owns its own `Props`.
- Does it expose its own signals, state, constants, or methods to a Maker? If so, it already owns its own `Expose`.
- Does it exchange information with other Components—for example, by providing or subscribing to `Context`? If so, it already participates in an independent Context relation.
- In particular, does it have an effect of its own that is presented to the User? If so, it owns Feedback. But if Feedback is its only relation, it does not necessarily need to be an independent component.

If any of the four relations other than Feedback exists independently, the substructure is no longer just an implementation layer inside its parent. A User, Maker, or Other Component can now interact with it as an object in its own right, and it begins to have its own boundary of responsibility.

The word “independently” matters here.

Suppose a parent component accepts a `color` parameter and paints one of its internal nodes in that color. The node does not thereby acquire its own Props. The Maker is still configuring the parent Component; the internal node is only part of how the parent produces Feedback.

The relation with the Maker becomes independent only when the Maker can configure, replace, or observe the substructure itself as an object.

If none of these conditions applies, the substructure should not be split into an independent Component. A User cannot perceive or affect it, a Maker cannot configure or observe it, and it does not cooperate with another Component. In other words, it forms no portable relation with any interaction participant.

It may still be an indispensable container or helper node in a concrete implementation. But “the implementation needs it” is not the same as “it is a component.”

## Why May a Feedback-Only Structure Be Split or Kept Attached?

`Feedback` is one of the information channels in the current working model. If formal uniformity were our only goal, every substructure that creates an independently perceptible visual, auditory, or other effect would need to become an independent Component.

If we actually followed that rule, components would quickly fragment:

- This substructure enables flex layout—split it out!
- This substructure sets a background color—split it out!
- This substructure sets a font size—split it out!

At that rate, even a Switch might become many parts that each own a small piece of layout or styling. The result would be formally finer-grained but harder for a human author to read and maintain.

Proto UI therefore makes an explicit engineering compromise for feedback-only structures: if a substructure only helps its parent Component present information to the User, it may remain attached to that parent and does not have to be split out.

The exception has an equally explicit boundary. An attached structure may produce `Feedback`, but it may not quietly acquire its own `Event`, `Props`, `Expose`, or `Context`. As soon as any of those independent relations appears, the structure no longer satisfies the feedback-only condition and should be separated from its parent Component.

## Applying the Rules

### Switch

Switch can usually be divided into Root and Thumb.

Root is the semantic owner and value owner of the entire Switch. It accepts configuration from the Maker, defines the area the User can operate, holds the on/off value, exposes necessary state and change signals, and provides `Context` to other parts in the same Switch domain.

Thumb is a visual indicator. It does not own the Switch value, is not responsible for activation, and should not become another independently focusable switch control. In the current Switch design, however, Thumb subscribes to the `Context` provided by Root, obtains information such as `checked` and `disabled`, and presents its state accordingly.

```text
User        --Event-----------------------> Switch Root
App Maker   --Props-----------------------> Switch Root
Switch Root --Expose----------------------> App Maker
Switch Root --Context { checked, disabled }--> Switch Thumb
Switch Root / Switch Thumb --Feedback-----> User
```

Although Feedback is Thumb's primary work, Thumb is not feedback-only. It has established a cooperative relation with another Component through Context, so it needs an independent component boundary.

Separating Thumb does not mean that a Switch contains two switches. Root remains the sole semantic owner and value owner. Thumb is only an indicator that depends on Root. Two Components can jointly form a complete Switch while carrying different responsibilities.

<details>
<summary><strong>Extension: Can Switch Have Only One Independent Component?</strong></summary>

Yes. In a deliberately minimal decomposition, Switch may have only Root as an independent Component. Thumb remains an internal feedback-only structure: it does not subscribe to `Context`, has no configuration or exposed capabilities of its own, and is moved directly by Root through internal layout—for example, by changing `padding` to push it from side to side.

This design does not violate the preceding rules. If there is no need to extend or independently customize Thumb, there is no reason to split it in anticipation of relations that do not yet exist.

Note, however, that a parent Component exposing a parameter that “changes the internal Thumb color” still does not necessarily give Thumb its own `Props`. Thumb truly crosses the boundary of an attached structure only when a Maker can configure, replace, or observe it as an independent object, or when Thumb itself participates in a relation such as Context.

This minimal design does create tension with extensibility. If many Thumb customization requirements later emerge, more and more parameters must be relayed from Root to the internal Thumb. At that point, we need to reconsider whether Thumb should be recognized as an independent part that a Maker can configure directly.

Proto UI's current Switch Thumb design takes the latter path: it subscribes to same-domain `Context` and has an explicit authoring entry, so it cannot serve as a feedback-only example.

</details>

### Select

Decomposing Select is more involved than decomposing Switch.

In the current exploration of Base Select, Root, Trigger, Value, Content, and Item are each recognized as a different Component. We do not need to enumerate every capability here; a few contrasts are enough to clarify the boundary test.

Trigger is the target through which the User opens Select. It responds to clicks and keyboard operations and receives information such as `open` and `disabled` from Root's `Context`. Because it has both Event and Context relations, it is plainly more than an ordinary internal node.

Value is often placed visually inside Trigger, but it also obtains the current selection from Select `Context`. In the current design, it additionally has its own `placeholder` configuration and outward display state. It may look like a piece of text, but it has already formed independent relations with a Maker and other Components.

Content and Item follow the same pattern. Content uses Root state to decide when the floating layer should appear, manages focus navigation, and submits a request to Root when Select needs to close. Item can be selected by the User and must return that selection intent to Root. These are not merely layout responsibilities; each part carries an independent interaction responsibility.

A common dropdown Caret inside Trigger is especially useful for comparison.

If Caret is a fixed graphic that cannot be independently customized and only tells the User “this can be expanded,” then Feedback is its only channel and it may remain attached to Trigger.

If a Maker can replace, configure, or observe Caret as an independent object—or if it must subscribe to Context to determine its own state—then it is no longer merely an attached graphic. It should be recognized as an independent Component similar to Select Arrow.

This Caret is only a design example used to explain the boundary. It does not add a formal part to the current Base Select. If a similar extension enters the design later, each relation must still be evaluated under the same rules; it cannot be copied merely because another component library exposes a part with the same name.

## From Component to Prototype

So far, we have been deciding when a visual structure begins to form relations with User, Maker, or Other Component under its own identity—in other words, when it becomes a Component.

Once an independent relation exists, Proto UI needs to record that interactive subject separately. Proto UI calls this record a `Prototype`.

A Prototype is Proto UI's current executable approximation of the identity of a portable Component. It records the interaction responsibilities and dependencies we want to preserve across implementations, but it is not a universal construction plan that automatically adapts itself to every technology. Concrete implementations still require the translation layer, Host Capability, and target environment to work together.

## Skeleton, Boundary, Then Internal Rules

One chapter remains in Part I, “Prototype.”

We have treated a component as an interactive subject, used information channels to describe its external relations, used those relations to draw Component boundaries, and called Proto UI's executable approximation of each subject a Prototype.

To bring a Prototype closer to execution, however, we still need semantics that are not themselves information channels but affect how those relations hold. These include:

- State, which preserves interaction state
- Lifecycle, which organizes temporal order
- Anatomy, which describes the roles and structural relations among parts in a composite Prototype family

The next chapter focuses on these semantics beyond channels that a nearly executable Prototype still needs to express.
