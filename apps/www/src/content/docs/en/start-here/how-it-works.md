---
title: 'How It Works'
description: 'Use Prototype and Adapter to understand how one component definition runs in different frameworks.'
---

How can the same component work in React, Vue, and Web Components? Start with a simple combination:

> **Prototype + Adapter = a component you can use in a particular framework**

## Prototype: define how the component behaves

A Prototype describes how a component should work.

For a Switch, that includes:

- how clicking changes its on/off state;
- how it handles user input when disabled;
- what it displays when on or off;
- how it notifies the application when state changes.

These behaviors can live in one Prototype, so you do not need to write them separately in React and Vue.

## Adapter: run it in a particular framework

An Adapter connects a Prototype to your framework, handling details such as event binding and rendering updates.

For example, the same Switch Prototype can be used with:

- a React Adapter to produce a React component;
- a Vue Adapter to produce a Vue component;
- a Web Component Adapter to produce a custom element.

In Proto UI documentation, the technology environment where the component runs is also called a **Host**.

## Back to the homepage demo

When you switch frameworks in the [homepage demo](/en/#home-demo-previewer), the Prototype stays the same. What changes is the Adapter running it.

That is the basic way one interaction definition can be reused across frameworks. Which components you can use depends on the selected Adapter's support.

## What do you need to do?

Usually, you just:

1. Choose a component from a prototype library.
2. Use the CLI to add its entry point for your framework.
3. Import it into your application, pass props, and listen for events.

If an existing prototype library meets your needs, you do not need to learn Prototype authoring or build an Adapter first.

Continue to [Quick Start](/en/start-here/quick-start/) to add your first component to an existing project.

For more on this division of work and how to assess consistency across frameworks, read [Chapter 5: The Translation Layer](/en/whitepaper/5-translation-layer/) and [Chapter 6: The Boundaries of Consistency](/en/whitepaper/6-consistency-boundary/) in the whitepaper.
