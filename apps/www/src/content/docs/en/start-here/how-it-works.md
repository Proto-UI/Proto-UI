---
title: 'How It Works'
desp: 'Understand the minimal working model of Proto UI through Prototype + Adapter'
description: 'Understand the minimal working model of Proto UI through Prototype + Adapter'
---

## What does this article answer?

On the previous page, you already saw this:

> The same component behaves consistently across different hosts.

This page answers:

- How is that possible at the most basic level?
- What do Prototype and Adapter each do?
- Why is this the starting point for understanding Proto UI?

## Start with a model simple enough

You can begin with a one-sentence understanding of Proto UI:

> **Prototype + Adapter = a component implementation in a specific host**

This is not the full theory, but it is already enough to explain the demo you just saw.

## Go back to the phenomenon you just saw

In the homepage demo, what you saw was:

- switching between different hosts such as React, Vue, and Web Components
- while the component behavior stayed consistent

From this model, what happened in essence is:

- the Prototype did not change
- the Adapter changed

Which means:

> **The same interaction definition is being reinterpreted in different hosts.**

## What does the Prototype do?

The Prototype is responsible for describing:

> **How this component should interact.**

It focuses on:

- how state changes
- how user input is handled
- how the component provides feedback

Not on:

- how to write it in React
- how to write it in Vue
- how to manipulate the DOM

You can think of it this way:

> The Prototype describes the host-independent part of a component's interaction on its own.

## What does the Adapter do?

The Adapter answers a different question:

> **How should those interactions be implemented in this host?**

It decides:

- how to map them onto host capabilities
- how the component API should be organized
- which capabilities can be carried over directly and which need adaptation

So:

- the Prototype defines what should happen
- the Adapter decides how to do it here

## Put them together

You can understand it with a very simple flow:

1. Choose a Prototype, the interaction definition
2. Choose an Adapter, the target host
3. Combine them
4. Get the component implementation in that host

That is also why:

> The same Prototype can be reused across multiple hosts.

## The direct result of this model

Under this layering:

- interaction definitions can exist independently of concrete implementations
- the same Prototype can be interpreted by multiple hosts
- Prototypes and Adapters can evolve separately

## What it does not mean

This model also has clear boundaries:

- it does not mean all hosts are naturally fully equivalent
- it does not mean components can migrate at zero cost
- it does not mean having a Prototype automatically gives you a high-quality implementation

What Proto UI does is closer to:

> **Separating what can be reused from what must be adapted.**

Not eliminating differences themselves.

If you want to go deeper into questions such as:

- why components should be abstracted this way
- where the boundary of that abstraction lies
- how consistency is actually constrained

those will be discussed in the Whitepaper.

## Next

If you want to decide whether it is worth introducing:

- Go to [Why Proto UI](/en/start-here/why-proto-ui/)

If you already want to start using it:

- Go to [Quick Start](/en/start-here/quick-start/)

If you want to keep understanding the principles behind the design:

- Go to [Whitepaper](/en/whitepaper/0-preface/)
