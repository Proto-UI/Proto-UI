# Draft owned decoration: current implementation and design history

The bounded implementation section at the end is the current candidate. Earlier sections retain the gap inventory and proposal history from #938; statements that no implementation exists describe that earlier spec-only slice. Status remains Draft, with native accessibility and portable lowering unverified.

# Historical gap inventory and proposal (2026-10-22 / 2026-10-23 00:49 UTC)

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

# Draft fixed-view owned decoration activation

This candidate implements the bounded runtime path proposed in #935/#938. It is not a stable cross-adapter API, portable compiler implementation, or Tabs line recipe.

## Authoring and ownership

- `def.feedback.style.declareDecoration()` creates one frozen opaque identity owned by this instance.
- `r.decoration(target)` binds that identity to one empty adapter-created leaf. It accepts no tag, props, children, event, text, slot or PrototypeRef.
- Setup `def.feedback.style.to(target).use(tw(...))` and Rule `i.feedback.style.to(target).use(tw(...))` retain the existing style values and semantic merge. Host style remains separate.
- This first slice has no target runtime patch/suppress, public physical node, selector addressing, behavior owner, keyed diff, portal/reparent or rematerialization promise.

## Physical closure

Only ordinary light-DOM Web Components opt in. Owner and view capability sets explicitly carry the same eligibility, while physical binding occurs only after whole-blueprint detached staging. Native text/image/link surfaces and Shadow profiles do not opt in. Other runtime adapters reject declaration without the capability.

The adapter creates an empty neutral span, with permanent aria-hidden=true, inert, no tabindex/content and pointer-events:none!important. Existing data-pui-style projection and the configured Template TW resolver provide paint; no page stylesheet or component-specific selector is introduced. The public A11y instance projector is not reused to hide the parent control.

Complete binding validation precedes caller slot movement. Initial contributions replay to detached owned leaves. Subsequent Rule changes update only those leaf styles; host/other leaf contributions remain independent. Re-render with live target bindings fails before adapter mutation. Unmounting ends this fixed-view target lifetime and blocks subsequent writes. Final host replaceChildren failure rollback is not promised.

## Runtime and compiler boundaries

The existing style operation retains an opaque target address through runtime compilation/evaluation into a separate per-target frame. The Web exposed-state optimization retains any op with a target field in the runtime evaluator, including malformed undefined/null fields; it never lowers those ops into host selectors. Feedback rejects foreign/unknown/disposed targets before frame replacement.

Portable compiler source and serialized plan paths remain unsupported and reject. A legal host-plan control establishes that the rejection is due to the extra target field rather than an otherwise malformed fixture. The generic compiler implementation remains separately coordinated under #902.

## Evidence and remaining work

Local approved runtime plus authored changes: 23 test files / 299 tests pass, including 9 actual WC DOM cases; narrow TypeScript passes including new tests. Existing optimizer regression: three addressed cases fail before the guard and pass after it. Tests prove contribution replay/withdrawal, independent leaf and host paint, caller node/value/focus/selection retention, binding rejection, terminal cleanup and no render on style changes.

These are DOM unit tests, not native-browser focus/accessibility acceptance. No computed-color/native screenshot evidence is claimed. Expanded core/runtime/WC non-browser results: 241 files pass, 2 fail, 3 skipped; 2079 tests pass, 2 fail, 34 todo. The failures are the previously reproduced missing base-dropdown-group registration and old Dialog Mask mounted assertion. External CI remains pending. Native evidence, cross-adapter support and a separate production consumer remain follow-on work. New York/latest-style Tabs line is not enabled by this candidate.

## Integration

Actual feature dependencies: #941 registry and #945 whole-blueprint/caller-slot staging; draft contract #938. #951 gte and #953 viewport changes are independent collaboration inputs sharing additive files, not decoration feature dependencies. Preserve their contributions when assembling the branch. No generated stylesheet changes are borrowed from unrelated projection branches.

## Draft view-generation refinement (#957, 2026-10-23)

The earlier fixed-first-view proposal and #956 implementation above are historical boundaries, not a reason to equate normal framework view detachment with owner disposal. `createViewEpochOwner.detachView()` unmounts a view while retaining its logical session; `dispose()` is terminal.

The follow-up keeps one registry and opaque target/contribution identities for the live logical owner. Unmounting revokes the current physical sinks before the adapter releases DOM. Suspended logical contributions may change without physical writes. A newly signalled mounting generation validates the complete same target set, binds new empty adapter-owned leaves, and replays the latest merged values. Declarations never reopen. Terminal instance disposing/disposed closes the registry permanently.

Old physical callbacks cannot revoke or paint a newer view. Harmless stale framework ref notifications do nothing, while explicit stale bind/sink operations fail closed. Per-view stages are one-shot; the registry is not reset. Structural replacement inside a still-live view, unexplained root replacement, caller-owned targets and portal relocation remain unsupported. Runtime mount epochs alone do not authorize arbitrary physical replacement.

React binds in its matching layout commit before acknowledgement and the final-style reveal barrier. Vue binds after nextTick with captured root/gate/generation checks before acknowledgement; integration must preserve #921's newer reveal barrier. Vue2 uses native VNode insert/postpatch/destroy hooks and binds at its existing current-view acknowledgement. Existing viewport contributions from #953 remain independent additive integration requirements.

Local framework coverage includes ordinary React and StrictMode, same-turn React.Activity hide/show after successful binding, Vue3 KeepAlive with owner Context enabled/disabled, and Vue2 KeepAlive. Setup remains once, logical intent survives legitimate retained-owner view changes, and style updates retain caller input identity/value/focus/selection without Proto rendering. These are DOM/framework tests, not native accessibility acceptance. A separate no-target control on the unchanged approved baseline reproduces an existing React Activity failure when hidden across a timer and shown after deferred owner disposal; this patch neither revives that disposed owner nor claims the broader retention gap fixed.

The contract remains Draft. Portable compiler target lowering remains explicitly rejected. Native source-bound evidence for these new adapter and view-generation paths is still required.

### Captured private binding authority

The FeedbackPort exposes a private opaque view-lease capture for adapters. Capture happens while staging, not in a delayed commit callback. The whole binding set snapshots target/sink fields once, validates every sink and exact current lease, and only then publishes. A detached, foreign or retired lease cannot bind even when a new view is mounting. A malformed unpublished sink batch can be corrected without poisoning the view. Reentrant flush stops when its captured binding generation changes; it must never resume into a newly rebound view.

Local verification at 2026-10-23 02:47 UTC: 21 focused files / 300 tests pass, including all Feedback tests, shared staging, four adapters, StrictMode and KeepAlive. Full workspace TypeScript passes. A broader three-framework run has 1197 passing and 11 failing tests; the same eleven failures reproduce exactly in the unchanged prior approved snapshot (six files, 88 pass / 11 fail). This is baseline comparison, not a full-green claim or an attribution of their original cause. No new adapter-native screenshot or AX acceptance is claimed.

Final formatted candidate combined run: 1491 tests pass and the same 11 comparator-reproduced cases fail. Two existing browser suites additionally fail at Chromium startup with ProcessSingleton socket EPERM, leaving 18 tests skipped; they are not native passes and no browser restriction was relaxed. The result is not a full-green suite.

## Draft same-document portal refinement (#963, 2026-10-23)

This candidate changes the earlier explicit portal rejection only for an existing same-document logical portal owner and fixed physical view. No public author spelling changes: the leaf stays empty, permanently decorative, and owned by the current Feedback view lease. A private transport gate stores only the latest already-merged paint, not a second contribution engine. It waits for the existing portal material epoch's actual projection commit before writing.

Policy suspension withdraws the old epoch's paint and cannot revive that epoch. A new authoritative portal epoch can replay retained logical paint only while the same physical view lease remains current. Terminal view retirement, foreign-document adoption, or reentrant owner replacement during a physical write stops old writes. Old releases cannot clear a newer epoch. Normal overlay close/open may construct a new physical leaf; this is not a promise of cross-close leaf identity or focus. Within an open view, changing styles retains caller nodes/value/focus/selection and causes no Proto render.

WC portal moves use a private synchronous, nested and finally-cleaned relocation window so connectedCallback does not request an unrelated Template rebuild during an authentic lease-owned move. Arbitrary DOM moves or user attributes cannot enter that window. A direct-body no-op gets a real material epoch without moving the host, creating a physical projection marker, or changing isPortaled semantics. Repeated mount is idempotent; unmount retires that lease. Cross-document transfer does not use the same-document reconnect shortcut.

React uses its stable createPortal container; Vue uses the existing Teleport projection commit; Vue2 uses its existing native projection commit, including its no-op destination path. Their current-view stage and original logical ownership remain authoritative. Preserve independent #921 reveal and #953 viewport contributions during integration. Portal logical Context is not replaced with DOM ancestry.

Evidence at this candidate: four actual adapter DOM canaries exercise Rule paint, open-view no-render/focus/selection and three close/open cycles. WC additionally tests a direct-body no-op. Guard tests exercise nested relocation, throwing moves and retirement during connectedCallback. These are DOM unit tests, not native-browser portal geometry, focus or accessibility acceptance. The full focused run has 171 passes and two Vue/Vue2 cross-document control failures; both reproduce unchanged in the #961 predecessor (32 pass / same two fail). Full workspace TypeScript passes. This is not an all-green suite. Portal-native evidence and production Select consumption remain pending; this candidate does not make any PR Ready.

## Draft authenticated caller relocation, 2026-10-23 (#972)

A light-WC parent commit may move its existing caller slot subtree while retaining the same child logical owner and fixed owned-decoration view. This is adapter-owned physical transport, not a new Template target binding or arbitrary author reparent guarantee. A private synchronous receipt authenticates the complete shadow-inclusive planned destination ancestry and document for each existing descendant. Each node may claim that receipt only once, before extensible reconnect hooks run; suppression of the redundant reconnect update rechecks the same owner and receipt afterward. Nested frames preserve consumed outer state and clean up in finally. Author reentrant moves, mismatched ancestry, foreign adoption and stale receipts do not receive the shortcut.

The final staged replacement, slot-only transition and live caller projection use the same private helper. Blueprint validation still precedes caller movement. Projection rechecks a later node's source and the current slot boundary after earlier callbacks, rather than reclaiming author-moved nodes. This does not promise rollback after final host mutation exceptions or a generic keyed diff.

Explicit child update/setProps structural recommits remain rejected before replacement. The successful Select consumer uses the existing Surface owner and shared Rule/Context paint, with default adapter options; no fixture autoUpdateOnPropsChange:false switch supplies production acceptance. Earlier isolated nonportal capture fixtures used that option to bound their no-render proof and must not be described as proof that arbitrary default own-props rerender is supported. Native evidence for this caller-relocation candidate remains pending; DOM tests and consumer probes do not substitute for native focus, selection or accessibility validation.

### Caller focus transport follow-up

The initial caller-relocation candidate preserved node identity but a focused caller lost focus during detached staging. The follow-up captures focus before that staging, then restores it only while the destination-bound move is still current, the original node is live in the same document, no author focus/attached blur superseded it, and the target is neither disabled nor in an inert subtree. Native input/textarea selection ranges and open-shadow active chains are covered. Contenteditable selection transport is explicitly not implemented; it does not receive this restoration. This is not permission to focus a replacement node or override deliberate author focus, and a throwing/failed commit does not gain a restoration guarantee. Native F3 parent-recommit evidence is a separate required acceptance step.

## Draft exact fixed-blueprint reuse, 2026-10-23

This follow-on refines the earlier all-recommit rejection without allowing structural rebinding. Owners with setup-declared targets use one immutable complete Template snapshot for validation, comparison and materialization. Unknown fields, events, arbitrary props, cycles, unsupported scalar values, duplicate or missing targets, and invalid Template/SVG shapes reject before publication. Opaque target references are compared by identity, never serialized. Owners without declared targets retain their existing Template update semantics.

After a successful first physical commit, an exactly equal snapshot may retain the same view, lease, stage, physical nodes, portal gate and slot projector. Equality includes every Template-owned wrapper, text, ordered static style token, SVG field, slot location and target identity/order. Validation alone grants no binding authority: a second direct bind in the same live lease remains rejected. Snapshot callbacks cannot replace or dispose the captured owner/lease and still authorize reuse.

The cache records only successful physical commits before their normal acknowledgment. Reentrant acknowledgment may dispose, close or supersede that view; the old turn must not overwrite the new state afterward. Reuse requires the same logical owner/session, physical root/document/view generation and current lease. Existing physical leaves and their ownership ancestry must still match; stale, replaced, missing or retired leaves are not repaired. Portal reuse additionally requires its original authoritative active material epoch. A legitimate new view uses the existing new-generation binding path, never revival of a retired lease.

Caller children are not part of the cached author Template and framework VNodes are not cached: caller A-to-B changes must continue through the existing slot projection. Props-driven equality checks may execute the prototype renderer; the guarantee is no replacement or rebinding, not zero render. The existing Rule-only zero-render guarantee is unchanged. No arbitrary reparent, structural diff, stable API, or cross-document support is introduced.

Validation for this new refinement is in progress. Earlier native artifacts do not establish default-props reuse; four-framework and native acceptance must bind this candidate's exact source.

Local follow-on evidence: 14 focused files / 208 tests pass, followed by an additional passing ordinary-author whole-host reparent control (13 tests in that WC suite). That control proves a same-document author move still executes the ordinary owner update and is not given the authenticated relocation shortcut. It does not establish cross-scope Context rebinding or arbitrary reparent guarantees. Four production Select Surface adapters additionally pass the explicit new-york → rhea → inherit props consumer with strict live leaf, trigger, caller option, value and focus identity checks. These remain DOM observations. The dedicated native lane uses default adapter options, real F4 props changes with exactly one prototype reevaluation per change, and strict physical identity/focus/selection/paint/AX checks; its execution is still pending.
