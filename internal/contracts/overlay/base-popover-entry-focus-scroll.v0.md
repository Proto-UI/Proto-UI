# Base Popover opening-entry focus preserves host scroll

Status: proposed narrow contract for the currently uncataloged Popover behavior. This is not a claim of full Popover or cross-host acceptance.

## Authority and scope

`spec/**` remains authoritative where applicable. This contract fills the uncataloged Base Popover opening-entry policy only. It uses existing draft `C-FOCUS-0001`, `C-AS-FOCUS-SCOPE-0001`, `C-AS-FOCUS-SCOPE-0002-B/G` (existing entry-target and reason ownership), `C-AS-FOCUSABLE-0001-G`, and `HC-FOCUS-TARGET-0001`: supported hosts project the existing `preventScroll` request policy without inventing focus facts. No Focus, host capability, Adapter, Compiler, or IR definition changes are introduced.

Draft `P-BASE-DROPDOWN-MENU-CONTENT-A11Y` independently uses scroll-preserving entry requests. It is a precedent for the existing capability, not the authority for Popover semantics. Popover has no catalog entity at the proposal baseline `3f7a86759e88428c72261f5ae8ec60394f126296`.

The owner of this policy is `asPopoverContent()` in Base. Family Content projections and the existing Date Picker composition inherit that policy; they do not install another focus owner. The change does not alter their appearance, open ownership, request reasons, selection, or public API.

## Required behavior

1. When Base Popover Content automatically acquires opening-entry focus for an accepted open fact, it must request the existing Focus policy `preventScroll: true`, alongside the existing focus reason. This applies to the first opening, subsequent openings, and mounted replay already permitted by the existing lifecycle.
2. The intent is to keep the current host scroll position during that focus acquisition. In supported Web hosts, a newly materialized renderer-owned Portal must not cause native entry-focus scrolling toward its temporary normal-flow position before anchored positioning is projected. Layout changes, scroll clamping independent of focus, explicit user scrolling, and later navigation remain independently owned; this contract does not freeze scrolling or promise that an offscreen programmatic anchor becomes visible.
3. Scope member selection, request readiness/retry, target eligibility, and actual focus facts remain owned by the existing Focus pipeline. A host without support may follow the existing policy fallback; this contract adds no DOM check, timeout, private expose handshake, synthesized focus event, or new readiness barrier.
4. An unchanged accepted-open state must not acquire an extra entry focus merely because unrelated props update. A controlled open request that the owner refuses must not enter focus.
5. Close, Escape and outside-dismiss behavior and existing Trigger restoration retain their current policy. In particular, this opening-only rule must not become a global default on every focus request, must not overwrite explicit consumer focus options, and must not force focus back after outside focus.

## Implementation envelope

The intended minimal implementation adds `preventScroll: true` to the existing `focusScope.activate(...)` opening call in `packages/prototypes/base/src/popover/content.proto.ts`. Keep the one scope and the current open/mounted checks. Do not modify `packages/modules/**`, `packages/adapters/**`, Compiler/IR, family recipes, demo geometry, or any original interaction assertion to achieve this result.

## Evidence and acceptance

Source-host tests must observe the actual focus options delivered through the existing Runtime/Focus/Web host pipeline, not merely match source text. Before the production change, the new opening-policy assertion must fail for missing `preventScroll`; after it, first open and reopen must deliver `true` and preserve the existing focused target and open requests. Check controlled refusal, unchanged-open updates, explicit close/Escape restoration, outside focus, and cleanup. Run existing Popover family and Date Picker composition regressions. HappyDOM options/focus tests do not establish browser scrolling or geometry.

Keep both existing official browser journeys, their physical pointer/Close interactions, 15-second action timeout, root-text scaling, typography/density assertions and failure capture unchanged. The clean exact-commit four-runtime light/dark matrices for Shadcn command density and Neo Title must retain public DOM timeline receipts. For the previously failing React/Vue opens, inspect samples before and at entry `focusin`: document scrolling must no longer jump to the temporary static Portal; inspect subsequent fixed placement and require the original final Close click to succeed without force or Escape substitution. Also compare the first root16 open in all runtimes, where the baseline exhibited the same scroll mechanism despite the final journey passing.

A normal final Close click may scroll an oversized panel internally to reveal the target; that is separate from opening-entry document scroll preservation. The Neo narrow case must not be weakened to ban valid internal scrolling or hide an inaccessible target.

Do not treat a source-green patch as native acceptance. Retain failed baselines and report any unsupported host, observer loss or changed trajectory. Full Popover lifecycle/catalog, GPUI, paired upstream fidelity and Finf completion remain separate.

## Observed motivation (non-normative)

Official `3f7a` public DOM timelines show React/Vue opening a new static panel at the end of the document, focusing its Close, jumping the document scroll position before fixed positioning appears, and then anchoring the fixed panel to the now-offscreen Trigger. WC/Vue2 reuse already-positioned panel nodes on reopen; their initial opens still show the same temporary static-focus scroll. These observations justify testing the narrow opening policy; they do not expand it into an Adapter or general positioning redesign.
