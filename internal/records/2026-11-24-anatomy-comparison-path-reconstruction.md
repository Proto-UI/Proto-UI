# Anatomy comparison-path cache: reconstructed source and fresh evidence

Date: 2026-11-24 UTC. This record is non-normative.

## Recovery boundary

An executor replacement made the local object
`e284a86aabe70880579048a2bfcbe3e2047591bc`, its checkout, and its raw validation
archive unavailable. They are not claimed as recovered. The retained full
three-file patch was reconstructed on
`6710e77363fd02fb77e8af6b24e1a1335f14af32`, and new validation was executed.
All three rebuilt source/test files match the SHA-256 values retained before
replacement. This is a new candidate on a new base, not the old Git object.

| Source | Reconstructed SHA-256, identical to the retained prior value |
| --- | --- |
| `packages/modules/anatomy/src/impl.ts` | `96abf05e884dd8f3240687c60bcc9037eb183802e22b5209e82986d2f3d15209` |
| `packages/modules/anatomy/test/subscriber-fanout.test.ts` | `0039609053ccdb93ba776f1c628f3f01c9f6b37d313323cba577b11ac1c58884` |
| `packages/runtime/test/contract/anatomy.order-fanout-cost.contract.test.ts` | `9e4ab767dae5d47cd15bb6c9b138a2ee03b443366460a91585d6ea5ba32f3ac3` |

The unmodified implementation on the new base has SHA-256
`94d202b3665bee798349cf481aa70197635ce84fd6cf18990acd41fcb6aff674`, equal to the
earlier profiled source. The parent browser task owns the actual Matrix startup
profiles and original 60-second acceptance checks; this child did not execute
the native browser.

## Implementation and authority

The cache lasts for one synchronous notification and reuses only the path
through the existing pair-result cache. Each subscriber still sorts, and every
comparison still reads both current host targets and the current comparator.
Reuse requires the same domain claim array, comparison position, target pair,
method identity, and comparison epoch. Existing callback and observer boundaries
clear traces together with the original caches. Replacing a cached comparator
advances the epoch, including an intervening replacement followed by restoration
of the original function. Public queries retain their uncached path.

The applicable direction remains draft: `C-ANATOMY-0005`,
`C-ANATOMY-ORDER-0001`, `C-ANATOMY-ORDER-0002`, `C-ANATOMY-ORDER-0003`,
`HC-ANATOMY-ORDER-0001`, `HC-ANATOMY-STRUCTURE-0001`, and `M-ANATOMY-0001`.
The existing live-input correction in
`2026-11-23-anatomy-live-host-correction.md` remains in force. No public API,
membership/lifecycle rule, source admission, timeout, or budget changes.

The previously rejected independent-domain mount filter is absent. Its three
counterexamples remain: another domain can reorder targets, replace a target,
or replace a comparator immediately before an independent mount notification.
Those current facts must still be observed. Mounted is not assumed to mean the
first view epoch.

## New executed controls

Node 24.22.3, pnpm 10.32.1, Vitest 2.1.9; one worker with no file parallelism
and no Vitest cache. Existing workspace dependencies were reused through local
links; no lockfile or dependency installation change was made by this child.

| Fresh execution | Observed result |
| --- | --- |
| Unmodified source with the reconstructed selective controls | Two expected cost failures; four semantic controls pass; 38 filtered cases |
| Complete Anatomy module and runtime contract selection | 11 files; 106 passed; zero failed or skipped |
| Four Web Adapter, Base logical-parent and retained/reentrant table integration selection | 11 files; 41 passed; zero failed or skipped |
| Changed TS entries and their imported closure using the strict repository configuration | Exit 0; not a whole-repository types claim |
| Deliberately remove the comparator-replacement epoch guard | One expected callback failure; 18 filtered cases; original candidate bytes restored in `finally` |
| Prettier and diff whitespace checks | Exit 0 |

The 64-part, 16-subscriber fixture preserves 9,856 current target reads and 307
native comparisons on both original and candidate implementations. Synchronous
target-key Map lookups fall from 9,792 to 552; native observer notification
lookups fall from 9,793 to 553. One subscriber uses 616 current target reads,
307 native comparisons, and 552/553 lookups. Unchanged order remains silent and
public ordered queries still return the real shuffled order. These operation
counts are not a browser elapsed-time measurement.

The F-to-G-to-F control uses distinct logical bridges with three subscribers.
The original and candidate observe the third subscriber's changed order. The
unsafe epoch-removed variant misses that callback. Filtered cases in selective
baseline/mutation commands are never counted as passes. The unsafe variant is
not committed, and the restored three source hashes were rechecked.

New raw reports, logs, exact commands, before/after hashes, execution receipts,
and workflow handoffs are in the
[fresh evidence archive](evidence/2026-11-24-anatomy-reconstructed-validation.tar.gz).
Its manifest binds each member by SHA-256. It contains new executions only;
the unavailable original archive has not been recreated from summarized counts.

## Remaining acceptance

The bounded source reconstruction and local semantic/cost validation are
complete. Independent review binds the newly committed source separately.
The parent must run the original native Matrix assertion and deadline on the
integrated candidate. Lower Map lookup counts alone do not establish a startup
pass: sorting, getters, native comparisons, and trace allocation still cost
time. Canonical strict package budgets and complete integration/release gates
remain bound to the final integrated SHA. No external write or release
acceptance is claimed by this child.
