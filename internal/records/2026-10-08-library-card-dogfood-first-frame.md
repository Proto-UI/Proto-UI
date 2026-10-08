# UI Libraries: real entry surfaces and the first frame

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

User-directed Finf #872 follow-up, based on 9ebff6ac9f9d2f4e3a0bdb4b2b875d3d6f712899. The entry gallery previously used four hand-painted miniature mockups and two lazy button Previewers inside one generic card skin. The previews did not dogfood the entry surface, and the lazy examples replaced loading text after arrival.

## Ownership and implementation

- Brutalist uses its actual Root/Header/Content/Footer Card prototypes, bounded by draft P-BRUTALIST-CARD. No new Base Card protocol is invented.
- Base, Shadcn, Bootstrap 2.3.2 and Liquid Glass compose their actual Surface and Text prototypes. P-BASE-SURFACE and its family projections own paint; the page owns content and layout. These are gallery card compositions, not claims that those packages export a Card.
- Base remains unstyled. Lucide is still an icon library with a Base carrier and real package shape factories; it is not renamed into a component family.
- Liquid Glass declares its existing optical intent but this ordinary gallery has no material provider. Both server and browser retain the opaque family fallback; visible copy states that boundary. This change does not certify optical support.
- Titles/descriptions/actions use family Text. The only navigation owners are native anchors, with separate origin/implementation links. Observed hover/focus/press facts project through actual family Surface rules. There are no stretched links, synthetic clicks, nested anchors or passive-frame tab stops.
- Astro calls createRuntimeSession on the actual Prototype, then passes feedback.style output to the existing CLI CSS renderer. This is executable source lineage, not parsing source strings or copying a token skin. The browser upgrades the same authored custom elements with AdaptToWebComponent. Props are supplied before registration and via getProps on later already-defined page arrivals. Native content/focus leases cover upgrade; cleanup releases link observers.
- The same unmodified bundled DM Sans bytes use an application-local optional face alias. A late font cannot swap the card's metrics after its first painted frame. Family font tokens still select the font; no family source or shared website font policy changes.
- The gallery is documentation's static WC enhancement, independent of the demo runtime preference. Browser journeys cover all four saved runtime preferences rather than falsely labeling this as four different adapters rendering the card.

## Evidence and remaining boundary

Focused tests compare real server and WC output for all 14 used prototypes, retained authored link identity, passive semantics, native link facts and cleanup. A negative control replaces the Shadcn source with Base and requires paint to disappear. Source coverage rejects the former fake miniatures and deferred Previewer. The canonical browser workflow binds nine journeys to the candidate SHA: delayed scripts/refresh in four saved runtime preferences and both themes, plus no-JavaScript 320px at 200% text, native keyboard focus, separate links and screenshots.

Local Astro static build succeeded (345 pages). Local browser server started, but Chromium launch failed with the sandbox's socket permission error before all nine tests; no screenshot or visual pass is claimed. Exact-candidate hosted workflow screenshots and independent visual review remain required. Root agent owns integration, publication and per-commit evidence comment. This work does not change PageFrame/TwoColumn or material/shader implementation.

Final local validation: 24 focused tests passed; canonical `check:types` passed (workspace tsc and Astro, 0 errors); static Astro build passed with 345 pages; `git diff --check` passed. A preliminary unrestricted `tsc --noEmit` was not the project gate and included unavailable consumer-smoke generated facades; that attempt was replaced by the repository's canonical check rather than suppressing its diagnostics. Browser evidence remains blocked locally and pending in hosted CI.

## Independent-review correction: browser oracle

Review identified a real deadlock in the prepared browser evidence: Playwright's screenshot helper waits for `document.fonts.ready`, while the test deliberately held font requests. No successful browser journey had been claimed. The correction uses the existing quick-start workflow's public Chromium `Page.captureScreenshot` pattern, with a bounded capture timeout. A `finally` always releases the current request gate and closes the context; failure JSON and current-frame capture retain phase, exact source, requests, fonts and observations.

The oracle now measures root, title, description and action geometry, actual typography, paint, visibility and effective ancestor opacity, and compares every distinct rAF observation through upgrade against the held first frame. A source anchor is focused before the baseline, so a legitimate primary-action focus state cannot masquerade as a flash. Reload gets its own held first-frame baseline because an optional font legitimately becoming cached between visits is distinct from swapping during one visit. Font-delay coverage requires an actual held font request and the application `Library DM Sans` face in loading state; installing a route alone is not evidence. English entry content is included in workflow triggers. These are strengthened pending browser checks, not an executed browser pass.
