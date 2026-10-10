# Finf prior-pr.862: close the original bounded budget transaction

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Independent read-only verdict

Approve the closeout of item 63, **prior-pr.862**, at reviewed integration revision `8989403a6d3668948c7394f4a370d8269ba1a6ec`. The original task is the bounded Template/Scroll/Focus numerical budget transaction, not certification of all future Finf code sizes. This decision changes no budget, policy, artifact or product code. It does not mark present Finf package measurements or the full CI green.

Original scope and exclusions: [PR #862](https://github.com/Proto-UI/Proto-UI/pull/862), “chore(budget): reconcile Template/Scroll and Focus integrated entry costs.” Its last numerical contribution is `f4c53e779f38c6f4ca2fc56348b276b1b3f20a86`, which is an ancestor of the reviewed integration. The original remaining requirements were exact-head CI, independent review and normal integration. The PR explicitly says its numerical proposal does not certify unmeasured future fixes.

## Verified source and execution evidence

The original `internal/records/2026-10-06-focus-preflight-shadow-budget.json` binds the actual source `a4a80fff525be52acc84a8ee7f51dcb0de12b4a3`. It changes only three limits: Runtime 69,367 to 69,591; React 91,417 to 91,653; Vue 91,166 to 91,396. All three increases have zero speculative headroom. The before and after records contain nine blocking entries and two diagnostic entries: all eleven minified SHA256 values, minified lengths and gzip lengths are identical across the numerical change. Old failing comparisons remain in the record.

The final integrated source of #832, `3dc9863e7f4bd79c0314285a7cf5fce858ebad8f`, has **no package-source difference** from that measured source. [Its official package job](https://github.com/Proto-UI/Proto-UI/actions/runs/37508257461/job/112436203909) passed all nine strict comparisons:

- Runtime 69,591 / 69,591 gzip bytes.
- React 91,653 / 91,653 gzip bytes.
- Vue 91,396 / 91,396 gzip bytes.
- Web Component 100,643 / 104,500 gzip bytes.
- The five other blocking entries passed; both nonblocking diagnostic entries retained their actual measurements.

This review parsed all eleven official output entries and compared their minified SHA256, minified byte length and gzip byte length against the retained record: **11/11 exact matches**. This is a read-only record comparison, not a new execution of the old source or a current-head package measurement.

The official checkout is synthetic merge `ee1f72f60fbf19c9c7223923ed9fc0a5c9f7153c`. GitHub Git API confirms its parents, and its complete tree `ecf430c8c8cd50bddc6092702e6c784b118fd763` equals the integrated 3dc986 source tree. The [integrated CI](https://github.com/Proto-UI/Proto-UI/actions/runs/37508257461) succeeded. The numerical PR's own [CI](https://github.com/Proto-UI/Proto-UI/actions/runs/37501375764) also completed successfully, including [its standalone package job](https://github.com/Proto-UI/Proto-UI/actions/runs/37501375764/job/112426239885). That standalone job has smaller source measurements and is kept distinct from the actual integrated source above.

The record's parsed contents at reviewed 8989403 equal the original f4c53 contents; differences are formatting only. The next locally frozen source `2f77255f9c5391a2dde8cf25b19392fb085cdcbc` also does not change that record. Its publication is not claimed here. Later budget changes have their own dated records and remain separate transactions.

## Explicit retained boundary

Later Finf measurements, including the recorded P2 strict overages of React +486 B, Vue +315 B and Web Component +99 B, remain real later-source debt. They do not negate a completed original numerical transaction, and this closeout does not discharge them. No all-family, GPUI-native, screenshot or runtime-conformance guarantee is inferred from budget evidence. No production source, compression algorithm, threshold or current pass/fail output is changed.

This is an independent local technical acceptance of the original carried item, not a submitted GitHub review or permission to merge PR #872. Record and ledger publication are pending. After this record is retained at an immutable published commit, the integrator can point the one-row closeout to its real URL. All other item states and historical records remain unchanged.
