# Liquid hover: revalidate idle framing across awaited observations

## Preserved native failure

Source `6882c82945c1dbe935482055086b6cc88c22ea97`, tree `ea0c768a3ca17e365a82e2bc4661e313063ff501`, run `38731555887`, Vue artifact `11971291609` retains six failing policy captures. Light Reset and Accordion, and dark Reset, Collapsible, Select and Dropdown fail at reenabled idle boundaries. The interaction journey passes.

The initial framing check observes fully padded controls and performs no scroll. Before the subsequent material observation, the page scrolls by 962px in four cases and 780px in two. Document positions remain identical. All six newly observed material receipts are self-optical/rendered with matching actual geometry; their retained material PNG hashes match and observed minimum foreground contrast is at least 7.758781033698771. The subjects have genuinely moved outside the viewport. The screenshot guard correctly refuses root/context crops.

The source sequence sends disabled Space, removes the disabled prop, moves the pointer away and captures the reenabled state. A delayed native default scroll is consistent with these observations. Intermediate scroll events were not logged, so the exact animation trajectory is not asserted. Disabled Space remains unchanged; neither prototype input handling nor browser default actions are suppressed.

## Evidence acquisition correction

The test-only idle controller now treats material readiness and snapshot decoding as asynchronous boundaries that can invalidate earlier framing. It verifies actual geometry after readiness, then takes a fresh material observation and verifies its geometry against another actual read. A changed viewport position requires a new complete attempt at an explicitly permitted idle boundary. A required scroll uses the existing real framing operations and is followed by a new material observation; old pixels are never translated or reused.

Each attempt retains its actual reads, framing actions, material geometry when available, acceptance flag and failure. Base states, semantic requests, viewport size and document layout must remain unchanged across the entire sequence. Hover, press, held contact, focus and unknown eligibility cannot trigger corrective scrolling. A failure in these invariants, readiness or decoding remains a failure rather than being retried as movement.

At most four complete geometry attempts are allowed, sharing the existing 8,000ms acceptance budget. The remaining budget is passed to readiness and checked after awaited operations; it does not cancel an already pending decode or impose a hard wall-clock limit. This is an evidence-acquisition limit, not a product animation parameter. Continued movement or a late observation fails. The separate screenshot path still has no scrolling capability and retains strict before/between/after geometry checks. Movement after the accepted material observation remains an explicit capture failure.

The executable native suite uses this same controller. Active captures retain their observational path. The sixteen-case / 2,880-capture plan, original thirteen Toggle cases, Portal cases and all optical/source/contrast thresholds remain unchanged. No renderer, prototype, Runtime, Core or Compiler source changes.

## Offline evidence and remaining boundary

An extracted original ordering reproduces the offscreen root/context failure after an injected 962px readiness-time scroll, and wrongly reuses the first material observation after decode-time movement. It also accepts persistent motion and state/request/layout changes. Those red results remain recorded; a missing-import failure was not used as the reproduction.

The first correction retained a further race inside the native frame reader: it sampled geometry before an awaited material decode. A 962px scroll during that decode incorrectly marked the attempt accepted, after which the strict screenshot guard correctly failed. The final reader now decodes first, then reads actual geometry, synchronous fixture state/requests and current DOM material eligibility in one browser task. Seven executable tests extract the real native reader, reproducing this race before the fix and checking fresh geometry, live eligibility and complete reacquisition afterward. The original failed candidate and red results remain retained.

Focused checks pass 203/203 across four files: 73 acquisition tests, 100 fixture tests, 13 coverage-plan tests and 17 source-layout tests. The acquisition total retains all original 49 cases and adds 24 ordering, convergence, invariant and budget controls. Workflow-input checks pass 67/67, strict targeted TypeScript passes, and changed files pass formatting.

These fake-I/O checks establish control flow, not native scrolling or optical success. Fresh exact-head browser evidence remains necessary for all four runtimes and both themes. The known ancestor-border admission coverage gap, main-command tint visual failures and separate synthetic-cancel sequencing defect remain separate findings.
