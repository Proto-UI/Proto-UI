# Quickstart keyboard control: establish the real starting point

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Official source and preserved evidence

At `63a8d4240d8dfc2a36f8cbab367e8a9c43f41fd7` (tree `2feebcf1159b9bf4c8dfc4edf64ef7ce587cc93b`), the original Quickstart lane still passes 16/18. Its two programmatic empty-module controls pass: an enforced inline-script CSP, empty external modules and unenhanced native owners still produce focus loss when the pending `_top` fragment completes. That establishes native fragment influence independently of application enhancement. It does not make the original two ownership failures pass.

Both keyboard controls instead fail their acquisition precondition before releasing modules. Each records 160 trusted Tab keydowns, 320 total trusted keydowns (the old driver also presses Shift), 160 focusin and 159 focusout events. Every recorded focused element has tag `a`; the final screenshot visibly focuses the sidebar's Dialog link. The trace lacks individual link identities and key modifiers. It cannot establish that the same link repeated, that the target is inaccessible, or that document completion caused this failure. The original JSON and screenshots remain unchanged failure evidence.

## Why the starting procedure changes

The old control creates a code Range and then presses Shift+Tab up to 160 times. `document.activeElement === body` does not identify the browser's sequential focus starting point. The [HTML sequential-focus model](https://html.spec.whatwg.org/multipage/interaction.html#sequential-focus-navigation) distinguishes that starting point from the active area, and defines Tab/Shift+Tab as forward/backward navigation. The observed last sidebar link is compatible with a long backwards walk; the old trace is insufficient to prove that exact itinerary.

The shipped Header source places the brand and three desktop navigation anchors before the closed native details' first summary, ahead of the sidebar and code. The summary remains the closed disclosure's native entry; links inside its closed content are different candidates. Source order and the prior programmatic captures support inspecting this short prefix, but are not proof of browser tab order or closed-shadow internals.

Only the diagnostic keyboard setup changes. It requires a fresh focused document, body as the active element and zero initial Selection ranges, then sends actual forward Tab input. It stops on the requested Header owner, a repeated node identity, focus leaving the document, or traversal beyond the Header prefix. An eight-press upper bound covers the expected short prefix; no whole-page scan or increased loop count is used. After keyboard acquisition, it creates the same native code Range and immediately requires the acquired focus to remain unchanged. The existing nonempty/exact Selection, node identity, uncompleted fragment and focus preconditions all still apply. A Range-induced blur is a setup failure with its own before/after observations; the test never restores focus to conceal it.

## New diagnostic facts

The control records actual key/code/shift state and trusted input, document focus, stable per-document node IDs, href and DOM IDs, target tabIndex and authored tabindex, geometry and computed display/visibility/opacity/content-visibility, hidden/inert ancestry and closed-details membership. The first summary and closed details content are distinguished. It records accessible open-shadow active chains, event composed paths and root provenance, while explicitly leaving inaccessible closed-shadow contents unknown. Header candidate lists are labeled DOM-order hints, not a synthesized browser tab order.

The new `keyboard-start.json` captures the native starting state before any key or injected code Range. Phase labels distinguish keyboard acquisition, Range setup and document completion. Final preconditions require exactly the observed number of trusted, unshifted Tab presses. The programmatic controls retain Range-before-programmatic-focus setup. The original 18-case browser file, its strict ownership assertions, hash, workflow and production implementation are unchanged.

## Validation boundary

Five focused source/DOM suites pass 58 tests, including 20 keyboard-driver/descriptor controls; focused TypeScript checking passes. The real descriptor is exercised with DOM fixtures for unique identities, first-summary versus closed content, and exposed shadow/hidden ancestry. These observations are deliberately not presented as native rendering or native Tab evidence. Source mutations changing forward Tab to Shift+Tab, dropping the empty-Selection precondition, or expanding the bound to 160 each fail the applicable tests. Mutated source is restored. An initial focused type check exposed an unannotated local summary type in the new descriptor; the explicit Element-or-null annotation and rerun pass.

The current executor's known Chrome socket restriction remains respected. This revision has no new native results, screenshots or claimed focus repair. A future exact-source native run must establish whether genuine keyboard acquisition survives the Range setup and how pending fragment completion affects that real user input. Only then can the original enhancement/navigation ownership boundary be reconsidered.

## QS-KEYBOARD-001 independent-review correction

Independent review of `1bad1d6b15c7f6ba5b02af6ba29be0a8cd7c1795` found that adding raw keyup observations also caused the existing counter to count each trusted Tab release. One keyboard press therefore counted twice and could not equal `keyboardSteps`. The prior 58 passing tests and type check did not cover this interaction and did not make that candidate acceptable.

The observer now increments only for a trusted KeyboardEvent with type keydown and key Tab. Keyup remains in the raw trace, and the strict equality with actual keyboard steps is unchanged. Seven new tests extract, transpile and execute the exact observer callback with explicitly injected event trust and a minimal observation-only document fixture; they do not claim browser-generated input. On the old counter they reproduce three failures: one down/up pair counts 2 rather than 1, keyup alone counts 1 rather than 0, and two presses count 4 rather than 2. The corrected observer counts each press once and retains both down/up trace entries. Untrusted, non-Tab and non-keyboard events do not increment it. All five focused suites now pass 65 tests and the focused TypeScript check passes. Original acceptance, enforced CSP, load gate and production source remain unchanged; native confirmation remains pending.
