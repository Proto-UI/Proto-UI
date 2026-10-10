# Calendar month extent (v0, uncataloged slice)

This transitional Base contract covers only visible month extent. It is not an active catalog entity or a claim that Calendar has completed delivery. The current owner-directed Calendar reference correction (2026-10-10) selects this behavior before its implementation; a future catalog entry must replace this uncataloged definition rather than treating test output as semantic authority.

## Inputs, ownership and outputs

- Root owns a canonical Gregorian civil `month` (`YYYY-MM`). Controlled month requests are proposals: rejected or pending proposals do not change the visible date range, active day, or tab entry. Only canonical acceptance does.
- `weekStartsOn` rotates the start of each seven-day week. Its existing finite integer/modulo-seven normalization applies to both date cells and headers.
- Root `fixedWeeks?: boolean` defaults to false. False covers the entire month with the smallest whole number of weeks, including leading/trailing outside dates: four, five or six weeks. True explicitly chooses six weeks.
- Root exposes numeric `weekCount`, including through `asCalendarRoot` state capture. It describes the canonical month, not the collection capacity.
- Day `offset` indexes that visible range. An offset with no date is hidden, disabled, not selected, and cannot receive programmatic or sequential focus or commit selection. Day exposes/captures `hidden`. Explicit valid `date` remains an application-authored day, including outside-month dates.
- Row optional `index` is its nonnegative integer week index. Indexed rows at or beyond `weekCount` expose/capture `hidden=true`; omitted index preserves the author's explicitly managed row. No inference from host DOM position is used.

## Lifecycle and host boundary

Month, week start and fixed-week changes update the same mounted atoms. An application may retain six rows / 42 capacity cells; unused rows and cells must be absent from presentation and accessibility, not merely have empty labels. Existing portable A11y hidden state projects accessibility and host visibility; existing style feedback declares hidden display for hosts with styled layout. Disabling a hidden day and excluding it from tab participation do not depend on stylesheet generation. No DOM mutation, clock read, geometry, CSS parser exception, or component-name compiler dispatch belongs in this Base behavior.

## Independent acceptance criteria

1. Sunday-start October/November 2026 have five weeks, February 2026 four, and May 2026 six. Leap years and alternative week starts are date arithmetic, never a rule that screenshots imply all months have five weeks.
2. `fixedWeeks=true` has six weeks for every valid month; changing it updates visibility without remounting or changing the selected civil date.
3. Controlled month rejection preserves prior visible range and valid focus; synchronous/asynchronous acceptance materializes only the accepted range.
4. Hidden capacity has hidden semantics and no selection/focus entry. Visible outside dates retain their date semantics; availability still gates input.
5. Family projections inherit this behavior. Shadcn's independently selected upstream recipe keys its day ring to actual focused state, independently of selection; source declaration and real rendered CSS remain separate gates.

## Explicit limits

Calendar's full catalog definition and draft composition questions remain open. Caption month/year Select is explicit application composition through public canonical month/requestMonth, not an embedded Base Select or a native-select promise. Locale, year range and native popup appearance are separate concerns. Compiler coverage, packed generation, native hosts, actual accessible naming and exact-commit visual comparison require their own evidence.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
