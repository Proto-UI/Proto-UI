# Bound the Docs menu's startup publication

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

Scope: #872, baseline `5445b04c970f6fb46ccd871d2fbe509709c80e45`, tree `c793cb77c89ad2162783ab4607d1fe928b228768`, official Quickstart run `37769860266`. This is a Docs consumer candidate, not an Adapter change or a new public hydration guarantee.

## Observed failure and candidate

All fourteen official cold first-frame traces contain an intermediate menu/glyph sample with `visible=false`, while the menu stays 44×44 with opacity 1 and unchanged paint. Both React ownership journeys begin focused with nonempty retained code selection and finish on body without any observed selection writes. These are native failures; endpoint identity/selection alone does not discharge them.

The Header hides the prospective menu's ancestor using inherited `visibility:hidden`; the real Shadcn Button uses `transition-all`. At handoff, inherited visibility becomes visible and can start a child transition whose initial value is still hidden. This is the strongest source-backed menu hypothesis, not a native causal confirmation. The WC Adapter itself does not add `data-pui-view-pending`, so that earlier possibility was rejected.

The candidate adds one Docs-only pre-ready `display:none!important` rule to the prospective `[data-site-menu-button]`. The existing outer 44px cell still reserves layout, and the native summary remains visible and usable. Readiness removes the rule; it does not animate inherited visibility on an already rendered candidate. Homepage behavior, Prototype motion/paint, shared snapshots, Adapters, and page/selection owners are unchanged.

The CSS Transitions starting/application algorithms explain the inherited-property risk: https://drafts.csswg.org/css-transitions/#starting and https://drafts.csswg.org/css-transitions/#application . An exact-head native rerun must still establish the actual result.

## Evidence and limits

The CSS regression checks pending and ready authored states, outer 44px reservation, retained summary, and homepage exclusion. Removing only the candidate rule makes the positive pending-state assertion fail with `inline-flex` instead of `none`; restoring it passes. Happy DOM's ancestor-attribute selector cache does not reliably invalidate on dynamic changes, so these tests resolve each authored state afresh. They do not claim actual browser transition, geometry, hit-test, focus, or accessibility proof.

The original eighteen-case browser suite, routes including `#_top`, all timeouts, and every-frame visibility/geometry/paint and ownership assertions remain intact. Added diagnostics record the actually selected menu owner, computed visibility/display/transition, suppressed ancestors and active transition time. Ownership traces also capture native focus/blur call stacks, event source stacks/related targets, hidden/inert/pending ancestry, and document/fragment lifecycle events. The method wrappers pass the original receiver and arguments to the original function and retain its exact return or throw even if observation fails. Their pre-call observations avoid computed-style reads; the existing native call is neither repeated nor replaced.

Controlled wrapper tests execute the actual diagnostic block for both focus and blur, including return values, invalid receivers, exact thrown objects, and observer failures. They prove forwarding behavior, not absence of measurement timing effects in a native browser.

The desktop anchor is not moved by the inspected Header surface path; only its children are composed by native controls, and Typography excludes its native owner. The original fragment load is another mechanism to distinguish, not an established explanation. No focus restoration, fragment removal, timeout adjustment, visibility exception, or shared-helper rewrite was introduced.

## Required next gate

Run the unchanged official native suite on the integrated exact source. Require all eighteen cases, cold and refresh, plus retained native ownership. Inspect the new transition/focus/lifecycle facts if either failure persists. Native causal verification, current screenshots and broader integration remain evidence debt; no local Chromium was launched. Full build/type checks are deferred to the coordinated integration window, not reported as passing.
