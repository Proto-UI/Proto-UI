# Base Popover owns one logical-first opening entry

Status: explanatory projection of draft `P-BASE-POPOVER-OPENING-ENTRY`, `P-BASE-POPOVER-ENTRY-LIFETIME` and `P-BASE-POPOVER-FOCUS-HANDBACK`. This is not full Popover or cross-host acceptance.

## Authority and scope

`spec/**` is authoritative. Base consumes draft `C-AS-FOCUS-SCOPE-0002-L/M`, `C-AS-FOCUS-ENTRY-0001-D/E/F/G/I` and `M-FOCUS-0001-H`: one Scope activation selects logical members first and may delegate its empty path to the same owner's separately declared Entry. Focus owns that activation's pending continuation, readiness and cancellation. The host resolves descendant-first/self Entry and projects the existing `preventScroll` policy without inventing target facts.

The original scroll proposal was prepared against `3f7a86759e88428c72261f5ae8ec60394f126296`, when Popover had no catalog entity. The current draft criteria and direct `T-POPOVER-OPENING-ENTRY-0001` mapping supersede that uncataloged policy. Draft `P-BASE-DROPDOWN-MENU-CONTENT-A11Y` remains a precedent for scroll-preserving requests, not Popover authority.

The owner of this consumer policy is `asPopoverContent()` in Base. Family Content projections and the existing Date Picker composition inherit it. Appearance, Root open ownership, request reasons, selection and public component API retain their existing owners.

## Required behavior

1. An accepted opening enables Content's descendant-first/self Entry role before one Scope activation configured with `entryFallback: 'entry'`. An eligible logical member retains priority, including a selected target that is not ready or whose acquisition is rejected. Only that same current activation with no logical selection may enter the native descendant or use Content self fallback. Content does not declare a Focusable or roving member, inspect `isActive()` as a selection receipt, or issue a second `Entry.focus()` request.
2. Automatic opening focus preserves the opening reason and `preventScroll: true` for both logical and Entry requests. This applies to the first opening, subsequent openings, and the first mounted acquisition of an accepted opening that has not yet been consumed.
3. The scroll intent is to keep the current host scroll position during acquisition. In supported Web hosts, a newly materialized renderer-owned Portal must not cause native entry-focus scrolling toward its temporary normal-flow position before anchored positioning is projected. Layout changes, independent scroll clamping, explicit user scrolling and later navigation retain their owners; this does not freeze scrolling or make an offscreen programmatic anchor visible.
4. Opening consumption is independent of Scope boundary activity. Unchanged accepted-open props, descendant insertion or remount after completed/canceled entry do not create another opening. A refused controlled open never enters. A still-current pending activation may survive retained view detach through Focus, which re-resolves only the current physical Entry binding without repeating logical selection or accepted acquisition.
5. Accepted logical close disables the Entry role before deactivating Scope, and cancellation occurs before a missing-mounted-view return. Verified non-Alert outside supersession deactivates only the opening's owned Scope intent before the Root close request. If a controlled owner refuses, open, Presence and Entry availability remain unchanged; unrelated props or readiness must not rearm the canceled opening. A newer independent Entry or target intent survives that cancellation.
6. Scope retains `restore: 'none'`. Accepted Close/Escape retains explicit Trigger handback and its reason; accepted outside dismissal preserves the outside destination. An old close must not restore over a synchronously accepted newer opening. The opening-only scroll policy does not overwrite later explicit focus options.

## Implementation envelope

`packages/prototypes/base/src/popover/content.proto.ts` declares a disabled Entry role, configures the one Scope's explicit fallback, and tracks whether the accepted opening has been consumed. Enable Entry before the one mounted activation. Preserve consumed state through retained unmount; reset it on accepted close. Logical close cancellation precedes the mounted-view guard. Apply current-operation/view guards around synchronously observable open, availability, Overlay and handback effects so old cleanup cannot retire a newer opening.

The generic Focus/Compiler implementations independently realize the shared definitions. Public Content does not inspect private FocusCenter members, add a ready/cancel facade, own DOM focus, copy native sampling policy, or introduce a page focus workaround. Family recipes and original native interaction assertions retain their separate scope.

## Evidence and acceptance

`T-POPOVER-OPENING-ENTRY-0001` maps direct consumer behavior to the existing `popover-entry-focus-scroll.test.ts` suite and dismissal compatibility. Source-host tests observe actual Runtime/Focus/Web focus effects and options. Mixed-content cases preserve the logical target over an earlier native link; selected pending/rejected logical acquisition never falls through. Native-only and empty/staged cases distinguish descendant/self fallback from extra acquisition after insertion. Controlled host readiness exercises retained pending entry, detached close, current-view replacement and refusal cancellation. Existing family/Date Picker, explicit focus options, Close/Escape and outside destinations remain controls. Happy DOM and controlled host effects do not establish browser scrolling, geometry or native input. New mapping states remain planned until the parent executes the exact source.

Keep both existing official browser journeys, their physical pointer/Close interactions, 15-second action timeout, root-text scaling, typography/density assertions and failure capture unchanged. The clean exact-commit four-runtime light/dark matrices for Shadcn command density and Neo Title must retain public DOM timeline receipts. For the previously failing React/Vue opens, inspect samples before and at entry `focusin`: document scrolling must no longer jump to the temporary static Portal; inspect subsequent fixed placement and require the original final Close click to succeed without force or Escape substitution. Also compare the first root16 open in all runtimes, where the baseline exhibited the same scroll mechanism despite the final journey passing.

A normal final Close click may scroll an oversized panel internally to reveal the target; that is separate from opening-entry document scroll preservation. The Neo narrow case must not be weakened to ban valid internal scrolling or hide an inaccessible target.

Do not treat a source-green patch as native acceptance. Retain failed baselines and report any unsupported host, observer loss or changed trajectory. Full Popover lifecycle/catalog, GPUI, paired upstream fidelity and Finf completion remain separate.

## Observed motivation (non-normative)

Official `3f7a` public DOM timelines show React/Vue opening a new static panel at the end of the document, focusing its Close, jumping the document scroll position before fixed positioning appears, and then anchoring the fixed panel to the now-offscreen Trigger. WC/Vue2 reuse already-positioned panel nodes on reopen; their initial opens still show the same temporary static-focus scroll. These observations justify testing the narrow opening policy; they do not expand it into an Adapter or general positioning redesign.
