# Field native editor ownership oracle

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Bound failure and authority

PR #872 source `0a3fac594103bf1c6fd60fa511ace2e733adb97c`, tree `4ccae218a71bb26c65bbd86632dddb4c79f5eeeb`, was tested by [main CI run 37743002077](https://github.com/Proto-UI/Proto-UI/actions/runs/37743002077) as merge commit `0c2e667957e44abb78408b1d0c37a6b1794b67da` with the same tree. Job `113199024125`, artifact `11535825321`, has fifteen Field failures before editing: five families times React/Vue/Vue2 reported required editor count 0 despite six real inputs in each failure artifact. Those are retained red native results, not candidate passes.

Draft `C-FIELD-0001-ANATOMY` and `C-FIELD-0001-RELATIONS` require one owned editor and exact label/help/error relationships. `demo-renderer.ts` puts `data-demo-ref` on the adapted host; text-control makes that host the input in React/Vue/Vue2. WC keeps a descendant input. The old descendant-only lookup excluded the valid direct-host shape.

## Bounded correction

The native test now locates an input that is either the authored Control itself or its descendant, within the current previewer's `.host`. Before the journey, each of all six examples must have exactly one Control and one editor; the editor's nearest authored ref, across a shadow boundary where needed, must be that Control. Missing, duplicate and nested foreign ownership remain failures. No page-wide editor fallback, first-match selection, relation assertion removal or application code change is included.

## Evidence and remaining work

- Same exported selector exercised with direct input fixtures: old lookup failed 3 cases; 9 positive/negative controls passed. Fixed lookup passes all 12 cases, including duplicate owners, missing/multiple editors, unrelated and nested foreign editors, and shadow ownership.
- Focused source tests: Base Field 24; four Web adapters 140; oracle 12; initial cancellation consumer diagnostics 4. Total 180 passed. These are synthetic DOM evidence, not native input, paint, accessibility or optical acceptance.
- Native journey retains its label focus, IDREF, editing, controlled validity, readOnly/disabled, async, dark/narrow and trusted-input checks. The runtime test plan already collects the suite.
- Exact-head official native execution and broader type checks remain pending at this increment. Liquid WC cancellation is independently red and is not fixed or closed by this selector correction.
