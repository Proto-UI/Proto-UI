# Independent Control Label boundary

Baseline: `25c3d0731e39003d87f541afc5e1a294a9d95568`. Refs #865; selection affordances are separately implemented in #868. This record describes the accepted bounded implementation direction and known evidence gaps, not a completed implementation.

## Ownership and association domain

The maintainer requested real semantics for the visible control label rather than global selection suppression. The independently reviewed first slice uses an opaque pair reference, an independent Base Label, and Checkbox/Switch target participation. It does not modify their existing no-Label-part anatomy.

The reference itself is an explicit logical authorization domain. Sharing it authorizes those participants to associate even when they are siblings or come from different framework roots; proximity and framework root alone grant nothing. The host additionally proves that both current views are in one accessibility tree scope. The first Web projection requires equal ownerDocument and getRootNode identities. This does not widen same-Anatomy `kind:part` selectors. The separate existing direct-semantic-reference A11y relation carries the actual rendered Label identity.

`A11yPort.getObjectRef()` already provides privileged semantic identity. Public `asAccessible()` need not become a general identity accessor. `A11yPort.setRelation()` alone is insufficient as an ownership mechanism: derived naming needs its own bounded contribution and cleanup so it cannot remove an author or newer owner's relation. Existing host IDREF token ownership remains responsible for consumer attributes.

One live target and one live Label are supported per reference. Duplicate, missing, stale or foreign-scope bindings fail closed. Each binding has an identity and each view lease has a generation; old cleanup compares its exact lease rather than unregistering whatever currently occupies the reference. Target mutation stays in the target's runtime callback scope and calls a shared internal activation operation used by direct press.

## Representation and lowering

The initial proposal expected an object-Prop route; the executable findings below rejected that assumption. The accepted route creates a reference through a public factory and passes it through the explicitly separate typed instance-association channel. The reference cannot be faithfully serialized to attributes or generic JSON; its serialization must fail explicitly. It contains no DOM node, ID, application callback or value state.

DemoSpec needs an explicit data-only association key separate from its existing DOM/API `ref`. Each render instance materializes and caches those keys with the public factory before supplying the dedicated instance-association input; four runtime renderers consume that same transformation. The map is disposed with the demo instance. No website click listener stands in for Label protocol behavior. Static/compiler/native paths without that lowering or host capability diagnose unsupported use; they are not claimed supported from a name or empty object.

## Planned vertical slice and evidence

Draft contract, bounded semantic module/host capability, Base Label and Checkbox/Switch activation reuse; Shadcn and Brutalist projection; then homepage declarative consumption with duplicate hidden name removed. Naming-only Label and long descriptions remain copyable. Separate naming/activation options permit a controlled conflict diagnostic without overwriting explicit author names.

Acceptance includes direct versus label click exactly once, native keyboard remaining on target, disabled and controlled rejection, mixed Checkbox clearing, nested interactive descendants, cancelled drag, naming changes, duplicate/missing/cross-scope participants, detach/remount, same-epoch replacement, stale callback, reentrant focus and consumer-name preservation. Actual mouse/keyboard and source-bound screenshots are required on all four Web adapters before claiming the visible defect fixed. Native platform and assistive-technology acceptance remain explicit gaps until tested.

## First executable findings and transport correction pending review

The initial implementation has 19 passing owner-layer tests for opaque identity, pairing, duplicate/scope/lifetime guards and the Web pointer-intent bridge. Fourteen existing Checkbox/Switch tests still pass. The first seven Web Component paired tests all fail, correctly exposing that the initial proposal's assumption about an existing arbitrary object-Prop transport was false: `packages/modules/props/src/kernel/kernel.ts` validates every resolved input with `isJsonPropsValue` before checking its declared type.

`C-PROPS-0003` and `C-PROPS-0008` are active and require JSON-only resolved Props. The factory's explicit nonserialization behavior is therefore rejected; no target association arrives. No Props kernel or stable contract was changed to hide this failure. Making an opaque reference look like an empty JSON object would evade validation while losing identity under serialization and is rejected as an approach.

The preferred correction for review is a dedicated, explicitly cataloged instance-association input outside Props: Adapter facade input transports the bounded reference to a ControlLabel port, while Prototype participation and JSON naming/activation options remain explicit. This preserves the stable JSON Props contract and is not a generic component lookup or action bus. An alternative would be an explicit narrow Props-contract revision, which must not be slipped into this implementation. The transport-dependent work remains unverified until that boundary is reviewed and the paired tests genuinely pass.

The transportation review selected the separate channel and rejected a non-JSON Props exception. Core now defines only `InstanceAssociations.controlLabel`; RuntimeHost initialization and RuntimeController updates validate and deliver it to the participating ControlLabel module. WC exposes `setElementAssociations`, while framework facades own an `instanceAssociations` input excluded from portable Props. Ordinary attribute/static JSON values have no implicit lowering. The same seven WC paired tests now pass without changing Props validation; this is an Adapter-path happy-dom result with synthetic pointer input, not native-browser certification. Package and official workspace TypeScript checks passed before this transport revision and must be repeated for its final candidate.


## Independent review follow-up (2026-10-06)

The first frozen core review tree was `6d853ad6c2c5ba714ad4319ea894c3036428d2fb` at base `25c3d0731e39003d87f541afc5e1a294a9d95568`. Review identified stale pressed state after ignored Enter, per-participant document observers that missed shadow-tree removals, and an input bridge that rejected trusted non-pointer activation. The Enter regression was reproduced (2 failing / 29 passing cases against the old code) and the common activation stage now clears pressed state before ignoring Enter. Target helpers retain typed RunHandle inputs. Radio uses one shared activation stage and retains its pre-existing focus-state synchronization.

Shared per-scope observers now cover open/closed ShadowRoot detachment and reinsertion, including an actual React Adapter mounted into sibling shadow hosts; a 30-label fixture has one scope observer and unrelated mutations produce no participant refresh. This is Adapter/happy-dom evidence, not native-browser or screen-reader certification.

A first cancellation experiment deferred intent to a microtask. That is not a reliable post-dispatch boundary, and a later timer experiment would risk losing synchronous native focus/user-activation behavior. Neither experiment is the accepted delivery. The current explicit bounded host intent commits synchronously at its click listener, checks cancellation already observed there, retains pointercancel/drag rejection, and does not equate pointerup cancellation with click cancellation. A later listener cannot roll back an already committed operation. Native HTML-label comparison is still required; no claim of exact native default-action parity is made. Trusted non-pointer classification has host-fact tests, not fabricated trusted events or an actual assistive-technology run.

Reference comparisons accessed 2026-10-06: [HTML activation](https://html.spec.whatwg.org/multipage/interaction.html#activation-behavior) allows user activation through non-mouse input; [Pointer Events click attributes](https://www.w3.org/TR/pointerevents4/#event-attributes) distinguishes non-pointing clicks with pointerId -1 and empty pointerType; [HTML script cleanup](https://html.spec.whatwg.org/multipage/webappapis.html#clean-up-after-running-script) allows microtask checkpoints when the execution stack empties. These are implementation comparison sources; Proto independently owns this draft contract and its stated limitations.

## Package publication boundary

The new module follows the repository public-package shape (`private: false`, public publishConfig), so it participates in future release BOM/readiness discovery. Source inspection of `.github/workflows/release-packages.yml` found `workflow_dispatch`, a main-branch guard and the npm environment for publish mode; merging this code does not itself trigger registry publication. The scheduled release-cadence workflow opens readiness tracking. No registry publication, credential change or release execution is part of this contribution. Existing Bootstrap and Liquid Glass packages retain their private source-only identity; workspace runtime/compiler evidence and installed-consumer unsupported diagnostics are separately required.


The expanded Finf acceptance also requires GPUI at equivalent usable capability level. The current GPUI compiler unsupported test describes the baseline safety boundary only; it does not satisfy or waive that acceptance. Native association identity/lifetime, accessibility naming, activation/focus, layout and live demo evidence remain open. No DOM IDREF encoding is assumed for GPUI. The four-Web native journey is implemented in the existing registered homepage browser suite but has not run on this candidate.


## Additional synchronous state-subscriber check

On the frozen Web/Core candidate, a read-only exposed-state subscriber could remove the associated Label during Checkbox/Switch state mutation, yet the old request would still emit its later checkedChange. The discriminating fixture reproduced two failures and sixteen passes. Current-request guards now separate each state mutation from subsequent outward emission and context publication; the already committed state is not rolled back. Focus-driven Label detachment, disabled editors and controlled Switch proposals also have real Adapter harness coverage. The expanded target regression run passes 55 cases across four suites; this does not replace the pending native run.


## Host action projection and exact lease retirement

The shared native-host implementation exposed a missing transport fact: a host needs the explicit current activation option to advertise or withdraw an accessibility action on the same visible text node. The draft Host capability now receives initial activation and a current-lease setActivation update. The Module alone synchronizes this boolean; target participation and naming-only labels never advertise a second Label action, and style utilities are not used as a semantic input. This does not add a portable Button role, Tab stop, duplicate text or JSON Props exception.

A new lifecycle test also reproduced an old cleanup revoking a reentrantly installed association (one failure / three passes). Release now captures and clears both old slots before callbacks, and an outer reference setter cannot overwrite a newer generation established by cleanup. Host action mount/toggle/retirement tests plus the Web/Adapter/projection set pass 64 cases across eight suites. These are source/host-harness results; GPUI and real Web input still require their own current-candidate evidence.

Local package evidence before this host-cap extension: 45 public package builds, 469-file Astro check (zero errors, four hints), and a 294-page documentation build passed. Eight local module dependency tarballs installed offline with scripts disabled; JavaScript consumers verified reference identity, explicit serialization rejection and module exports. No registry publish occurred. The local source budget remains over the existing Runtime/React/Vue ceilings and is reported as an integration issue, not waived by these passes; canonical combined Finf evidence must govern a separate numeric transaction.


## WC split-editor accessibility scope

A public shadow:true WC Input exposed a concrete host-scope mismatch: the Label view lease used the outer trigger shell while A11y named the inner editor in a separate ShadowRoot. A negative Adapter fixture reproduced a cross-root aria-labelledby contribution (one failed / eighteen passing cases). The view provider now shares A11y's actual physical-surface getter and listens to both surface and readiness changes. An outer Label remains rejected; moving it into the editor's physical root permits the relation, and moving it out withdraws the relation and prevents a new focus request. The focused WC/Focus set passes 44 cases across three suites. These are Adapter/happy-dom tests, not native browser or assistive-technology certification.
