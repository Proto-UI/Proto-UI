# Owned decorative style target: contract boundary draft

Status: design preparation for Proto-UI/Proto-UI#935, not a stable API, implementation claim, or acceptance. Production Tabs #937 explicitly rejects upstream line until the real capability exists.

## Proven current boundary

Static comparison: eight inspected core/adapter/contract files have identical Git blobs at approved 6d318 and main b928. `TemplateStyleHandle` is an alias of the pure token `StyleHandle`, not a mutable target identity. The Rule feedback operation carries style handles and no non-host target. Ordinary Template props admit only static style. Web Component Template v0 rejects PrototypeRef and rebuilds children on commit. An isolated attempted decorative child prototype failed with the actual synchronous C-TEMPLATE-0006 rejection and was removed.

Neither a custom-element string, DOM query, arbitrary selector variant, mutable token object, render-on-state, nor Tabs-specific adapter branch closes this gap legitimately. #788 only handles static Template TW; #521 is not generic keyed diff; #495 owns sliding indicator geometry/motion, not this capability.

## Smallest proposed semantic scope

1. A setup-created, instance-scoped opaque identity denotes one owned decorative leaf. It is not a string/debugName, DOM handle, behavior owner or reusable cross-instance reference.
2. The Template binds that identity once to a framework-owned decorative leaf in its already-declared structure. Slots, caller children, host elements, PrototypeRefs, arbitrary external nodes and duplicate binding are invalid targets. Styling cannot create/remove/reparent/rebind the leaf.
3. Existing setup and Rule feedback style contributions can address either the existing host or that identity. Tokens remain style-only values. No themeProjection, event/state transport, selector syntax or separate behavior IR is introduced.
4. The existing semantic merge law applies independently per target. Rule invalidation retracts only its own contribution. Equal updates need not publish; independent targets and other rules remain intact.
5. Contributions may be established before physical Template commit. Adapter binding replays the current merged value onto the stable owned node, then later changes update style only. The prototype never receives physical node access.
6. Teardown invalidates binding and contributions, emits no later writes, and never touches caller-owned children. A new lifetime gets a new identity. Reparent/portal/keep-alive behavior is not silently inherited from this narrow feature.
7. An adapter either implements the declared capability or explicitly rejects it. A supported syntax/type is not proof of physical closure on all adapters.
8. Decorative leaves are excluded from the accessibility tree and focus navigation; they expose no events, interaction ownership, accessible naming or user content. This requires a precise Template/accessibility contract, not opportunistic aria attribute forwarding.

## Interface locations, not settled spellings

- packages/core/src/spec/feedback/style.ts: retain immutable StyleHandle values; define a separate owned-target identity only if governance accepts it.
- packages/core/src/spec/template.ts: narrowly governed owned decoration binding. Preserve PrototypeRef rejection and slot restrictions.
- packages/core/src/handles.ts and Rule compiler intent encoding: express an optional governed target identity on existing style contribution operations without a new behavior channel.
- runtime style contribution storage: per-instance/per-target merge, withdrawal, pending-before-bind and terminal cleanup.
- adapter style sink and template commit: register the owned physical leaf once, apply only merged style on updates, dispose bindings deterministically. No generic keyed-diff promise is needed for this fixed leaf.
- spec/contracts: extend the visible Template-style gap only with explicit Draft law and adapter-support declaration; C-FEEDBACK-STYLE-0001/0004 and C-RULE-INTENT-FEEDBACK-STYLE-0001 remain authoritative.

Public API spelling and target factory shape remain undecided. This memo is not permission to implement core/adapter files without checking current owners and contracts.

## Independently testable dependency slice

A generic, non-Tabs prototype with two stable decorative leaves and one caller slot must demonstrate: independent contributions; precedence and withdrawal; context/props/state invalidation; pre-bind replay; no render call; exact DOM and slot identities across changes; focus and text selection retention; no leaked callback after teardown; duplicate/cross-instance/slot/foreign target rejection; explicit unsupported-adapter rejection; no focusable or accessibility-visible decoration. Then a separate Tabs line consumer can use Base selected/orientation facts and map its owned line target without geometry/motion scope from #495.

The first adapter implementation and its test harness would be a distinct finite owner claim. This memo makes no implementation or browser acceptance claim.

## Accessibility projection inspection

`AccessibleHandle` is setup-only for the current logical instance. It cannot target an arbitrary owned Template leaf, so applying parent `asAccessible().tree({hidden:true})` would hide the wrong subject and its user content. `packages/modules/a11y/src/web.ts` projects `tree.hidden` to aria-hidden alone, whereas `states.hidden` also writes layout-hiding hidden. A presentational role alone does not provide the required accessibility exclusion and focus guarantee. The future generic decoration binding should reuse the governed accessibility exclusion meaning without adding arbitrary Template props, hiding the parent, or inventing a full interactive semantic-object owner for an empty decoration. The exact owned-leaf binding route remains an explicit draft question.

## Implementation sequence and ownership

1. This spec-only slice establishes Draft criteria and planned tests, with zero runtime support claims.
2. After current core/runtime/adapter owners are coordinated, a separate finite implementation slice can add instance-scoped target identity, existing-style contribution addressing and independent merge/withdrawal. It must reject unsupported targets; tests first prove no forged/cross-instance/duplicate binding and terminal cleanup.
3. A separate adapter binding slice realizes stable owned decorative leaves and accessibility exclusion, proving native no-reset and unsupported-host failure. No generic keyed diff or prototype composition is included.
4. Only then can Tabs line consume the capability, using existing Base selected/orientation facts. Sliding indicator geometry/motion stays under #495; shared glyph semantics remains a separate gap.

## Pending-bind versus unavailable target

Setup may record contributions for a declared target before its first physical commit. That pending declaration is not an unknown target and must not write to the host. The first commit must validate the complete required binding set before projecting any of it. Missing, duplicated, foreign, or unsupported bindings fail closed. The narrow first capability does not promise a target's rematerialization after structural render, view replacement, reparent or portal movement; that lifetime boundary needs an explicit decision rather than silently borrowing A11y ref rematerialization guarantees.


## Concrete candidate interface for review, 2026-10-23
The following spellings are proposed for review, not stable or already implemented:
- Setup: `const target = def.feedback.style.declareDecoration()` returns an opaque, frozen, instance-local target identity, never a DOM node or string key.
- Template: `r.decoration(target)` declares one empty owned decorative leaf. The author cannot choose an arbitrary tag, props, events, content, tabindex, children or slot; the adapter chooses a neutral physical leaf. No PrototypeRef or custom-element escape.
- Setup contribution: `def.feedback.style.to(target).use(tw(...))`; Rule contribution: `i.feedback.style.to(target).use(tw(...))`. This extends existing style contribution addressing; StyleHandle remains a value. Host use remains unchanged. Runtime patch/suppress targeting is excluded from this first slice.
- The adapter must project permanent accessibility-tree exclusion (aria-hidden=true on Web) and guarantee the empty leaf cannot receive focus or events. Parent AccessibleHandle.tree.hidden and role=presentation are not substitutes. No arbitrary attribute forwarding.
- Fixed initial-view lifetime only: complete binding-set validation before any caller node mutation, replay pending contributions after first bind, exactly one binding, style-only updates without render, and terminal cleanup. Structural rerender with live targets must reject before mutations; portal/reparent/keep-alive/rematerialization are explicitly unsupported pending later law.
- Target identity must remain attached to existing style operations/plans through Rule evaluation and compiler lowering. The present evaluator flattens host tokens, so adding only an optional type field is insufficient. Unsupported compiler/adapter profiles must reject rather than erase the target or paint the host.

Private model #941 (18 tests; full feedback suite 257 tests) supports merge/lifetime investigation only. It does not settle the activation contract or make Tabs line available. Compiler/IR coordination is requested through #902. A separate existing-v0 failed-commit atomicity repair will stage the entire blueprint before moving slotPool; it introduces no target API and does not constitute activation.

The existing failed-commit slot staging repair is tracked independently by #943 / #945. It preserves caller nodes on a rejected existing-v0 blueprint; it does not activate targets or settle these candidate spellings. Compiler coordination request: https://github.com/Proto-UI/Proto-UI/issues/902#issuecomment-6354624623 . No reply is presumed to approve this proposal.
