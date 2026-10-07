# Shadcn Scroll Area: continuous corner

## Request and baseline

The maintainer rejected the isolated lower-right square introduced by #779 and requested a comparison with Apple and shadcn design. This is Issue #861's bounded visual correction at baseline `20b1f06f505555b50fb9aaf4aada5be475f507b5`, after the earlier geometry and private-style prerequisites merged. The earlier records retain their historical intent and evidence. The private feedback image is not a repository asset.

The audience is a documentation reader trying both native scrolling axes and draggable custom indicators. Scrollability must remain apparent; the intersection is not a button or a status indicator. A separate muted tile and two divider strokes overstate its importance. The desired result is a continuous content surface with unobtrusive rounded indicators and a consistent outer silhouette.

## Reference comparison

Inspected 2026-10-06:

- The existing pinned [shadcn source](https://github.com/shadcn-ui/ui/blob/f31ed81983653919dd4fe77aee4b4859f610f1dc/apps/v4/registry/new-york-v4/ui/scroll-area.tsx) has an unstyled Corner. Its tracks use one-pixel padding and a transparent axis-side border, with a rounded `bg-border` Thumb. The consumer chooses the Root's frame; the Viewport inherits its radius. Current [official documentation](https://ui.shadcn.com/docs/components/scroll-area) and current official Radix source were also inspected; the documentation currently redirects to a Base UI variant. That evolving page does not replace the frozen comparison baseline or grant API equivalence.
- Apple's [Scroll views HIG](https://developer.apple.com/design/human-interface-guidelines/scroll-views) describes unobtrusive indicators, typically appearing during scrolling, and familiar gestures/keyboard behavior. [AppKit preferredScrollerStyle](https://developer.apple.com/documentation/appkit/nsscroller/preferredscrollerstyle) derives overlay or legacy presentation from preferences and input devices. These are separate presentation modes; there is no universal Apple corner tile or blur requirement to copy.

Proto UI keeps its documented deltas: the Viewport's fixed `rounded-md`, clipped Root, two-pixel transparent track borders, absolute physical edge placement and fallible composed preference. This repair does not implement upstream auto-hide, inherited radius, Radix DOM, or macOS system behavior. Existing MIT attribution in the Shadcn package remains unchanged. No third-party code is executed or new asset copied.

## Ownership and implementation

`P-BASE-SCROLL-AREA` keeps exactly Root, Viewport, Scrollbar and Thumb. The Scroll host owns `--proto-ui-scroll-track-end-inset`, actual opposite-track thickness, control measurements, endpoints and requests. That implementation is unchanged. The removed Shadcn spans were only passive paint, not layout reservations. Removing the extra rendering watcher is safe because Base already watches and projects orientation; caller slots no longer share their track with a private subtree.

`P-SHADCN-SCROLL-AREA-SCROLLBAR-CORNER` remains draft and now requires the underlying Root surface to continue through the reserved intersection without a tile or divider. The public prototype owns the correction; there is no website CSS mask. The demo adds existing `rounded-md` to its consumer-owned Root so its outline agrees with the existing Viewport, without changing content, dimensions, or adding an API. Brutalist's separate corner paint is untouched.

Generated Shadcn style and GPUI inventories are regenerated from source. The now-unemitted `height: calc(100% + 4px)` value is removed from GPUI's exact unmapped inventory, not mapped as a newly supported length. Brutalist's remaining `+ 2px` limitation stays explicit.

## Evidence

A real Web Component regression failed against baseline because the horizontal Scrollbar added the extra gray-corner spans. It now asserts no extra paint/control and stable caller slots through repeated horizontal/vertical changes and disposal. Existing Base/shared-host tests retain the measured insets, hidden/opposite-track cases, fractional geometry and drag behavior.

The source-bound Actions harness keeps both actual families and all four Web runtimes. For Shadcn it checks absent paint, transparent track backgrounds, matching Root/Viewport radii and strict non-control hit testing. It retains two-axis dragging, unchanged focus geometry, hidden tracks, fractional thickness and overflow transitions. Same-size initial and double-end light/dark captures are made for baseline and candidate. Reduced-motion and forced-color captures are distinct observations for visual inspection, not geometry-based contrast certification.

Local Chromium launch failed on a socket permission error before any page rendered. The `tsx` executable also could not create its IPC socket; its equivalent Node `--import tsx` entry runs the generator without that IPC dependency. Native screenshots, exact-head repository CI, macOS inventory validation and independent acceptance remain pending at this first publication. Source/unit evidence is not claimed as native visual acceptance. Horizontal RTL normalization remains the documented deferred host scope; this paint-only repair does not add or claim it.

## First native run

Run `37481293926` bound the source and harness to `653113dae104faa7dc90c0f725acf20d92a9a838`. Baseline capture passed. The candidate completed Brutalist's four runtimes and Shadcn WC's geometry, two-axis dragging and light/dark/reduced-motion captures before the forced-color observation failed a test assertion. Chromium returned transparent white `rgba(255, 255, 255, 0)` instead of transparent black; alpha remained zero. The harness had incorrectly compared the RGB channels of a fully transparent color. It now checks zero alpha from bounded comma/space `rgb`/`rgba` forms, retains their raw computed strings, rejects unsupported syntax rather than assuming transparency and retains the forced-color capture before its assertions. This is a harness repair, not evidence of an opaque product track or a reason to loosen the corner's absence/geometry assertions.

Both artifact ZIPs matched GitHub's SHA-256 digest. Inspected original WC baseline/candidate end-state PNGs show the tile and divider removed, matched Root/Viewport rounding, unchanged content and separated rounded Thumb endpoints. Those successful observations remain limited to the exact captured states; the remaining Shadcn runtimes, focus and actual forced-color indicator visibility require the next native run.

## Forced-color paint and native inventory repair

The next native run `37482800553` completed both subjects at `bec6ae33`, including all four Web runtimes, geometry, drag endpoints, focus, hidden/fractional tracks and preference captures. Inspection of actual forced-color PNGs nevertheless found invisible Thumbs: both background and Root were white, while the computed black border had zero width. This is an existing fill-only Thumb limitation exposed by the expanded evidence, not a passing accessibility result.

The public Shadcn Thumb now adds an ordinary transparent one-pixel border, allowing the system forced-color palette to draw its outline while keeping the host-owned border box and ordinary rounded fill. This follows [CSS Color Adjustment](https://www.w3.org/TR/2026/CR-css-color-adjust-1-20260507/#forced-colors-properties), without disabling forced color adjustment or adding page-local overrides. The token regression first failed on the unchanged Thumb. The native harness now retains its PNG/raw paint values and asserts a nonzero opaque system border distinct from the surface; actual pixels and full exact-head CI remain to inspect after this change. Normal captures retain border-box geometry and background-clip facts, and the candidate checks the unchanged six-pixel outer cross-axis size plus the existing Web host's 18px minimum at both ends; these host-local observations do not create a portable size API.

macOS CI separately caught the stale fixed array length after removing the obsolete GPUI `+ 4px` inventory entry. The literal count is corrected from eleven to the ten remaining entries. The array's values and mapping boundary are unchanged. The unrelated grammar lane timed out downloading its official Noto font package before any product test; that infrastructure failure is not a Scroll Area reproduction.

## Review reconciliation

Automated review correctly identified two omitted projections: the `T-SHADCN-SCROLL-AREA-0001` revision history still described only the earlier passive-fill addition, and the dedicated evidence workflow did not trigger on a change confined to its demo source. The test entity now appends an explicit reversal/visibility-evidence revision without rewriting the old one. Both actual Scroll Area demo paths are in the workflow filter. This follow-up changes no product rendering or input code; prior screenshots retain their exact source labels, and fresh final-head CI remains required.
