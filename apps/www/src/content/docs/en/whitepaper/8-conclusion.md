---
title: 'Conclusion: Preserving Interaction Knowledge for the Past and Future'
description: 'Returning to the long-term vision of shared infrastructure: preserving, testing, and evolving interaction knowledge across technology lifecycles.'
---

> Even if Proto UI itself never becomes mainstream, what might this work leave behind?

## What We Preserve Is Not One Implementation

In the preface, we asked a somewhat exaggerated but genuinely recurring question: how many times must we reinvent the Button?

What needs to be preserved is clearly not the code of one particular Button. Frameworks change, platforms are replaced, and today's best practices may become tomorrow's historical burden. If all we do is keep one old implementation running forever, we will probably preserve old technology rather than the interaction knowledge accumulated within it.

Proto UI wants to preserve something else: why a component remains that component; which relations it forms with User, Maker, and Other Component; how it preserves state, forms structure, and unfolds over time; and where it allows a concrete Host to make different choices.

We express this understanding in a Prototype, making it a runnable current approximation. We then translate it into concrete technologies, compare whether the resulting artifacts preserve the required semantics, and let failures from practice revise the approximation in return.

A Prototype is therefore not a time capsule for sealing away an answer. It is closer to interaction knowledge that can continue to be questioned. When a new UI technology appears in the future, we may no longer be able to reuse today's DOM, widgets, or event systems, but we can still ask what the same Switch should preserve as state, which operations it should accept, which Feedback it should provide, and which responsibilities it should carry toward the outside world.

The new technology may carry those responsibilities successfully, or it may show that some definitions depended too heavily on present-day experience. Both outcomes are valuable. The first gives existing knowledge a new implementation. The second helps us see which parts should never have been treated as common across technologies.

## A Path, Not the End of History

Proto UI does not assume that technological history will inevitably lead to Prototype, or that Proto UI alone can complete this work.

Some of our categories may be inaccurate. Some Components may be much harder to transport than we expect. A future model may solve the same problem more simply and explain it more powerfully through an entirely different engineering form. Proto UI may be only one incomplete attempt, and not necessarily the one that is ultimately adopted most widely.

But that does not make the problem itself less valuable.

As long as people keep rebuilding similar interactions in different technologies, and as long as important accessibility experience, state models, and patterns of component cooperation must be rewritten whenever the technology stack changes, the question of how to preserve this knowledge remains worth pursuing in practice. A bounded attempt can support some ideas and disprove others. Another prototype theory, another open-source project, or even a technology unrelated to Proto UI may take this path further.

What matters is not who monopolizes the answer, but whether the question eventually receives a better one.

## Returning Effort to Interaction Itself

If these interaction models can be maintained over time, they may become part of humanity's shared infrastructure.

Here, “infrastructure” does not mean that every platform uses the same code, or that differences among Hosts disappear. New devices will still need new input adaptation, new rendering technologies will still need new translation work, and different interaction media will raise problems that earlier systems never encountered.

What we hope to change is the starting point of the work.

When a new technology or interaction form appears, people should not have to begin from an empty page and rediscover a component's most basic state, relations, and responsibilities. They can begin from preserved models, decide which semantics still hold, which need translation, and which should be redesigned for the new medium. New discoveries can also return to this shared knowledge, giving both older technologies still in use and newer technologies an opportunity to benefit.

More effort can then go toward improving interaction itself: studying how a new input method should provide Feedback, refining its accessibility requirements for people with different disabilities, reconsidering whether a platform convention truly serves the User, or discovering participants and relations that earlier models overlooked. Technical implementation remains important, but it no longer has to carry the entire responsibility of preserving interaction knowledge by itself.

Proto UI hopes to offer this infrastructure a form that is executable, translatable, and open to revision. How far it can go can only be answered by future implementation and use.

If new technologies can one day begin not by reinventing the Button, but by continuing to improve how people and software relate, then this exploration will have been worthwhile—whether or not the name that completes it is Proto UI.
