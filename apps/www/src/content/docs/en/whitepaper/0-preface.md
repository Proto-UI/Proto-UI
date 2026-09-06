---
title: 'Preface: How Many More Times Must We Reinvent the Button?'
description: 'Starting from the repeated rebuilding of the same components, we ask whether interaction knowledge can outlive a particular technology and remain reusable, testable, and maintainable.'
---

It is no exaggeration to say that foundational UI component work is full of repetition.

- Many teams with specific UI design requirements build their own component libraries. In the process, they repeatedly reimplement the basic behavior of components such as Button, Switch, and Select.
- As an organization grows, or as a product needs to run in different environments, it is also common for one product to use several technology stacks while requiring them to remain coordinated.

This work is about far more than rewriting the same colors and border radii a few times.

---

Button is the most familiar shorthand for this repetition. To see more clearly what keeps recurring, consider a Switch with persistent state.

Whether it is ultimately implemented as a React component, a Vue component, a Web Component, a mobile widget, or a control in a desktop UI toolkit, it usually has to address a similar set of concerns:

- represent and maintain whether its current state is on or off
- respond to activation through a click, touch, or keyboard input
- communicate its current state to the User
- handle focus and disabled state
- expose a role and state that assistive technology can recognize
- notify the application that uses it about a state change or a request to change

Once these interaction requirements are implemented in a concrete technology, however, the code can look very different. The structure, state model, event system, and rendering approach of one technology may bear little resemblance to those of another.

What is interesting is that, despite these radically different implementations, the same interaction requirements keep returning to our task lists.

---

Within a sufficiently mature single-technology ecosystem, existing component libraries—especially headless component libraries—can often reduce this repetition. Radix UI, for example, centralizes a great deal of interaction logic and accessibility handling within the React ecosystem. It demonstrates at least one thing: within a single ecosystem, there is value in extracting some interaction knowledge from individual products and maintaining it collectively.

But this does not prove that the same knowledge can move directly across technologies. This kind of reuse usually has a clear ecosystem boundary. Once several technology choices need to remain coordinated, suitable foundations become much harder to find. We may then run into problems such as these:

- We want accessibility support like Radix UI provides, but the project cannot necessarily use React.
- We want to carry forward the visual language of shadcn/ui, but the current stack lacks a sufficiently mature community implementation, so we have to rebuild the corresponding presentation and interaction.
- The company already maintains a React component library, but new business requirements now demand Vue, Web Components, mobile, or desktop versions as well.

These frustrations do not all describe exactly the same problem. Visual style must be projected again through a concrete rendering system, while interaction and accessibility responsibilities must be connected again to the Host's input, focus, and event mechanisms. Both create repeated work, but what can be preserved across technologies—and under what conditions it can remain consistent—is not the same for each.

This is not a failure of existing component libraries. They were built to solve problems within their respective ecosystems. The difficulty is that when interaction knowledge can only be used through one particular implementation, it does not naturally benefit other technologies. When a team later changes frameworks or platforms, the old code may still exist, but the conditions needed to maintain, run, and migrate it may have disappeared. Many previously solved problems must then be solved again.

Maintaining an agreed visual presentation, interaction detail, and level of accessibility across multiple implementations therefore tends to require sustained and expensive specialist effort. This kind of consistency has never been cheap.

But must all of this work really begin again with every technological transition?

---

The recurrence of these responsibilities does not by itself prove that they can form a shared abstraction across technologies. Differences between platforms may simply move complexity that was once scattered across implementations into a new intermediate layer. Adding an abstraction layer does not automatically produce consistency or reliable accessibility support either.

So what we propose is not an established conclusion, but a narrower hypothesis that still needs to be tested:

Are there stable parts of human interaction that do not have to be rewritten together with the implementation technology? Can we find them, describe them clearly, and then place them in different technologies to test whether they still hold?

If this hypothesis holds, some interaction knowledge may become a shared asset that can accumulate over time, rather than remaining captive to one framework, platform, or technology lifecycle. If it fails for certain components, media, or platforms, those failures will also help us discover where the boundary actually lies.

This is the possibility Proto UI sets out to explore. The chapters that follow examine how such interaction knowledge can be identified, expressed, translated, and tested.

Before discussing how to preserve it, however, we need to answer a more fundamental question: if the code, nodes, controls, and even the entire rendering tree are not the stable object, what exactly do we recognize when we point to different implementations and say, “these are the same kind of component”?
