# Docs Contents navigation lease

> Status: Draft consumer direction for an uncataloged website boundary. The current user selected this normal-close boundary on 2026-11-06. This is not a stable public Prototype or Adapter guarantee. Catalog the consumer slice before lifecycle admission; applicable spec entities take precedence.

The Docs Contents command lends its one existing native navigation tree to the public family Dialog. Original nodes, listeners, details state, current-route markers, scroll state and the home sibling position remain owned by the website. The Dialog owns modal presence, dismissal and focus. This boundary does not govern the separate Header-anchored Popover navigation tracked in Issue1191.

## Normal close

Logical `open=false`, perceptual leave completion and structural teardown are different facts. The existing draft [C-AS-TRANSITION-0001-B/E/K](../../../spec/contracts/C-AS-TRANSITION-0001.yaml) retains the view through leaving and does not equate `isPresent` with a structural mount or terminal disposal. Both family Content definitions configure a 200ms logical leave: [Shadcn](../../../spec/prototypes/P-SHADCN-DIALOG-CONTENT.yaml) and [Brutalist](../../../spec/prototypes/P-BRUTALIST-DIALOG-CONTENT.yaml).

For an ordinary close, keep the borrowed navigation in the leaving Dialog until its public `open=false` and `isPresent=false` boundary, after the public close callback has unwound. Return that same tree to its original home before the renderer removes the borrowed slot. Logical closure and returned Trigger focus alone do not require the tree to be home already. A same-view reopen interrupts the pending close and retains the active lease.

`data-site-contents-dialog-tree` is the existing website lease marker. Its removal follows the home insertion; it is an observable completion boundary for this consumer, not a second Prototype lifecycle or a portable native readiness API. Do not remove it early to satisfy a test, regenerate the tree, or infer terminal teardown from its absence.

## Consumer acceptance

The real browser journey must retain its close, focus, one-tree, home-position and marker assertions. Begin one 1000ms close-observation budget after the native Escape request returns. Logical-close observation, focus verification, lease completion and the original handback assertions all share that budget. Observe the real completion marker without a fixed sleep or a fresh independent timeout. Preserve the original 180s case deadline. The previous immediate-first-read failure remains negative evidence of the old fixture premise; it is not relabeled as a product pass.

The held-leave source-host control separately checks that the tree stays borrowed while leave is pending and returns before renderer detach. Native evidence must independently verify real input, actual tree identity, rendered behavior and focus; the source-host substitute alone does not establish those results.

## Exclusions

Fatal renderer retirement, terminal teardown/focus release, generation replacement and failed disposal require their own lifecycle evidence and shared owner contracts. Public `open=false` / `isPresent=false` is not proof of those terminal conditions. This slice does not redefine Transition, add public family APIs, alter motion durations, accept Dialog probe calibration, or close the broader website/mobile-navigation acceptance work.
