# Bounded Command and single-control input shell

Status: Draft; issue #960, implementation carrier #971. This is a presentation composition, not a new Base search state machine or full shadcn InputGroup implementation.

The single-control shell and ordinary shell editor are now cataloged by [P-SHADCN-INPUT-SHELL](../../../spec/prototypes/P-SHADCN-INPUT-SHELL.yaml) and [P-SHADCN-INPUT-SHELL-CONTROL](../../../spec/prototypes/P-SHADCN-INPUT-SHELL-CONTROL.yaml), with bounded evidence and explicit gaps in [T-SHADCN-INPUT-SHELL-0001](../../../spec/tests/T-SHADCN-INPUT-SHELL-0001.yaml). Those draft entities govern this slice; this document retains source rationale, composition examples and the separate Command migration boundary. Their `since: 0.3.0-alpha.1` records the existing workspace train, not historical stable activation. No Base InputGroup identity or full InputGroup compatibility is admitted.

## Fixed reference and supported boundary

Reference: shadcn-ui/ui `3d98900e9b73c45f035f8109e9d41ba6a51685e7`, MIT: `apps/v4/registry/bases/base/ui/command.tsx`, `input-group.tsx`, `apps/v4/registry/styles/style-rhea.css`, and `apps/v4/registry/new-york-v4/ui/input-group.tsx`.

Command parts accept the existing public `styleProfile` selection. Supported IDs are exactly `new-york-v4` (alias `new-york`) and `rhea`, with `inherit` withdrawing an explicit choice. Unsupported known styles fail rather than silently falling back. A Command Root establishes a subtree boundary. The default retains the existing New York-compatible standalone Command recipe; this is not a claim that its historical inline layout is identical to upstream cmdk.

Rhea maps the inline root, input wrapper, input, list, item and empty message. The root follows its caller's inline width and auto block extent rather than forcing upstream `size-full`. Root uses theme 3xl corners, items theme xl, muted active paint rather than New York black/primary active paint. Base Command owns query, filtering, navigation, active descendant, disabled/readOnly, IME and execution. No new state machine, key handling, DOM query or selection authority is introduced in styled parts.

The source Command input sits inside InputGroup but has slot `command-input`, not `input-group-control`; its surrounding group does not match the ordinary control's focus-visible selector. Use `focusIndicator: 'none'` for this Command composition and `focusIndicator: 'ring'` for an ordinary input. These are passive presentation choices, not a change to the editor's focus semantics.

## Public composition

`@proto.ui/prototypes-shadcn/input-shell` exports `inputShell`, `inputShellControl`, `bindInputShellControl`, and their types. The shell is roleless and contains exactly one inline control. `inputShellControl` uses the existing Base Input semantic editor; Command uses `commandInput` instead. `commandInputWrapper` is an optional passive public Command region for the source wrapper spacing. Put the shell below this wrapper inside Command Root; keep Command Content beside the wrapper. The shell does not own a value or keyboard interaction and does not create a second editor.

The private presentation context tells a Command input to withdraw the old standalone border/ring when grouped. It is not an Association protocol or a public context key. Style selection continues through the shared style scope. The shell does not duplicate disabled opacity; the control owns that paint.

## Binding and lifetime

Call `bindInputShellControl(owner, target, controlInstance)` only after real public instances exist. The binder reads `getExposes().focusVisible` and `disabled` via their public `get`/`subscribe` interfaces. Missing/malformed exposes fail closed. `target.instance` must be the actual passive shell instance, not a fresh wrapper. `target.setFacts` merges only these two facts with authored props; it must not reset styleProfile or focusIndicator.

The owner supplies `isCurrent` and `onDispose`. There is at most one live binding per real shell and control. Duplicate binding is rejected. `replace(next)` unsubscribes the previous control, rejects invalid/duplicate replacements, and invalidates queued callbacks from the previous generation. `dispose()` is idempotent; every unsubscribe is attempted even when one throws. Owner retirement or destruction prevents further writes. Synchronous notifications during subscription are buffered until attachment completes. Facts are never inferred from DOM, and no editor node, value or selection is recreated by style changes.

The caller must retire the binding with its view, not install an unowned global subscription. A destroyed target must never be reused by an old owner. The two real consumers in the evidence app exercise Command and ordinary Input using the same shell/binder on each of WC, React, Vue and Vue 2.

## Explicit omissions and evidence

This is not the complete upstream InputGroup API: no addons, icon/SVG handling, addon-click focus, nested-button exclusions, invalid aggregation, multi-control ownership, textarea/block alignment, InputGroupButton or typography helpers. Command groups, separators, shortcuts, dialogs, list scrollbar hiding and scroll-padding are outside this bounded migration. Do not advertise full cmdk or all-family/all-style parity.

Synthetic DOM tests prove transport, identity and lifecycle, not browser layout. The independent native collector asserts geometry, filtering, keyboard and pointer execution, skipped disabled items, exact active ink, readonly/disabled, shared-scope continuity and failure artifacts. Text resizing is explicitly not browser UI zoom. Exact-head native screenshots remain required before readiness.

The collector's real four-adapter fixture identifies its authored shell and control with `data-demo-ref` on their Prototype Roots, then checks the single editor's containment. It captures the actual public instances and physical elements when binding becomes ready. Missing, ambiguous, incorrectly owned, replaced or retired targets fail with the runtime and consumer identity before measurement. A profile's transition token is paint, not an owner identifier; the legitimate New York Command containment omits the ordinary Input transition. These markers and checks belong to the evidence fixture and add no component discovery or interaction protocol.

The fixed fixture retains a 16px root and a `--radius: 0.625rem` theme. Its existing New York Command shell is `h-auto rounded-none border-0` around the `h-10` Command editor, so the shell oracle expects 40px height, zero radius and zero border. Ordinary New York Input instead uses its `h-9 rounded-md border` shell: 36px height, 8px radius and 1px border. Rhea retains 32px height, 18px radius and 1px border for both bounded consumers. The same consumer-specific oracle applies after a style round trip. These are expected recipes for the current fixture, not new native measurements or full upstream equivalence; actual captures and all original keyboard, pointer, continuity, readOnly, disabled and text-resize journeys remain required.
