# Focus execution ownership and teardown admission

Date: 2026-10-05. This is an implementation/evidence record, not new normative authority.

## Source and reason

This repair continues PR #832 from `17712d1cf2f551bfab2e8912e3ebf07dacd43a2e`. It preserves the externally authored main synchronizations through `c4651c99` and `17712d1c`; no duplicate merge or history rewrite is used. The preceding `cd48763c` native/general results remain historical evidence for that source, and the cancelled `c4651c99` jobs are not native acceptance.

The new review findings were independently reproduced before repair:

- `discussion_r4188026951`: ordinary Vue/Vue2 commits renewed an exhausted request's layout retry budget.
- `discussion_r4188026958`: a first unresolved entry could replace an unrelated pre-projection target request.
- `discussion_r4188179386`: synchronous blur-observer refocus could succeed physically before the old blur continuation erased its facts.
- `discussion_r4188179395`: Vue2 teardown accepted native/entry focus behind the closed event gate. Related actual-owner boundaries were checked in Web Component as well.

The existing `discussion_r4188026943` package-budget failure remains a separate integration dependency on #824/#826. This repair does not raise a ceiling.

## Implementation contract

Applicable draft authority remains `C-AS-FOCUSABLE-0001-G`, `C-AS-FOCUS-ENTRY-0001-H`, `C-FOCUS-0001-E/F/H`, `HC-FOCUS-TARGET-0001-C/D`, `C-LIFECYCLE-0004-E` and `C-LIFECYCLE-0006-C/D`. No lifecycle promotion or normative amendment is made.

Private request-options identity continues to identify a distinct author intent for Adapter retry accounting. Readiness and Center replay preserve that identity. A separate private execution token guards synchronous application: the current operation must still own the request after root lookup, scope admission, callback entry, target resolution and the host focus call.

A first unresolved entry remains tentative and has no new retained intent. Its temporary predecessor chain preserves an unrelated live target operation. Role-specific cancellation marks suspended operations as well as the current operation, skips cancelled tentative entries when restoring a predecessor, and stops at a cancelled admitted operation. Temporary chain links are released at execution exit.

Fact updates use an epoch checked between observable State writes. Native focus additionally checks its host-target generation. Center claims a new owner epoch before clearing other owners, including in-flight requests that do not yet have pending state or facts. A policy-rejected request in another instance is not treated as a global cancellation of the accepted owner.

Target disable cancels its role before eligibility watchers or host blur can reenter. A synchronous re-enable/refocus replaces the immutable config and owns subsequent work. Explicit blur cancels either role, while the old post-blur continuation cannot erase a newer fact epoch.

## Bounded evidence and corrections

An independent initial 45-case matrix exposed 34 failures and retained 11 normal controls. The unchanged matrix became green after the first execution/fact ownership repair. Further preflight review added 13 cases, including a rejected-scope control that caught a global-epoch regression introduced by the first repair. That global epoch was removed in favor of per-instance execution ownership and accepted-owner epochs.

Additional controls cover symmetric target/entry cancellation, a two-level tentative-entry chain, and the legacy root-derived token fallback. The resulting four permanent files contain 64 cases:

- `packages/runtime/test/contract/focus-transition-reentrancy.contract.test.ts`: 45
- `packages/runtime/test/contract/focus-preflight-reentrancy.contract.test.ts`: 13
- `packages/runtime/test/contract/focus-role-reentrancy.contract.test.ts`: 5
- `packages/runtime/test/contract/focus-fallback-reentrancy.contract.test.ts`: 1

The review preserves failed intermediate runs. In particular, a mechanical edit temporarily omitted `setNavParticipation`/`setRovingStatus`; workspace type checking and independent source review caught this, and both methods were restored unchanged before final validation. The finite matrix is evidence for the listed target/entry acquisition and owner-cleanup boundaries, not a claim that every Focus callback has been exhaustively modeled.

The existing entry-readiness contract fixture also adds two first-entry/no-root controls and six synchronous blur/refocus cases. Four-Adapter retry conformance adds same-view commit controls. Adapter teardown tests exercise actual framework lifecycle and owner registration rather than injecting a readiness flag.

## External callback boundaries and limits

The guarded acquisition path includes legacy token/root lookup, Center root and parent-policy lookup, callback prelude, pending-slot root lookup, entry resolver, host focus, host blur, eligibility watchers, per-fact watchers and accepted-owner cleanup. Internal immutable config reads, State handle reads and Map lookups are not author callbacks in the actual implementation.

Scope/roving member ordering, `orderTargets`, scope activation/deactivation, projection setters, capability subscription installation and scope-history parent lookup are related paths with their existing regression suites; this repair does not claim a complete reentrant transaction model for all of them. State observer exceptions propagate; no rollback of already observed notifications is promised.

Adapter source-registration and source-release callbacks are themselves reentrant. Independent real-framework exception controls found that notification during Vue2/Web Component teardown could interrupt cleanup, and WC registration could interrupt view construction before a disposer existed. The final repair retains a releasable source lease before publishing it, completes old-view cleanup before invalidation, and uses the existing view owner's version to avoid an old detach removing a reentrant replacement. Every cleanup step runs while the first synchronous error is preserved. If that error prevents returning an already obtained lifecycle Promise, its rejection is observed rather than orphaned; normally returned rejections remain visible to the caller. Runtime mounted diagnostics are forwarded before readiness can synchronously trigger a later update.

Independent final Adapter review passes 38 probes, including registration failure followed by another hide/show and successful physical/fact acquisition. The permanent Adapter/base focused matrix passes 96 cases across seven files. The native suite now has 38 cases: the prior 16, twelve same-view budget controls, six Vue2/WC fresh-teardown controls, and four native blur/refocus cases. The WC textarea teardown's detached CSS may itself reject acquisition; that native case is not credited as an isolated proof of closed-gate admission. Actual framework owner-gate controls remain separately identified.

Native-browser tests remain a separate acceptance stage: simulated DOM, source smoke, bundles and type checks do not substitute for trusted focus events or real layout/frame delivery.

## Validation and remaining work

- Independent Module matrix: 64/64 passing against the reviewed Module/Center source.
- Final 44/44 public packages build and workspace types pass. A concurrent build/type attempt saw seven missing generated declaration files during the build's replacement window; the original failure is preserved, and the serial post-build type check passes without source or threshold changes.
- Local final budgets remain red for Runtime 68,073/67,100, React 89,333/87,500 and Vue 89,157/87,200. Web Component is 92,704/104,500; the two consumer diagnostics are 96,806 and 96,810. All eleven artifacts include minified hashes and environment provenance. These local measurements require new canonical CI corroboration, not substitution from the prior source.
- Whole-general first run: 634 files and 4,262 tests passed, with 34 existing todo tests and three skipped files. Its only failed assertion was catalog evidence integrity: the process captured `git ls-files` before the six new test paths were staged. The paths are now in the index; the exact unchanged three-test catalog suite passes on rerun. Production and test hashes are unchanged. The original failed aggregate is retained rather than relabeled green; formal CI will rerun the final committed tree.
- Documentation types pass for 446 files with zero errors, zero warnings and four existing hints. The runtime-plan Node suite passes 114 cases, and the focused spec relation/lifecycle checks pass 94.
- Exact native CI results are reported with the pushed source's validation comment; older source measurements are not substituted.
- New native probes must run on the supported CI runner. Local Chromium is blocked by the execution environment and is not worked around by weakening assertions or skipping cases.
- #775 remains unpublished while this source is repaired and independently validated. Its earlier prepared candidates and successful general runs are historical, and its eventual upstream refresh requires a new rendered native audit.
- Formal review-thread resolution, platform approval and merge remain separate governed operations.
