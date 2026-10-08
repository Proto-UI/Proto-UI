# Capture loss: separate visual cancellation and native activation evidence

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Original result and authority

Human-assisted PR #872 continuation from head `8e8c4ca21801378c11ea055f8f39796f86eeeda6`, tree `821fb3649a6c3c454807a11137dbd3b206117e7a`. [Optical run 37816158159](https://github.com/Proto-UI/Proto-UI/actions/runs/37816158159) artifact `11567690762` has archive SHA-256 `b0615cb6fb2362da7b76d526fc8aebcdd70b5e1db2abc9db52fbd34362107973`. Both source and packed continuous runs fail `4 !== 3` after the real matching trusted down/gotcapture/lostcapture/up chain. Source contact session 5 ends with `lostcapture` before up. This is not the older pending-capture fixture problem.

The original recorder did not capture click events. The count increment alone does not directly establish native click provenance or duplicate activation. Source inspection and platform semantics explain the likely increment, but the new exact-head native run must observe those channels explicitly.

`C-FEEDBACK-MATERIAL-0001-CONTACT` is draft and specifies visual-only tracking independent of activation. Lost capture terminates the visual session; it does not authorize a new activation veto. `C-EVENT-TYPE-0002-D/E` distinguish successful activation from `press.cancel`. The Web router's lost-capture handling emits `pointer.cancel`; Button clears transient pressed/hovered state. Its existing native click route remains available. The existing Web router mapping contract tests require click to reach press.commit and reject outward CustomEvent reentry.

[Pointer Events §4.2.11–12](https://www.w3.org/TR/pointerevents3/#the-click-auxclick-and-contextmenu-events) specifies capture loss and subsequent click targeting separately. Explicit release before up does not by itself prohibit a same-target native click. The earlier zero-count expectation for the inside-release fixture conflated visual cancellation with activation cancellation. This record corrects that interpretation; it preserves the previous run and record rather than rewriting either.

## Bounded repair and discriminating evidence

No product router, material sink, shader, Prototype or activation semantics change. The fixture now runs both inside and outside releases, each requiring actual trusted got/lost capture and terminal cancellation of the same visual session. The inside release requires exactly one trusted mouse click with the matching pointer ID, positive detail and ordering after up, and exactly one public consumer callback. WC additionally requires one distinct untrusted outward CustomEvent; other adapters use their framework callback projections. The callback counter is recorded at the existing consumer boundary, not manufactured by the input driver. Custom/native event classification is recorded separately.

The outside release verifies its destination is outside every demo control before a real pointer move/up. It retains zero control activation as the negative control, requires outside pointerup, and preserves the same-session lostcapture assertion. Neither case may revive visual tracking. Native touchCancel's original count equality also remains. Existing no-product-capture and later safety assertions remain intact.

Evidence helper mutation controls reject missing/untrusted/wrong-pointer/zero-detail/duplicate native click, duplicate WC outward event, duplicate consumer callback, callback preceding click, wrong up target, stale contact, and absent or out-of-order capture. They use synthetic data and do not claim native execution. A router host-unit test separately shows no activation on capture loss/up alone, one on an injected native-shaped click, no outward CustomEvent reentry, and no contact revival.

## Verification and outstanding boundary

- Preserved red: new driver-source expectation fails against the unchanged original driver (1 failed / 20 passed); this checks the missing evidence distinction, not a product regression.
- Candidate fixture suite: 4 files / 36 tests pass. Router/contact contracts: 2 files / 26 tests pass.
- Consumer/entry TypeScript and separate helper/test TypeScript checks pass. Browser script syntax, Prettier and diff checks pass.
- Initial local runs encountered missing worktree dependency links (React, then Floating UI); those setup failures were preserved, links point to the existing shared dependencies, and the identical suites were rerun successfully. No downloaded implementation was executed.
- No new native browser execution, screenshots, source/packed builds or CI pass is claimed. Official source and packed runs must still verify this stronger driver. The prior native red and all downstream unexecuted journeys remain outstanding.
- White fallback frames are independent, still unresolved: source frames 581/593 and packed frame 586 show missing carrier with opaque-fallback/preparing. Source frame 581 precedes its touch pointercancel, so it cannot simply be attributed to the cancellation callback. No optical fix or paint acceptance is claimed here.
- Finf remains WIP, 0/68 accepted. Local commit only, using the existing cyjin.yl DCO identity and actual hooks; no push, PR comment, merge or deployment. Independent source review and exact-head native evidence remain required.
