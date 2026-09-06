---
title: 'Chapter 1: Components Before Code'
description: 'When the class, function, DOM, widget, or rendering tree changes, what still lets us say that two implementations are the same kind of component?'
---

## What Are Developers “Reproducing” and “Implementing”?

Let us begin with an ordinary situation in software development.

Suppose we have a mobile app built with Flutter and a WebView. The WebView hosts a fast-changing part of the product, but its foundational components—buttons, switches, dialogs, and so on—should remain highly consistent with the Flutter portion.

The React and Flutter implementations will, of course, be very different. Their syntax, layout systems, units, and event models do not work in quite the same way. Yet if you ask a product manager or designer whether both implementations came from the same component design, they will usually say yes—as long as each reproduces that design closely enough. If the answer is no, the developers responsible will probably have more work to do.

This is an interesting detail: when developers implement a component, they are usually reproducing something. That something may come from a design, a prototype, a requirements document, or an understanding of the component that the team has already formed.

In other words, before choosing React, Flutter, or another concrete technology, we usually already hold certain expectations about the component. We may not know every detail at the outset, and implementation often reveals omissions in the design, but that does not change the observation that these expectations do not belong entirely to any one technology.

This hypothetical situation is also one form of the repeated work described in the preface. We often need to implement similar components again in different technologies and decide where those implementations should remain consistent. Switch is still a simple example. With a dialog, differences in visual presentation, common operations, focus management, and assistive-technology behavior can become difficult to reconcile between Flutter and the Web. Resolving those differences is not easy for teams that genuinely need a consistent product experience across technologies.

For now, this chapter will not decide exactly how precise “consistency” must be. In this hypothetical situation, we only need to notice that different implementations are compared against a set of expectations, and that those expectations are not identical to any one body of code.

## What Is a Component, Exactly?

This is a difficult question.

- Is it a class, function, widget, or file? We can certainly say so, although it is more precise to call those implementation forms of a component.
- Is it a collection of capabilities with visual constraints? This may come close to an answer. It begins from behavior and observable phenomena without requiring a metaphysical essence.
- Is it an intention, a symbol, or a specification? Possibly, although descriptions like these do not necessarily turn directly into implementations. ARIA-related specifications and authoring guidance, for example, can explain the roles, states, and behavior needed by assistive technology, but they do not automatically generate a conforming component for us.

Proto UI's working hypothesis is that we can begin by treating a component as a relatively stable interactive subject.

Calling it an interactive subject means that a component does not exist in isolation. It can be perceived or operated by a person, accept configuration from a software Maker, report changes to an application, and exchange information with other components. We can recognize it across technologies because these relationships and responsibilities retain a discernible continuity—not because it is always implemented by the same class, node, or rendering tree.

This does not rule out “inducing” a component from its capabilities and presentation. On the contrary, visual feedback, interaction behavior, role semantics, configuration, and outward results are all important evidence for understanding a component. In one distinction that Proto UI still needs to test in practice, for example, Switch is a persistent on/off value control; Toggle is a button-like control with a persistent active state; and Checkbox is a checked input control whose primary input value is checked and which may also express a mixed or indeterminate display state.

The main difficulty is completeness. Before implementation, it is hard to know whether a list of capabilities has omitted anything. When a new platform, interaction medium, or accessibility need appears, a responsibility that was never recorded may suddenly become important. A structured model can help us find omissions, relationships, and differences in Host adaptation, but it does not automatically answer questions about the direction and timing of information transfer, Host capability boundaries, or translation loss. It still has to be tested through concrete implementations.

Proto UI therefore does not replace practical induction with a top-down philosophy. It works back and forth between the two: first use a model to organize what we are looking for, then test that model against real components and implementations in different technologies, and continue revising it when we discover mistakes.

When later chapters occasionally speak of a component's “essence,” they mean a current approximation that can be tested across technologies and revised through practice—not a final answer that has already been proved and will never change.

## But How Do We Describe It?

Return to Switch. We know that it expresses an on/off state, can be clicked or operated from a keyboard, communicates its current state to the User, and usually needs to expose a recognizable role to assistive technology. Going further, we can list the configuration it accepts, how it reports changes to the application, and what feedback it provides under different conditions.

There is nothing wrong with listing these items one by one. If the list were truly complete, it could describe Switch. The problem is that it is difficult to tell when the list is complete, and omissions and inconsistencies are hard to see in a flat inventory.

Proto UI chooses to begin with the relationships between a component and the world around it: who is transmitting information to whom? In which direction does the information travel? What responsibility and meaning does that information carry? Instead of classifying things by API name first, Proto UI derives an organizing principle from participant identity, direction of transmission, and semantic responsibility. It calls the resulting relationship an information channel.

Information channels form the skeleton that organizes the relationships between an interactive subject and external participants, but they do not explain every aspect of a component. We will need other concepts to explain how state is preserved, how semantics unfold over time, and how the internal parts of a complex component are organized and cooperate.

Before turning to those questions, however, we first need to examine whom a component relates to and how information travels through those relationships. That is the subject of the next chapter.
