# Dialog inner-space and retained-gutter repair

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

## Actual baseline and scope

The official fc5effc99779aca637acaa06789937cef1414cf1 matched Dialog run 37530646677 completed seven candidate journeys. Shadcn Vue2 was not offered by its public preview on either fixed 15d subject or candidate. The seven true matched pairs have identical probe closure, dev renderer, routes, fonts, DPR and browser. Their normal 390px panels gained the intended 16px inset. Original images and hashes are preserved in evidence commit 4e1ff8eda515400f5f005f3abc4cb4e0ba0b0661 and PR #872 comment 6025652606.

Visual inspection nevertheless found clipped footer content at 200% root text and CDP scale 2. Outer-panel bounds alone missed this. The next probe checks inner scroll width and all actual button rectangles, hit testing and real Tab/Shift+Tab navigation; a long localized action label is an explicitly injected text-only stress fixture. It does not inject styles or replace the component.

Ordinary browser run 37530646662, shard 7, artifact 11444377830 (ZIP SHA256 8650be3dacfbc5cecd359c4e6bbaf0a1f5b77b8b0dacb203d411743552e2af00) ran merge b4e678f591ed0459075493a1bcc6db675810ef67. All 40 Select observations had zero collision-adjusted error across four runtimes and two directions with real 15px scrollbars. Eight Dialog journeys failed at retained stable gutters: clientWidth grew 1425 to 1440, but the page still retained its gutter; adding 15px padding moved the trigger 7.5px. The old clientWidth-only unit fixture did not represent this browser distinction.

## Candidate ownership and boundary

- Modal lock intersects viewport client width with the actual root border-box width before measuring gained inline space. No fixed scrollbar width or RTL direction heuristic is used. Existing nested ownership and original padding restoration remain.
- AvailableSpace intersects its visible region with the root inline region; root observers also notice actual box width/origin changes. Unknown root-box facts withdraw the lease projection rather than becoming usable zero space.
- Shadcn Content uses a bounded single grid track; Header/Close keep bounded inline layout, and Footer intrinsically reverse-wraps actions. This differs deliberately from the pinned upstream sm media breakpoint. No Web media expression enters Base or the portable protocol.
- Reusable Shadcn Button `wrap` is opt-in and ignored for icon size. The public Dialog opts in. Default Button compatibility remains single-line. Arbitrary unbounded custom descendants remain the author's responsibility.
- Both language Dialog preview configurations offer the already supported Vue2 adapter. The historical classifier accepts precisely seven geometric failures and one source-observed unavailable entry; it still rejects generic timeouts, crashes, missing images, wrong fonts/source and unexpected successes.

## Validation checkpoint

The retained-root-box unit case fails against actual fc5 modal-lock source (7 pass, 1 fail, incorrect 15px padding) and passes the candidate. The new h-auto CSS lowering control first failed as unsupported and passes after the finite standard utility lowering. Current focused checks and exact final validation are recorded in the handoff. New native, physical keyboard/notch, and GPUI results are not claimed by these local checks. No local native browser was run because its socket launch is denied in this environment; official Actions supplies browser acceptance.

Final local checkpoint before independent review:

- Seven focused suites: 66/66 passing (modal lock 8, root observer 6, AvailableSpace 10, FloatingUI host 5, CLI CSS 32, Shadcn Button 3, Dialog 2).
- Historical baseline classifier: 10/10 passing, including explicit rejection of generic Vue2 timeouts and a preview that actually offers Vue2.
- Workspace TypeScript and isolated two-browser-probe TypeScript: passed.
- Prototype catalog, preset token generation check, lifecycle authoring against fc5effc9 and git diff whitespace check: passed.
- Source/coverage matrix checker still rejects the five pre-existing fc5 Accordion/Collapsible demo paths (missing binding and fingerprint, ten errors). Their designated owner/integrator is repairing those exact source registrations. This packet does not relax the scanner or claim that gate passed.
- No production rebuild of this final packet yet; integration must build and run the new source-bound native journeys. Previous fc5 successes are historical.

Review follow-up 4200497393 was reproduced against a791549d: without visualViewport, a measured left root origin of 15 and client width 375 yielded only 360px. The new paired default-reader test failed exactly on that width (10 pass, 1 fail). The fallback rectangle now starts at the measured root origin, so already gutter-excluding clientWidth is not inset a second time. The candidate passes all 30 cases across AvailableSpace, root observer, FloatingUI and modal lock suites. This is an explicit simulated host-metric control, not a claim that Chromium's RTL mode rendered a native left-side scrollbar in prior captures.

Production follow-through: the 332a2c2b product source built all 327 pages in 32.44 seconds with the actual production bundle-graph gate passing. The only subsequent code delta is in the native probe: 200% text and scale-2 captures wait for real descendant animations to finish before geometry/action assertions, so Button's transitions cannot yield an intermediate-frame false pass. Product code is unchanged by that evidence-only follow-up. Native acceptance still awaits the next integrated head.
