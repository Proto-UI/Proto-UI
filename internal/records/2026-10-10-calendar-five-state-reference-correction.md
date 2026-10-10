# Calendar: five-state reference correction after the fifth freeze

Date: 2026-10-10 UTC. Parent/source baseline: `c2cbb8d6fce71e949f84f0358189184783505989`. Separate successor branch: `finf/calendar-variable-weeks`. No frozen snapshot is rewritten.

## What the images and fixed reference actually establish

All five owner-provided 09:36 images were viewed: October rest, month popup, year popup, November 7 focus-only, November 7 selected-and-focused. They show October/November 2026 with five weeks, Chinese short-month caption labels with English weekday headers, and a visible ring coexisting with selected fill. They do not establish that every month has five weeks or that CSS cell size should be enlarged to account for screenshot/browser zoom.

The read-only Shadcn base-nova registry is <https://ui.shadcn.com/r/styles/base-nova/calendar.json>, SHA256 `cc9ff16599d1664cec2d6a91ba82d0927953d8eedd51a7d56bba48a6522c28eb`. The reference page is <https://ui.shadcn.com/docs/components/base/calendar>. Its Calendar implementation is react-day-picker, despite appearing on the Base UI documentation page. The registry and demo do not pass `fixedWeeks`; the inspected actual page contains 101 years, 1926–2026. Its dependency says `react-day-picker@latest`; this record does not invent a deployed resolved version. The official day button's ring uses parent day `focused=true`, not only `focus-visible`. Its month dropdown formatter calls host-locale `toLocaleString(locale?.code, {month:'short'})`; the default weekday language belongs to a different boundary. The saved sources were inspected, not run.

The fifth source already implemented real family Select composition, weekday atoms, local-clock today, 28px Shadcn days/navigation, Lucide left/right chevrons, outside-muted and independent selected styling. Repeating those old missing-feature claims would be inaccurate. Remaining source differences were fixed 42-day display, 21-year sample, hardcoded English month names, and the Shadcn day ring's focus-visible condition.

## Definition and implementation

Before changing Base behavior, the bounded uncataloged definition was written at `internal/contracts/prototype-base/calendar-month-extent.v0.md`. Calendar has no applicable catalog entity yet. Related existing definitions retain their real status: `C-AS-HOOK-0007`, `M-A11Y-0001`, `M-FOCUS-0001`, and `M-CONTEXT-0001` are draft; `A-WEB-COMPONENT-0001` is active. This does not activate Calendar or settle the separate draft Base/asButton discussion.

- `monthDays(month, weekStartsOn, fixedWeeks=false)` now computes the smallest whole-week date range covering the month. Four/five/six are Gregorian arithmetic, with explicit `fixedWeeks=true` retaining six-week compatibility.
- Root adds `fixedWeeks` and numeric exposed/captured `weekCount`. Controlled month rejection retains the prior range and focus; acceptance owns the new range. Existing availability, pending-navigation and disabled rules remain.
- Optional Row `index` identifies the week semantically, without DOM position inspection. Unused indexed Rows and unused offset Days expose/capture `hidden`, declare portable A11y hidden plus existing hidden style feedback. Hidden Days are disabled, unselected and not focusable/selectable. Explicit valid dates and unindexed application-authored rows remain supported.
- The demo may retain 42 mounted capacity cells. It supplies row indices and displays 28/35/42 semantic cells; collection capacity is not visible count.
- Shadcn day ring keys to existing actual `focused`, independently of selected. Selected primary foreground still wins over inherited outside text muting; disabled opacity still applies. Other family recipes are not homogenized.
- `createCalendarDemo(family, {captionLocale})` formats short month labels at the host boundary, independently of the explicit English Calendar weekday/date locale. Missing captionLocale uses host Intl defaults; zh-CN composes the owner's Chinese-month/English-weekday example without changing Base locale.
- Shadcn restores all 101 years current-minus-100 through current. Other families' ±10-year samples are explicitly application choices, not claimed upstream fidelity. Complete controlled records and public caption binding remain; no owned ARIA attribute patch, internal Select context, native select shell or shared owner change was introduced.

The default `monthDays` length changes from always 42 to variable. This is a visible WIP behavior correction; callers requiring fixed extent must pass true. No new atom IDs or shared registry entries are needed. New public members are in existing Calendar/Date Picker exports; CalendarRowAsHookContract is exported through the existing calendar subpath type wildcard.

## Failing-before and passing-after evidence

The final 13-case variable-week fixture was run against the exact four original Calendar implementation files from c2cbb8d, then the candidate was restored: 11 failed / 2 passed. Failures include 35/28 versus hard 42, unavailable public hidden/weekCount, and actual focused Shadcn rule versus focus-visible. A prior first draft of the focus fixture incorrectly assumed Happy DOM's native `:focus-visible` became false for a pointer-reason request; it did not. The final test explicitly supplies the non-visible host match fact, exercising real Calendar/Focus state and recipe composition. It does not claim a real browser pointer observation.

The focused eight-file run passed 87/87, covering model arithmetic, fixed-six compatibility, hidden capacity/A11y/tab/select policy, explicit outside dates, controlled refusal and synchronous/asynchronous acceptance, old availability regressions, actual capture identities, family recipes, caption composition, and WC/React/Vue/Vue2 Calendar journeys. Website tests passed 24/24: five families × four adapters with October/November35, February28, August42 and hidden off-tab assertions, explicit locale labels, host clock cleanup and actual Shadcn 101-item keyboard open/select/close/trigger-focus behavior. Public type checks cover fixedWeeks, weekCount, Row index/hidden and Day hidden across all five families, plus actual AsHook captured state paths.

Reproduction commands (fixed installed toolchain, no downloads):

```sh
./node_modules/.bin/vitest run packages/prototypes/base/test/calendar*.test.ts packages/web-conformance/test/calendar.journey.test.ts apps/www/src/components/PrototypePreviewer/calendar-demo.test.ts packages/prototypes/base/test/finf-collection-compositions.test.ts packages/prototypes/base/test/finf-collection-projections.test.ts --maxWorkers=1 --minWorkers=1
./node_modules/.bin/tsc --noEmit -p packages/prototypes/base/test/tsconfig.calendar-public.json
```

Final post-format combined run: all 11 requested files ran and **145/145 passed** (exit 0, 80.01s). The scoped TypeScript command and `git diff --check` passed. Environment was Node 24.19.0, fixed offline pnpm 10.32.1, Vitest 2.1.9, one worker. Vue development notices remain visible. These scoped results do not stand in for full workspace, browser, packaging or native acceptance.

Before the local commit, the unconfigured `gh` read returned its login-required message. The repository-documented connected path supplied real live facts: authenticated cyjin-yl matches the existing commit identity; Proto-UI/Proto-UI is public, unarchived, default main, with current connector maintain/push and a separate collaborator permission result write. No credentials were copied, no canned gh responses used, and no external write was made. The local contributor branch/head/staged tree and normal hooks/DCO are retained.

## Performance, host and visual work still required

Actual 101-item WC Happy DOM timings using performance.now were first mount/open/select-and-restore = 1953/9058/756ms, then in the full website suite 1637/8349/973ms; the final combined run measured 1488/8154/725ms. The interaction succeeds, but this is a real large-collection cost finding. It is not browser performance evidence, and the list was not truncated to hide it. Select performance belongs to its owner.

The official popup is a native select, while this explicit composition uses the family's actual Select. Native popup pixels, scrolling and current-option visibility cannot be declared equivalent. Browser computed accessible names, scroll visibility, pointer focus, paint and geometry still need observation.

The existing CLI state-capture collection gap remains a real visual blocker. Portable hidden semantics reach host hidden/aria-hidden attributes and runtime style tokens, but final generated CSS must still preserve hidden display against styled grid/inline-flex layout. Attribute assertions are not computed layout proof. Likewise runtime focused/selected/outside tokens do not prove corresponding CSS selectors were emitted. No component-name parser exceptions or otherwise lawful Prototype simplifications were added.

Minimum remaining closure: the responsible pipeline owner verifies generated state selectors; publish/inspect fresh exact-successor Calendar screenshots for all five reference states with fixed clock/locale/viewport; test actual pointer ring plus selected fill, outside tint, 4/5/6-week geometry, compact 28px cells and Lucide16px navigation; inspect long-year-menu scroll/current visibility and accessible names. Then independently review applicable packed, compiled and native host coverage. This slice has no browser screenshot, native GPUI/Qt/Rust run, full workspace acceptance or independent approval.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
