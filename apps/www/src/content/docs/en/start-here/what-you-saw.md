---
title: 'Meet Proto UI'
description: 'What Proto UI aims to preserve, what you can try today, and where to begin reading.'
---

Proto UI is an open-source project exploring how to preserve component interaction knowledge as definitions that can be reused, executed, and tested across technologies. It aims to keep some already-solved interaction problems solved as frameworks and platforms change.

Consider a familiar component: a Switch. Whether implemented in React or Vue, it needs to express its on/off state, respond to input, handle being disabled, and communicate changes to users and the application. The code differs, but these responsibilities keep appearing.

Proto UI calls an executable description of these responsibilities a **Prototype**. An **Adapter** connects it to a particular technology environment, or **Host**, to produce a component an application can use. A Prototype captures the current understanding of an interaction and can be revised through use and verification.

## Start with something you can try

In the [homepage demo](/en/#home-demo-previewer), select Switch, then switch between React, Vue, or Web Components. Observe:

- how state and visible feedback change when you operate the switch;
- how focus and activation behave when using the keyboard;
- how the same responsibilities are realized after changing the Adapter.

The demo runs the same set of Prototypes through the selected Adapter. Switching destroys the previous example and mounts new instances, so earlier interaction state may not persist.

This demonstrates a reuse path among current Web technologies. It lets you inspect particular behaviors; other components, operating conditions, and non-Web platforms need their own implementations and verification. [Chapter 6 of the whitepaper](/en/whitepaper/6-consistency-boundary/) explains how to compare consistency in more depth.

## How can you use it today?

As an application developer, you can start with the official prototype libraries, use the CLI to add component entry points for your framework, and try them in an existing application. You do not need to author a Prototype or finish the whitepaper first.

As a component-library or design-system maintainer, you can evaluate which interaction definitions are worth maintaining together and which differences still belong to an Adapter or application. Current official Adapters and verification evidence are concentrated in the Web family; broader deployment to mobile, desktop, and other environments still needs exploration.

## Follow your question

| What do you want to know? | Continue here |
| --- | --- |
| Is this worth my or my team's time? | [Why Proto UI](/en/start-here/why-proto-ui/) |
| How does one definition become a usable component? | [How It Works](/en/start-here/how-it-works/) |
| I want to try a component in an existing project | [Quick Start](/en/start-here/quick-start/) |
| Which components can I inspect today? | [UI Libraries](/en/ui-libraries/) |
| What are the premises, reasoning, and limits? | [Whitepaper: Preface](/en/whitepaper/0-preface/) |

Reading this chapter in order takes you from the project's purpose to a first integration. The whitepaper develops the reasoning behind it. You can also go directly to the page closest to your current question.
