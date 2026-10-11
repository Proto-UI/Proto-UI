# Select demo intrinsic-width containment

## Scope and observed failure

This human-directed repair starts from actual source `342955e238e6a632dbc010b70aa59d1a373ce440`, tree `11effd22f7b28598e40a8fd0534879b3bebc3fd5`. It changes the two website demonstration compositions for Bootstrap 2.3.2 and Liquid Glass, not portable Select semantics or the family Button defaults. The existing browser journey remains the acceptance owner for selection, popup geometry, document overflow, 320px width, 200% text and RTL.

Official run `37946760741`, job `113874913493`, artifact `11624432482` recorded eight Text passes and sixteen Select document-overflow failures at the unchanged line-223 assertion. All sixteen artifacts bind that exact clean source. Earlier popup geometry assertions passed. At 320px and a 32px root font, Bootstrap document width was 401px and Liquid width was 433px. The demo grid had a 110px client width but an implicit column of 280.188px or 312.188px, with scroll widths 296px or 328px. Its document-space left edge of 105px plus that scroll width exactly accounts for the document right edge. Ancestors allowed visible overflow.

The likely largest intrinsic contributor is the real acceptance Button: both families use `white-space: nowrap`, while horizontal padding is `px-3` versus `px-5`. At the measured root font those two-sided paddings differ by 32px, exactly matching the observed track difference. Subtracting the family padding and two 1px borders leaves the same 230.188px contribution. This is a source-and-geometry inference, not a direct native measurement of the Button: the original failure-only collector did not retain its child facts. After horizontal scrolling, a wide child can be back inside the viewport and no longer match the generic offender predicate.

## Bounded repair

Both outer and RTL demo grids now have the existing `grid-cols-1` utility, which the pinned Tailwind compiler resolves to `repeat(1, minmax(0, 1fr))`. The outer composition allows ordinary explanatory copy to wrap anywhere. The original family Button and complete `Accept selection` label are retained. A passive span inside the Button explicitly uses `min-w-0 whitespace-normal wrap-anywhere`, so it does not inherit the Button's nowrap policy; the Button host is bounded with the existing min-width and max-width utilities. No fixed height, hidden/clipped overflow, truncated label, replacement accessible name, semantic proxy control or global Button recipe change is introduced.

This is host composition using existing DemoSpec class/box channels, not a new Material or Select protocol. Existing uncontrolled, controlled, disabled and long-label RTL examples, setup callbacks and request ownership remain unchanged.

The diagnostic collector additionally retains at most 24 matching known demo owners, with at most 16 direct children each, regardless of the generic viewport predicate. It records geometry, padding, border and computed wrapping facts only; it never reads text, values, props or URLs, scrolls, focuses or changes the page. Existing generic traversal/candidate caps remain intact, and both new limits disclose truncation.

## Validation boundary

The same eight source/compiled-CSS recipe controls fail six assertions against the exact original demo sources and pass all eight against the candidate. These verify the explicit zero-minimum tracks and wrapping declarations, not browser layout. The pinned Tailwind compiler and its actual default theme provide the utility mapping; no mocked width calculation is presented as layout evidence. The diagnostic controls retain privacy, non-mutation, bounds and primary-failure preservation. The focused group passes 29 tests, focused TypeScript passes, and eight integration suites pass 61 tests, including real four-runtime composed Select journeys and controlled acceptance behavior.

An initial new test omitted the Tailwind spacing theme and another relied on HappyDOM expanding logical padding shorthand. Those fixture setup errors were corrected by using the installed theme and explicit physical padding facts; their failed logs are retained separately. No product assertion was weakened.

The existing browser test and workflow have no changes: popup and document assertions, case count, timeout, text scale, viewport and RTL remain unchanged. Existing local Chromium startup is blocked by socket EPERM; no repeat workaround or additional browser installation is part of this repair. Native width, wrapping readability, content reachability and screenshot acceptance remain unverified for this candidate until the official exact-source workflow runs. Very narrow available content space can still make wrapping tall; this source repair does not claim a native visual-quality pass.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
