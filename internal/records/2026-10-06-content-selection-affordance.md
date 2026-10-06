# Content-selection affordance first slice

Observed 2026-10-06 against main `25c3d0731e39003d87f541afc5e1a294a9d95568`. Tracking: [selection #865](https://github.com/Proto-UI/Proto-UI/issues/865), [complete HIG audit #864](https://github.com/Proto-UI/Proto-UI/issues/864).

## Source and decision

The maintainer requested an explicit standard and a Proto expression for text selectability. Apple [Labels](https://developer.apple.com/design/human-interface-guidelines/labels) and [Text views](https://developer.apple.com/design/human-interface-guidelines/text-views) recommend preserving useful copyable text. [CSS UI content selection](https://www.w3.org/TR/css-ui-4/#content-selection) supports targeted suppression where accidental selection interferes with the intended action, while warning against broad page-level restrictions. Apple [Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection) and the [ARIA keyboard guide](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_focus_vs_selection) describe a different focus/item-selection concern. Sources accessed 2026-10-06.

HIG is comparison material, not an automatic source of Proto UI obligations. The selection decision follows the maintainer’s request, useful-content copyability, action-label error prevention, and existing Proto ownership boundaries. The Apple references support that comparison alongside Web standards. This slice does not import Apple visual styling or point-size rules into Base.

The existing `select-none` utility was implemented under a Feedback contract whose wording allowed visual changes only. Selection suppression actually changes host interaction. This slice therefore states an explicit, narrow exception in the normative Feedback contract and introduces the draft `C-CONTENT-SELECTION-AFFORDANCE-0001`; it does not rename the effect to avoid that boundary. No new editor state, selection range, activation owner or selection API is introduced. Existing style contribution/patch ownership remains unchanged.

## Compatibility

- Existing single `select-none` keeps its behavior and gains WebKit-prefixed CSS.
- `select-auto` restores the host's default policy; under a suppressing ancestor that is not necessarily selectable. `select-text` explicitly restores selection.
- The three tokens now share a group, so later contributions replace earlier conflicting ones. Previously they occupied separate fallback groups and `select-auto`/`select-text` lacked compiler support. This is an intentional bounded merge-version change, not a claim of byte-identical output.
- `selection:*` paint remains separate. Useful passive content and native editors retain their current policies. No Surface, Text, Dialog-content or page-root suppression is added.
- GPUI's existing unmapped-property diagnostics remain authoritative. Generating CSS declarations is not proof of native selection support.

## First implementation and remaining work

Core grouping, CLI CSS closure and explicit Shadcn Toggle/Checkbox Root action policies are the first slice. Button, tabs triggers and menu/select items already have explicit suppression. This is not a claim that every operation surface has been independently verified.

The homepage's visible checkbox text is a separate box, while the control contains a screen-reader text copy. The catalog explicitly admits only Root and Indicator; there is no current reusable Label association. A separately reviewed draft Label slice must govern association, activation, naming, disabled behavior, nested interactive descendants and lifecycle before the website consumes it. This first slice leaves that visible-label defect open and does not simulate a Label with CSS.

Focused tests distinguish token generation from actual input. Initial Core and CLI tests failed for the intended missing merge/closure. Prototype tests initially failed to collect because this new worktree lacked links to already-installed workspace dependencies; that setup failure is not a reproduced product defect. After restoring workspace links, reverting only the two Prototype source files to the baseline produced the intended two selection-policy failures (12 other tests passed). Restoring the candidate passed the four focused files (50 tests); Feedback module patch/suppress/clearPatch coverage adds six passing tests. Browser drag/copy, cross-boundary ranges, nested restoration, four-Adapter parity, IME, actual candidate screenshots and independent review remain explicit evidence debt until separately executed. Native Apple platforms have not been tested.

The new actual-input browser journey is in the already registered homepage suite. Its first local attempt reached the localhost application with HTTP 200 but Chromium failed at socket creation with EPERM before any browser case ran. This is a host execution limitation, not a pass or component failure. The official CI browser lane must execute the candidate and provide actual revision-bound captures. The fixture resets selection inside its current target to avoid closing Dialog through outside press, and uses the native select-all shortcut for wrapped editor values.
