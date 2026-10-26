# Target-alignment numerical plans (S1)

Normative detailed equations for draft `C-TARGET-ALIGNMENT-PLAN-0001`; portable initial candidate selection belongs to `P-BASE-SELECT-CONTENT-INITIAL-ALIGNMENT-INTENT`. This is an unwired source slice, not a new public host API or a completed Select. Semantic policy remains in the prototype; the platform-independent numerical utility consumes only neutral facts and explicit constraints. Hosts alone measure and apply plans.

## Source and admission

Adopted wrapper: shadcn-ui/ui f31ed81983653919dd4fe77aee4b4859f610f1dc, apps/v4/registry/new-york-v4/ui/select.tsx; dependency @radix-ui/react-select 2.2.6. Official release: https://registry.npmjs.org/@radix-ui/react-select/-/react-select-2.2.6.tgz. Tarball SHA256: 1919744b7f3098b1de3f543e63c7356b80fcbf4f01c3da1cad0f8a798ff6ba66; verified registry SHA512 integrity. Its source-map select.tsx SHA256: e49d7b4402f30d79c2f97a0c17503a0eeb159c78ef1bdfed56474071e9d0fd08. MIT source was read, not executed. Initial formulas: lines 842–978; initial normal flex layout: 1011–1032; scroll expansion: 1143–1169. This is not a migration to current Base UI.

2026-10-11 independent definition review admitted only pure initial intent and geometry functions. Disabled selected ref-order compatibility, already-open unmatched fallback and new capability-absent popper behavior were not approved. Numerical constants below are explicit prototype profile declarations, not hidden host defaults.

## Facts and requested constraints

Inputs are one immutable host-local coordinate-space sample: layout viewport, reference (trigger and value edges), paint Surface layout rectangle and insets before that Surface's visual transform, row extent/offset relative to scroll content, associated layout text edges, scrollport extents/insets and semantic content-edge flags. Frame and paint surface are distinct roles. Constraints declare margin M, minimum target-span count N, preserve-start inline overflow and opt-in scroll expansion. Source profile uses M=10, N=5. First/last flags refer to all collection records, including disabled records. They are semantic inputs, never host collection queries.

### Initial inline plan

LTR: d = text.left − surface.left; desired = value.left − d; minimum = trigger.width + trigger.left − desired.

RTL: d = surface.right − text.right; desired = viewport.width − value.right − d; minimum = trigger.width + viewport.width − trigger.right − desired.

For both, extent = max(minimum, surface.width); inset = clamp(desired, M, max(M, viewport.width − M − extent)). Return logical left/right inset and minimum inline span. Oversize content can overflow its ending edge; do not clamp both edges. RTL conversion to physical left requires final actual frame width and remains host-owned.

### Initial block plan

A = viewport.height − 2M; F = surface.borderTop + surface.paddingTop + scrollport.scrollHeight + surface.paddingBottom + surface.borderBottom; minimum = min(N × row.height, F).

T = trigger.top + trigger.height/2 − M; B = A − T; half = row.height/2; Q = surface.borderTop + surface.paddingTop + row.offset + half; R = F − Q.

If Q <= T: end pin; trailing = surface.clientHeight − scrollport.offsetTop − scrollport.height; requested height = Q + max(B, half + (atEnd ? scrollport.paddingBottom : 0) + trailing + surface.borderBottom); do not request an initial scroll write.

Otherwise: start pin; requested height = max(T, surface.borderTop + scrollport.offsetTop + (atStart ? scrollport.paddingTop : 0) + half) + R; requested scroll = Q − T + scrollport.offsetTop.

Both return margin M, minimum height, maximum height A and initial content alignment `normal`. These are requested constraints, not final used rectangles. Tiny positive viewports may produce minimum > maximum; retain this source-plan fact rather than inventing a popper fallback. Invalid physical input extents are distinct from constrained or overflowing plans.

The fixed source parses border and padding with parseInt. Exact source vectors supply normalized integer values; a host may supply fractional facts only under an explicitly adopted precision policy. The solver must not silently truncate or reinterpret the host sample. The Web binding supplies floating inline origins through the native CSSOM offset chain and widths through offsetWidth, with actual intervening horizontal scroll retained. Those offset/width facts have CSSOM integer precision; the Frame viewport origin and reference/value BCR retain their measured fractions. This excludes Surface-owned visual transforms from layout feedback and does not claim preservation of fractional floating widths rounded by offsetWidth. Painted interaction-region hit testing remains separate.

### Scroll expansion

Inputs: enabled, prior actual scroll, new actual scroll, prior requested height, minimum height, available height and start/end pin. Delta = abs(prior − new); previous height = max(minimum, requested). If enabled, delta > 0 and previous height < available: proposed = previous + delta, next = min(available, proposed). Request height=next. For end pin only, also request scroll=max(proposed−next,0) and contentAlignment=end. Otherwise no writes. The next previous-scroll sample is the supplied current **actual** scroll, not a speculative requested correction. The host must feed corrected actual readback before the next expansion; S1 does not apply or observe scrolling.

## Ownership, cancellation and remaining gates

Functions are synchronous, pure and immutable; they create no lifetime resources. Missing semantic targets produce resolver-unresolved rather than invented zero metrics. No raw host element, geometry, selection value or framework label crosses into portable state. Host lease cancellation, commit settlement, reveal, entry-focus scroll sequencing, first scroll-control correction and reopen resets require the S2/S3 binding contract and tests. They are not added by this slice.

Open work remains: real ItemText and internal frame/viewport part composition; Overlay private target binding; current-lease callbacks; four-adapter commit boundary; placement/focus/scroll ownership; local animation start; layout-versus-visual viewport policy; upstream resize/blur close, Tab/modal/outside behavior; scroll controls; controlled value mutation; www Header/settings/Homepage/Previewer/default demo/Calendar migration. Each belongs to the corresponding prototype, neutral mechanism or consumer owner. No gap is waived and no Component or Compiler/Adapter behavior is silently changed.

Agent: dot
