# Liquid Card no-script native input harness

Base: `884651a68b4579b0c0c5a2c5307cdd5c49d58186`, tree `6ac3af6200331c4706751a48b6fd30c36c780f14`. This changes evidence code and its workflow only; no product layout, material, shader, threshold or runtime changes are included.

## Observed failure and primary-source contract

Official run [37960629217](https://github.com/Proto-UI/Proto-UI/actions/runs/37960629217), artifact 11630859616, retained eight passing optical cases and two failing 320px/200% text no-script cases. The en Card was 2,566px tall at document position 11,025px in a 900px viewport. Before/after rectangles and ancestors were identical, fonts were loaded, no animations were reported, scrollY was zero and a separately bounded 250ms rAF probe received no callback. These facts do not establish continuous geometry stability or a CSS animation bug.

The locked Playwright version is 1.58.2. Its [DOM action implementation](https://github.com/microsoft/playwright/blob/v1.58.2/packages/playwright-core/src/server/dom.ts#L194-L208) waits for stability before requesting scrolling. The [injected stability implementation](https://github.com/microsoft/playwright/blob/v1.58.2/packages/injected/src/injectedScript.ts#L608-L651) advances its geometry checks through requestAnimationFrame. This identifies a credible harness dependency on the frame scheduler observed not to advance; it does not claim all no-script browsers always suppress that scheduler.

Official [scrolling guidance](https://playwright.dev/docs/input#scrolling) supports mouse-wheel input. The [wheel API](https://playwright.dev/docs/api/class-mouse#mouse-wheel) explicitly does not await scroll completion. In the pinned [Chromium input implementation](https://github.com/microsoft/playwright/blob/v1.58.2/packages/playwright-core/src/server/chromium/crInput.ts#L145-L154), wheel input dispatches a protocol mouse-wheel event without the injected stability loop. No new third-party source is executed by this change.

## Replacement acceptance path

JavaScript remains disabled. The original readability, text scaling, six action links, absence of nested anchors, absent optical quality and exact native navigation assertions remain. The existing action link is scrolled with actual wheel input, with at most 40 wheel events and a 30-second reveal budget. Three matching host-clock samples separated by at least 50ms establish bounded observed geometry stability; they are expressly not page animation frames.

The link must be connected, visible, finite, positive-sized and fully inside the real viewport. The precise center must hit that anchor or its descendant through elementFromPoint. A stable fixed header obstruction fails. The target href must equal the expected same-origin route, have no download attribute and stay in the current browsing context. The taller Card need not fit the viewport.

The primary image is the actual uncropped viewport captured through the existing CDP capture helper, retaining the header as rendered. It neither invokes locator screenshot scrolling nor captures beyond the viewport. After capture and pointer movement, geometry and hit testing are checked again before native mouse down/up. Press-time invalidation fails and releases the button. A rejected or timed-out press may already have reached the browser, so cleanup attempts release immediately and once more if a pending press completes later; no late press or scroll is started. A release failure cannot replace an original observation failure. No forced click, synthetic DOM click, header hiding, page-JavaScript enablement or security setting change is used.

Two new native controls accompany the original ten cases: a long no-script self-owned page must scroll and navigate through its real link while its script sentinel remains unset; a link under a real fixed header must be rejected without navigation. The workflow strictly requires all twelve cases, retains failures and keeps the same read-only permissions, pinned checkout and timeouts.

## Verification and limits

New host-side controls cover reachability, repeated geometry jitter, wheel caps, hung reads and late completion, fixed-header hit rejection, oversized actions, wrong destinations, malformed geometry, pointer movement, press-time obstruction, falsy primary errors and secondary release errors. The existing diagnostic test first failed because it explicitly pinned the removed rAF-dependent scroll call; that failure is retained, then the assertion was updated to the verified-wheel entrypoint while preserving the other diagnostic boundaries.

The local standard-sandbox Chromium launch fails before any page execution. Its log is retained; no sandbox workaround was attempted. The two new native controls and both real no-script fallback journeys require the next official exact-head run. Local tests do not prove the wheel path or pixels in a browser. The base's 8/10 result remains unchanged, and complete Finf acceptance remains 0/68. This work does not claim no-JS optical paint, full Card parity or visual parity with a reference design.

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.
