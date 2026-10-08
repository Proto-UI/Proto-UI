# Select controlled Tab cancels its deferred entry

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Reproduction and revision attribution

The full `packages/prototypes/base/test/select.test.ts` suite must not remain excluded from the integrated Numeric/Finf checks. It reproduces the same 19 passes / 1 failure on both reviewed integration `e85f251f08687f8c1816b6e33735d3ee9faf41bd` and official predecessor `b0392134d488103faad977ff586bb86caf996556`: after a controlled Root rejects a Tab close request, an old deferred entry steals focus from the explicit outside button back to the first Select Item. The Select implementation and original test bytes are identical between those two revisions. `git merge-base e85f251f0 b0392134d` is b039 itself.

The shared baseline with origin/main is `169407b2d463d5da5d6694e2d1f8644578046b40`. Its original suite passes 17/17 but lacks all three newer Trigger/deferred-Tab controls. Transplanting only the current test file and selecting those three cases yields 3 failures: Trigger Tab is not recognized there yet. Therefore the green older suite does not establish that the newer failure is an oracle error, and this defect was not introduced by the Numeric integration.

All three revisions were checked out into separate worktrees, with independent offline frozen-lockfile dependency installation and worktree-local workspace links. No other candidate's tree was modified.

## Governed owning layer

Draft `P-BASE-SELECT-CONTENT-DISMISS` requires Tab dismissal without preventing native traversal, including deferred entry while the unique same-domain Trigger owns focus. Draft `P-BASE-SELECT-REQUESTS` retains controlled Root authority. The Content's Tab handler already recognizes the correct domain and sends a close request, but its `entryTask` was cancelled only when Root actually transitioned closed. A controlled rejection leaves Root open, so that task still runs.

The bounded repair cancels and clears this Content's pending entry before delivering its Tab close request. It neither forces the controlled Root closed nor changes selection, event cancellation, another domain, deferred entry after a later genuine reopen, or any Adapter source. Clearing the handle also prevents a late Item publication from restarting the cancelled action through Anatomy membership notification.

## Discriminating checks

The controlled-rejection case now covers both Tab and Shift+Tab, retains cross-domain/no-extra-request assertions, verifies default traversal is not prevented, inserts a late Item, and proves a subsequent accepted close/reopen still performs normal selected-item entry.

- Original expanded controls before the fix: 19 pass / 2 fail.
- Repair: full Base Select 21/21 passes, with no excluded case.
- Remove only the `cancel()` call: both controlled cases fail again.
- Retain cancellation but remove handle clearing: late Item publication revives entry and both cases fail again.
- Complete Select selection across Base, four hosts, styled projections, real React keyboard, controlled cross-host journey and CLI: 11 files / 95 tests pass. Simulated focus movement in these tests is setup evidence, not a native Tab/pixel claim.
- Workspace TypeScript passes after generating this tree's required style artifacts.
- Same-environment whole-entry budget probe: every one of the nine gated minified artifact hashes and gzip sizes is identical to e85; React remains 105,960 / 106,000 bytes (40 bytes headroom). No threshold changed. This probe does not measure a new Select-specific package budget.

## Native work remains separate

Official b039 Select run `37726400896`, job `113145445350`, passes 8/24 and fails 16 cases at the 320px / 200% whole-document overflow assertion, after RTL and popup geometry. This deferred-entry unit repair does not claim to repair those overflow failures or revive an obsolete all-LTR/Tab diagnosis. The new integrated exact-head native run is still required.
