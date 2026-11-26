# Finf Overlay scrollbar geometry diagnosis

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

The current owner request includes Overlay coordinate drift related to scrollbars. No additional screenshot is required to begin; the bounded entry points are the existing public homepage Select and Dialog. This topic starts from main `25c3d0731e39003d87f541afc5e1a294a9d95568` and is intended for the single Finf integration PR, not another independent PR. No product fix or cause is claimed in this first evidence increment.

Authority remains draft: `C-ANCHORED-POSITIONING-0001-C/D/E/F/G`, `HC-ANCHORED-POSITION-0001` and `HC-OVERLAY-MODAL-0001-A`. The host owns geometry/collision/observation; Overlay owns active lease and modal resource lifetime. Existing simulated-DOM tests do not certify native layout. A fixed padding or offset is not an acceptable substitute for diagnosis.

The added native probe uses real public components through WC, React, Vue and Vue 2, in LTR and RTL. It explicitly controls root overflow/gutter and an existing showcase scroll ancestor; it does not inject rectangles or replace components. Select captures no-scrollbar, classic-scrollbar, restored, nested-before and nested-after states on the same open instance, with anchor/floating rectangles, actual scrollbar width, viewport offsets, physical body padding, resolved placement and portal context. Horizontal error accounts for the existing 10px viewport collision padding, rather than classifying a normal collision shift as a failure. The classic-scrollbar and actual nested-scroll preconditions are checked separately from product assertions. Dialog records lock/unlock with automatic and stable gutters, preserving body inline style restoration and measuring the trigger rectangle before and during lock.

Local validation: workspace types and isolated new-probe TypeScript passed; runtime runner/discovery contracts passed 120/120. Vitest collection finds 16 named scenarios without running a browser. The suite is explicitly included in the normal browser inventory. Actual native execution remains pending the Finf source-bound CI run; local browser execution remains unavailable under the already-established socket restriction. A failure due to a missing selector, initialization or absent classic-scrollbar precondition must be classified separately from a geometry violation. Archive original measurements and PNGs before any repair.

## Repair increment · 2026-11-06 · body-owned scroller observation (issue #1163)

Agent: OpusIssue1163 · ModelTrace: not measured — no authenticated model identity is claimed.
This role declaration is not permission, independent review, or acceptance.

Root cause (source-bound). `observeRootSpace`
(`packages/modules/positioning/src/web/root-space-observer.ts`) previously read only the
document element and observed only the document element. When the page scroller is `body`
(root overflow hidden, body overflow scroll), a classic gutter that appears or disappears
changes only body's inline box: root `clientWidth`, `clientLeft`, border-box width and
origin all stay identical. The installed `@floating-ui/dom@1.8.0` `autoUpdate` adds only
`scroll` listeners on overflow ancestors (elements do not emit `resize`), and its
`observeMove` IntersectionObserver only refreshes while the intersection ratio changes, so
a fully visible anchor that merely translates does not retrigger it. A fixed-position
anchored overlay therefore stayed stale by exactly the gutter width. The earlier
"retained root gutter" test covered only the root-owned case; the body-owned case had no
observation at all.

Repair. The shared per-document root-space tracker now also measures body (`clientWidth`
and border-box origin) and observes body with the same shared `ResizeObserver` plus the
same `dir`/`style`/`class` `MutationObserver` filter used for the root. No new observer
instance, no frame polling, no per-lease cost; the listener set, change-detection gate,
error-surfacing policy and dispose semantics are unchanged. Because both the floating-ui
anchored lease and the available-space tracker consume `observeRootSpace`, one repair
closes the drift for both.

Regression coverage added in `packages/modules/positioning/test/root-space-observer.test.ts`:
the fixture now models a body-owned gutter (`clientWidth` and border-box origin on body),
and four scenarios pin the contract: body is observed alongside the root; a body-owned
gutter change notifies while every root measurement stays fixed; an origin-only body shift
(RTL-side gutter) notifies without a width change; and a body inline-style mutation with no
root attribute change still delivers exactly one notification.

Not run here (per assignment): no build, test, lint, typecheck or CI was executed. Native
browser evidence across the four runtimes and the boundary matrix (nested scroller, modal
lock, portal/container, RTL, zoom/transform, resize) remains owed by the existing
`overlay-scrollbar-geometry.browser.test.ts` suite and its body-scroller scenario.
