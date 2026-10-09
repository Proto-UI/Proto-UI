# Quickstart initial fragment and application ownership: acceptance split candidate

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and evidence

PR #872, source `8e8c4ca21801378c11ea055f8f39796f86eeeda6`, tree `821fb3649a6c3c454807a11137dbd3b206117e7a`. This candidate changes the website evidence fixture, not product focus behavior. Adoption requires independent review and native execution on the integrated source. The former 18-case result remains 16 passing / 2 final-focus failures. It is not retroactively a product pass.

The original ownership fixture navigates to `/zh-cn/start-here/quick-start/#_top` with `waitUntil: 'commit'`, holds every external script, waits for a visible code `pre`, and acquires focus and Selection. The document is interactive but initial fragment processing is unfinished (`:target` is null). Holding deferred module requests also holds DOMContentLoaded. Waiting for fragment completion without changing that gate would deadlock.

The source-bound native traces establish separate boundaries:

- Menu: native summary → real enhanced button focusin at 1384.9ms; DOMContentLoaded at 1445.8ms still owns that button; at 1447.5ms `:target` becomes `_top` and a focusout moves to body.
- Link: DOMContentLoaded at 1479ms still owns the same enhanced native anchor; at 1481.3ms fragment target appears and focus moves to body.
- Zero-application control: all 70 requested external scripts empty, eight enforced inline CSP violations, no Menu/Typography/Code enhancement. Trusted forward Tab reaches the link in three presses and menu in six. Range setup preserves that acquired focus. The same DCL → fragment → body transition remains. Node identity and Selection survive.

These observations identify native initial navigation, rather than an application focus call or failed keyboard acquisition, as the final-loss boundary. They do not make the early-input user experience ideal, prove every browser identical, or authorize changing native fragment semantics.

## Candidate acceptance split

The main native suite has 20 cases instead of 18. Its paint, font, geometry, cold/reload, Apple shortcut and no-JavaScript cases are unchanged.

1. Two early-native cases keep the original full-script gate, URL, initial focus/Range and final endpoint. They strictly verify Header fallback→enhanced-button handoff (or unchanged link ownership) through DOMContentLoaded, retained code/Text/Selection, then classify the subsequent first blur only when it coincides with `_top` becoming the native target and no application focus/blur call intervenes. Extra pre-DCL link blur, repeated menu blur, missing handoff, lost Selection and missing DCL are rejected. Final focus remains false, explicitly recorded as `endToEndEarlyInputDebt` with `productFixClaimed: false`.
2. Two settled-runtime cases hold only the actual lazy `react-runtime.ts` import used by `prepareDemoRuntime`. Static document scripts, the real eager Header bootstrap, DOMContentLoaded and the same initial fragment finish naturally. The gate must observe actual matching requests; Code/Typography must still be unenhanced. A trusted pointer click on verified non-interactive Header padding chooses a sequential starting point, then bounded forward Tab acquires the actual button/link. This is mixed pointer/keyboard input, not a fresh-document keyboard-only claim. A native Range is then established without a focus call. Releasing the real runtime must preserve the exact code/Text/Selection and focus through all remaining enhancement, with no intermediate focusout.

The settled case explicitly does not cover fallback→button handoff: that eager Header transition belongs to the early case. No new product lazy boundary, hash removal, response rewrite, sleep, synthetic keyboard event or post-release focus restoration is introduced. The original four zero-application controls remain separate and unchanged.

## Remaining debt and verification

Early input before native initial-fragment completion can still lose focus. This candidate separates responsibility and verification; it does not claim to fix that end-to-end experience. A stronger product promise would require a separately reviewed navigation policy, not a fixture focus write. No-JavaScript system-light still renders the shipped fixed-dark SSR; existing evidence honestly reports that light-coverage gap. It is unrelated to this focus boundary and remains open.

Local browser socket creation is prohibited in this executor; no workaround or native pass is claimed. Native testing must confirm the exact lazy gate resolves, the trusted Header pointer/Tab journey works at the real fragment position, all 20 split assertions pass, and the four unchanged native controls still expose early-input debt. Retain every JSON/PNG and the old red artifact. Source checks and native evidence are distinct.

Local verification: four directly affected source suites passed, 62 tests; standalone strict TypeScript for the gate/classifier passed. An expanded run including the unchanged Typography suite produced 87 passed / 7 failures in Vue 2 runtime loading (`Vue.extend` unavailable); that is not reported as a pass. A broad root `tsc --noEmit` also failed on workspace/consumer-smoke dependency/generated-source gaps, with no diagnostic in the modified Quickstart files. Full project type/build/native acceptance remains pending. Prettier and whitespace checks are required before commit.

Original hosted receipt: https://github.com/Proto-UI/Proto-UI/actions/runs/37816157884 (job 113445212783, artifact 11566219840, archive SHA-256 `7f8916b7e885d6af085fe4d42b1f95fa6753bf6a09ff0682dbc5b6c169905644`).
