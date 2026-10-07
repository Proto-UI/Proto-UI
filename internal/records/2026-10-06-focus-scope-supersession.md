# Target request supersession before scope admission

Date: 2026-10-06 UTC. Source parent: `c3f6561ae9ca36c69bd5c96abffb374b7c397948` (#832).

## Reproduced boundary

[Review 4193170714](https://github.com/Proto-UI/Proto-UI/pull/832#discussion_r4193170714) was independently reproduced with real Runtime, FocusModule and shared FocusCenter. An enabled dual-role owner first retained a host-rejected entry request. After another scope became active, a newer `focus()` or `focusSelf()` was correctly denied target admission, but it never reached the old pending-slot clear in `applyTargetDirect`. Readiness later applied the older keyboard entry to the descendant outside the active scope.

Four controls were red before repair: programmatic/native requests, each with ordinary later readiness or a root getter that synchronously delivered readiness during the new request's preflight. Five controls passed: disabled target attempts preserve the independently enabled entry; in-scope target requests replace old entry; an entry without a superseding target request remains separate from Center target arbitration.

## Minimal ownership repair

`beginFocusOperation('target')` clears the old pending slot immediately after taking execution ownership. Every target call site remains behind declared/enabled checks. Cancellation therefore precedes reentrant host/root/policy getters, including Center-prepared target requests. Clearing only after scope policy returns would be too late for the reentrant controls. No host effect, fact synthesis or new Center arbitration for entry is introduced.

Applicable draft criteria are `C-AS-FOCUSABLE-0001-G`, `C-AS-FOCUS-ENTRY-0001-H`, role exception `C-FOCUS-0001-H`, and entry-policy separation `M-FOCUS-0001-G`. One narrow test case maps the nine permanent controls. Existing null-entry cancellation, private intent identity, retry budgets, target-disabled exception, contracts, adapters, workflows and numeric ceilings remain unchanged.

## Separate null-policy review disposition

[Review 4193170706](https://github.com/Proto-UI/Proto-UI/pull/832#discussion_r4193170706) requests a different semantic behavior. Three unchanged-source controls distinguish requester-root absence (retained intent recovers), a present root whose current entry policy returns null (intent ends), and direct replacement without a null-policy result (recovers). The owner-directed established null-result termination was preserved; the proposed persistent wait after a null policy result was not adopted or labeled a repaired bug. A future transient-descendant-gap policy needs an explicit semantic decision rather than a hidden change in this repair.

## Evidence and limits

- Original diagnostic: four intended failures, five passing controls. The first permanent seven-case run independently reproduced two ordinary failures/five controls; the final test adds both reentrant-root-read controls.
- Actual candidate: 470 tests across 41 Focus Runtime/Module/Adapter files passed, including the nine new controls. An independent reviewer separately ran six suites/106 tests and found no actionable issue in the frozen three-file candidate tree `cadbeed0b0d51c1f4c3ce22158e3ccb351bb09f5`.
- All 44 public packages built; complete workspace/docs types passed (446 files, zero errors/warnings, four hints). Catalog, base-bound spec authoring and formatting passed.
- Complete non-overlapping general plan passed 4,408 tests across 647 files, with 34 todo and three skipped files (650 collected). New-head native CI is required. The preceding source's native/CI success remains tied to that preceding SHA.
- Controlled host readiness and callback ordering in happy-dom are explicit injections; Runtime, shared Center arbitration and pending ownership are real. This does not establish full browser navigation or arbitrary host-exception transactions.

## Direct package measurement

The adjacent JSON records all eleven complete source and prepared-combination artifacts with environment and hashes. Source gates pass with Runtime 68,077/69,200, React 89,635/91,000, Vue 89,407/90,800 and WC 93,292/104,500. Relative to source c3 this is +4/+5/+4/+5 gzip bytes.

Applying only this Focus repair to validation parent `21f59593abcc375d8b0a4020e39e473c20525987` measures Runtime 68,958/69,200, React 90,878/91,000, Vue 90,648/90,800 and WC 99,500/104,500; all nine gates pass. This prepared combination does **not** include any later independently owned #809 Runtime/material repair and cannot predict its final union cost. No cap increase was made. **Never merge validation-only #826.** #824 approval/main integration and independent platform review remain distinct obligations.
