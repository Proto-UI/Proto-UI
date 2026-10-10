# Calendar: localized semantics and explicit caption composition

Date: 2026-10-10 UTC. Source baseline `59218c40`, following the controlled-navigation/public-type repairs `802da90e`, `6c842970`, and `20b74ba2`. This is a source-quality follow-up, not lifecycle activation or complete Finf acceptance.

## Public definition and ownership

The owner requested Calendar quality against its own upstream references. Calendar remains a date-only, single-selection Gregorian subject. The new pure Caption group, Weekdays row and Weekday columnheaders add composition and localized semantics. They do not instantiate Select or borrow another control's internal context. The application supplies 7 weekday offsets and 42 day offsets.

- Root `today` is an explicit host-supplied civil date. Base does not read a clock or timezone. Initial month precedence is explicit month, defaultMonth, selected value/defaultValue, explicit today, then 1970-01. Updating today later does not navigate. Today is independent of selection/availability and projects `aria-current=date`.
- Root `locale` formats full civil-date accessible names, localized month/year Heading text and short/long weekday labels in a fixed UTC date-formatting boundary; invalid locale falls back to English. `weekStartsOn` determines both labels and date order. Default English short weekday labels are two letters.
- Root `direction` mirrors horizontal date navigation; Up/Down, Home/End and PageUp/PageDown retain their logical meanings. Styled families consume the same direction fact. Root disabled policy, accepted/refused month ownership and focus-preservation behavior are retained.
- Day owns hover/pressed facts, resetting on cancel, leave, disable, date reassignment and unmount. Navigation accepts explicit `a11yLabel` so decorative chevrons are not its accessible name.
- `bindCalendarCaption` is an explicitly named app-side composition helper over public month/disabled get+subscribe handles and requestMonth. Targets are controlled month/year controls. Returned true means a request was emitted, not owner acceptance. Refusal/pending/synchronous/redirected acceptance always resynchronize canonical values; dispose owns its subscriptions. No framework, host clock, DOM or Select protocol is added to Base.
- Five demos compose real family Select controls through that helper. The demo owns an explicit bounded year range, local date initialization, midnight/visibility refresh, complete controlled prop records and host-side Select trigger naming. This is not an internal Calendar caption-dropdown API or a claimed range-selection/multi-month feature.

These public semantics are documented in the Calendar pages; no catalog lifecycle is promoted. Existing Calendar/Button composition and its draft dependency discussion are not reinterpreted in this slice.

## Family reference boundaries

The Shadcn Base UI documentation page uses the `base-nova` preset and a react-day-picker implementation. The read-only registry snapshot from `https://ui.shadcn.com/r/styles/base-nova/calendar.json` has SHA256 `cc9ff16599d1664cec2d6a91ba82d0927953d8eedd51a7d56bba48a6522c28eb`. Shadcn's compact recipe uses 28px days/navigation, p2 and a 3px half-opacity focus ring. The optional outer demo border is not imposed on the Calendar Root. Neo independently follows `neobrutalism-components` commit `3306a802724874a85f93079702b2795370a279d4`: 36px dates, 28px navigation, 2px borders and root hard shadow. Existing family third-party notices apply; reference source was inspected, not executed.

Bootstrap 2.3.2 has no official Calendar. Its projection is explicitly an extension of that version's button/form/table language. Liquid is Apple-inspired material intent with a separate opaque fallback, not an official one-to-one Apple Calendar implementation. Neither family is described as a faithful upstream Calendar port.

## Facts established and limits

- A focused-enabled Space selection negative control was 8 pass/1 fail: selection used the trigger route but did not suppress page scrolling. Calendar Day now requests portable default-action prevention for Space, preserving Enter/Space trigger selection and leaving unfocused/disabled keys alone.
- Actual WC behavior covers localized weekday/date/heading output, week start changes, today versus selected/unavailable, civil-clock initial precedence, invalid input safety, RTL navigation, semantic grouping/names and transient-state resets.
- A four-Web journey uses the actual preview renderer and WC/React/Vue/Vue2 adapters: rejected PageDown keeps October 31 as the only Tab entry; accepted canonical month materializes/focuses November 30; both navigation controls follow owner disabled and accessible names/date semantics are projected.
- Caption tests include real WC Calendar and two real Base Select roots, plus rejection, delayed acceptance, redirection, invalid values, disabled policy, subscription teardown and reentry. Public compile-only negative controls cover the new atoms across five families and actual capture tests verify names/paths rather than asserting equality with possibly-wrong Base declarations.
- Runtime family recipe tests inspect real ten-atom compositions, slots, inherited semantics and distinct Shadcn/Neo dimensions. These are Happy DOM protocol/style-token facts, not browser layout or pixel evidence.

A real demo probe also found that initializing 201 actual Select year Items took over 20 seconds, while 11 took under one second. The demo uses an explicitly bounded 21-year option list; this avoids an unresponsive example but does not establish large-collection Select performance. No Select implementation was changed.

Final combined focused run: 129/129 tests across ten files passed, including 22 website demo tests (five families × four Web adapters, clock cleanup, plus a real Shadcn year-menu ArrowDown/Enter/open/selection/close/trigger-focus journey). Calendar semantics, prior controlled-owner regressions, caption composition, actual capture paths, family recipes, four-Web Calendar journey, and the existing Group C composition/projection suites were run together. Vue development notices remain visible, not suppressed. One added disabled-Space fixture initially left an unrelated synthetic keydown pending; the fixture now tests disabled policy before that deliberately unfocused event and passes without weakening its unchanged-value assertion.

The reproducible focused TypeScript check passed after formatting: `tsc --noEmit -p packages/prototypes/base/test/tsconfig.calendar-public.json`. `git diff --check` passed. These are scoped checks, not a new workspace/native/compiled/packed acceptance report.

## Real generated-CSS blocker and minimal remaining closure

The lawful captured states used by these Prototypes reach the runtime style lowerer. The existing CLI static collector lacks general provenance for inherited Calendar captures and nested navigation Button captures. On this checkout, the observed runtime-vs-collected token gaps are 19/15/26/20 for Shadcn/Neo/Bootstrap/Liquid respectively, preserved in `2026-10-10-calendar-family-style-blockers.json`. Examples include selected background, today/not-selected background, disabled, focused ring and direction. This is a real CSS missing-output failure, not a reason to constrain Prototype semantics or add component-name parser special cases. The owner explicitly paused our changes to Compiler/CLI semantic interpretation and this slice does not edit them.

The evidence JSON records this checkout's CSS vocabulary too. Integration separately reports direction-ltr/rtl and z-10 already supported in its later shared tree; arbitrary `bg-[#f5f5f5]` remains a resource-mapping gap there. Those updates do not resolve the missing state selectors.

The remaining minimum acceptance work is concrete:

1. The responsible Compiler/CLI owner resolves lawful capture interpretation and demonstrates all runtime-required state selectors in actual generated document and Shadow CSS, preserving unsupported diagnostics. Our source must not be rewritten to suit a parser whitelist.
2. Against a frozen exact commit with valid generated CSS, run browser layouts/screenshots and interaction states: Shadcn 28px and Neo 36px date cells; month/year open/select/keyboard/close; selected+today/outside/disabled/focus states; RTL; narrow layout. Compare each with its declared reference, independently review remaining differences, and retain fresh evidence rather than recycling old screenshots.
3. Verify packaged/public entry and compiled consumption through the separately owned pipelines; this slice's Happy DOM results do not prove compiled or packed parity.
4. Run applicable native GPUI/Qt behavior/materialization tests when the supported toolchain/host is available, keeping unsupported prerequisites explicit. No native test or Rust build was run here.
5. Integrate the new 15 family atoms and public helper through the shared entry/registry owner using the sibling manifest, then re-run on the actual combined source. No global registry, package manifest or generated CSS was edited in this slice.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
