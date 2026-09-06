---
title: 'Chapter 6: The Boundaries of Consistency'
description: 'Why consistency is a conditional comparison between realization contexts, and how comparison strength should vary across contexts.'
---

> When two Host artifacts use different structures, event systems, and rendering methods, what lets us say that they still implement the same Component—and should they be consistent in behavior, structure, or pixels?

## Prototype Is the First Measure of Consistency

Recall the product scenario from Chapter 1: a mobile app uses both Flutter and a WebView. Its Switch is implemented separately in Flutter and React, but the product is expected to keep their behavior and presentation consistent.

If the requirement becomes “pixel-level consistency,” we usually need more preconditions. Both implementations must run on the same device under the same dimensions, units, fonts, and rendering conditions. Without these controls, a pixel difference may come from the Component, or merely from different screen parameters or font shaping.

Even when the visual results are very close, subtle perceptible differences may still appear during interaction. Hosts may synthesize clicks differently or use different thresholds for accidental touch input. For Scroll Area, scroll damping and physics may also differ.

All of these phenomena seem to ask the same question: how should a translator handle what the Prototype does not specify?

Before deciding what responsibility a translator bears for consistency, we can first establish what the Prototype actually promises.

For Switch, a Prototype can require Root to own `checked`, define how activation triggers a State transition, and specify how that change reaches participants through Feedback, Context, and Expose. These obligations cannot change merely because the realization uses React, Flutter, or Qt. The objects used in the Host tree, and whether an outward signal appears as a callback or a platform event, may differ.

Prototype is the first measure of consistency: it decides which semantics must remain in order for a realization to still be the same Component.

## What Does It Mean When a Prototype Says Nothing?

Proto UI wants a Prototype to describe a Component's interaction semantics as completely as possible. But “as completely as possible” does not mean recording every physical detail.

When a Prototype does not specify something, we must distinguish at least three cases:

- **It should have been specified but was omitted.** The Prototype is incomplete and needs to be revised using evidence from real use or translation.
- **The Prototype intentionally leaves it ungoverned.** The difference does not affect the current Component's identity, or has no useful meaning across Hosts, so it may be handled by the Host, Adapter, or a more specific profile.
- **Proto UI wants to specify it but cannot yet express it.** This exposes a capability gap in the theoretical model, Core, or Prototype syntax, rather than a missing option in one Prototype.

A translator cannot classify these cases merely according to implementation convenience. It can report insufficient capability or an uncertain result, but whether the Prototype omitted something, intentionally left it open, or needs the prototype system to be extended still requires explicit adjudication.

Some requirements also come from outside the Prototype. A product may require its Flutter and React Switches to be pixel-identical, or a design system may require every official Adapter to use the same dimensions and motion. Such requirements can tighten constraints on top of a general Prototype without placing every product-level detail into the public identity of Switch.

Conversely, if a Prototype turns every input model, rendering parameter, and control convention of one Host into a required obligation, it may overfit. Other Hosts may be unable to carry those details naturally, reducing portability.

The goal is therefore not for a Prototype to say as much as possible. A more precise goal is:

> Be sufficiently strict about the interaction semantics it owns, and restrained about implementation details that have no meaning across Hosts.

## Which Details Matter to a Prototype?

This restraint does not mean that Proto UI seeks only “roughly the same functionality.” The semantics introduced in earlier chapters show how a Prototype draws its responsibility around different concerns.

- **Lifecycle** concerns the relative order in which semantics hold. `setup`, continuing `runtime`, and final disposal cannot be arbitrarily reordered, but different Hosts do not have to complete them in the same physical amount of time.
- **Event** can express activation intent and medium-level input such as `pointer.down`. Defaults such as click synthesis and touch slop may be recognized by the Host unless a Prototype or portable recognizer explicitly takes responsibility for them.
- **Feedback** concerns what the User must perceive and how different states can be distinguished. Whether concrete unit mapping, font rasterization, or native chrome is constrained depends on the actual declarations of the Prototype and applicable profile.

State transitions, information-channel direction, and Component identity are likewise foundations that cannot be changed arbitrarily. Feedback is not decoration excluded from “semantics.” If the User cannot distinguish a Switch's on and off states, the implementation cannot claim consistency merely because it still accepts clicks.

Even when a Prototype is restrained about physical details, artifacts in different Hosts may remain extremely close. React, Vue, and Web Component share Web foundations, and official Adapters may use a common projection policy. But that similarity may come from the Prototype, from Adapter/profile constraints, or simply from current implementations happening to match. Only what is explicitly governed is a stable requirement.

## More Shared Conditions Permit Finer Comparison

Prototype determines the semantic floor that cannot be lost, but it cannot by itself say how closely two Host artifacts should resemble each other. That depends on the two realization contexts being compared.

A realization context must identify at least the Prototype revision and inputs, interaction medium, Adapter/Host capability profile, projection policy, rendering parameters, and allowed tolerances and exclusions. Screen, viewport, units, and fonts are among the conditions that need to be explicit. This is not a form that every Component user must fill in; it gives “consistency” well-defined objects of comparison.

Suppose React and Flutter both claim to support the Prototype but run on different devices with different fonts and interaction media. The aspects we can first compare strictly are Prototype identity, information channels, State transitions, Lifecycle order, and any declared medium branches.

If both use keyboard and pointer input under the same viewport, unit, and font conditions, input behavior and Feedback can be compared more closely. Going further, if React and Vue both belong to the Web family, and their applicable profiles explicitly share governed browser structure, events, style foundations, and projection policy, then their normalized DOM projections should also be very close after excluding necessary and declared Adapter wrappers or markers.

Pixel comparison can become the highest-strength requirement only when device metrics, unit scale, font shaping, color, and rasterization are all controlled. An unexplained difference cannot be dismissed merely by saying “the frameworks are different.”

Comparison across interaction media requires greater care. Whether a Select rendered as a desktop dropdown and one rendered as a picker on a touch device are equivalent forms of the same Select Prototype must be declared by the Prototype's medium branches. An Adapter may implement that choice, but it cannot substitute an interaction form solely because of platform convention or implementation convenience.

Comparison conditions cannot become excuses added after the fact. Tolerances and exclusions must have reasons and scopes in advance. Font rendering can explain edge pixels, but not a Switch Thumb moving in the opposite direction. A Host wrapper can affect physical DOM, but it cannot change the logical relation between Root and Thumb.

Consistency therefore has two boundaries:

1. The Prototype and its applicable profile determine what must remain invariant.
2. The shared, controlled conditions of the two realization contexts determine how finely behavior, structure, and presentation can be compared.

This neither requires every platform to be unconditionally identical nor allows “semantic consistency” to collapse into “roughly functional.” Two implementations remain the same Component because they preserve the identity and required obligations of the same Prototype. The more conditions they share, the more their remaining differences need to be explained.

These are principles for comparison, not a claim that every current Adapter or Host already has the corresponding comparison profile and evidence. Reliable evidence still comes mainly from the Web family. Comparison profiles, normalized DOM, and image evidence have not yet formed complete governed identities. An uncataloged or unverified target cannot automatically inherit a consistency conclusion.

This concludes Part II of the whitepaper, “Translation.” The next chapter opens Part III, “Evolution.” It looks for a path that lets practice keep advancing both Prototypes and the translation layer, and it considers paths Proto UI has not chosen but that remain compelling.
