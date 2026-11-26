# Liquid hover: safe idle framing and non-mutating screenshot evidence

## Preserved failure and governing boundary

The source is `121e780faf919e0bfbd0c487eb59b7bd6b35556a`, tree `18b1672c12aad414929a94c19de697648f010bbf`, run `38723493470`. WC artifact `11968400815` and React artifact `11967522128` retain eight failing Accordion/Collapsible policy captures. The subjects are genuinely at viewport y=0.28125, not displaced between the frozen receipt and the original screenshot. Accordion needs 44px of context margin; Collapsible needs 51px. Their clipped top context is insufficient even though their subject boxes are technically inside the viewport. All eight receipts are self-optical/rendered with committed matching geometry, verified decode and observed minimum foreground contrast at least 7.65214657111995. No optical or context threshold is relaxed.

Disabled Space can scroll the document as a normal browser default. The retained trajectory is consistent with that source of the viewport change, but intermediate scroll events were not logged. The repair does not cancel Space, change disabled semantics, or infer the exact unobserved input trajectory. The earlier source-overlap and Submit-contrast failures are separate history; this crop defect does not reopen them or claim their full matrix complete.

The applicable draft authority remains `C-LIQUID-GLASS-COMMAND-INTERACTION-0001` and `T-LIQUID-GLASS-COMMAND-INTERACTION-0001`. This is test evidence acquisition, with no prototype, source-admission, renderer, Core, Runtime or Compiler change. The complete 16-case / 2,880-capture plan, all eight parts, four runtimes, both themes and both journeys remain unchanged. Original Toggle 13 and Portal journeys remain separate, unchanged evidence requirements.

## Bounded framing

Only explicit idle boundaries may request test viewport setup: `idle`, `policy-idle`, `negative-idle`, `collapse-blocked`, `reenabled-subject`, `reenabled-item`, and `reenabled-owner`. Any required movement first requires strict false values for hovered, pressed, focused and focusVisible, plus rest contact. An explicit opaque fallback with both contact and carrier exactly null is also eligible, because the original negative controls and offscreen source admission can legitimately have no carrier. Unknown or missing facts do not authorize movement.

Active hover, press, drag/held contact and keyboard focus cannot trigger automatic framing. A subject that cannot fit its unchanged required margin fails. Setup uses actual browser scrolling only where allowed, then reads new material/state/geometry observations. Base state, outward requests and document layout must remain unchanged. The original material readiness wait and a fresh verified material snapshot follow setup. Moving screenshot coordinates or reusing an old raster is not a repair.

## Implicit scrolling during screenshot acquisition

Removing the explicit scroll from readiness was insufficient. Installed Playwright 1.58.2 `Locator.screenshot()` internally calls `_waitAndScrollIntoViewIfNeeded`. A bounded offline execution of the actual initial candidate capture function reproduced an active held subject moving from y=1200 to y=276 after its raw/frozen observations; the function returned success with those mismatched observations. The regression rejects those mismatched observations.

The corrected evidence path must use actual `Page.screenshot({clip})` viewport crops, never Locator screenshot. The page API accounts for document scroll itself; adding a manual scroll offset would target the wrong pixels. No fullPage or animation-disabling option is introduced. Root and context crops retain their separate images and errors. Exact viewport, document scroll and subject geometry checks before, between and after the screenshots reject drift. Diagnostic screenshot acquisition has no scrolling capability, including after a readiness or framing failure. Offscreen active subjects retain a failure instead of being silently brought into view.

The shared test-only controller has fake-I/O regression tests for acquisition order, safe idle re-observation, active and unknown state refusal, geometry drift, offscreen crops and independently retained screenshot failures. These are bounded offline control-flow tests, not GPU or browser success.

## Evidence status

The original failed artifacts remain unchanged. Offline regression checks pass 179/179, workflow checks pass 65/65, and workspace TypeScript and Astro checks pass. These checks establish test control flow and source compatibility, not native rendering.

Fresh exact-head CI must verify the complete surrounding context and all 16 cases / 2,880 planned captures. Existing tint optical failures and preference-checkpoint failures remain separate unresolved evidence. No optical, contrast, context or input assertion is relaxed, and no new visual acceptance is claimed.
