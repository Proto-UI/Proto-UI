# Read-only main52 merge preview

- Current source: `dca8f4f8f17ff1eba7198ad5aef8a018b3ac9434`; fetched main: `52e62632eede8ff094a91216f7d3373d66d77ef0`; actual merge base: `4aaac6ac60348dc99896c34cd1186abcda98ff0d`.
- `git merge-tree --write-tree --messages --name-only` returned exit 1 and preview tree `78ef7d3be805b34fca13cd488083e12ed818fe9b`. It changed no branch, index or task-worktree file.
- **One actual conflicted path:** `apps/www/src/content/docs/zh-cn/contents-wheel-evidence.ts`. Four conflict-marker regions overlap two independently expanded observers. Automatic output additionally duplicates scrolls/onScroll/seenScrolls/disposed declarations: selecting marker sides alone is insufficient.

## Concrete temporary resolution

`/tmp/contents-main52-observer-resolved.ts` — 11055 bytes; SHA256 `c2be71f093207be7e3e588940cc9d801dae046e764a2b5b8676d0863cd308c45`.

Unify one passive scroll collector. Preserve main's stable node IDs, read.hitPath/wheelPaths/scrolls snapshots, event coordinates, open-shadow observation and disposal behavior. Preserve our separate inspect() geometry/dispatch-time identity report, event-time target snapshot, 64-event limit and explicit droppedScrolls. Route a propagation once at its outermost observed target instead of retaining Event identity forever; the same Event can be dispatched again and its actual shadow origin remains visible. No CSS, focus, scroll offset, deadline or native input is written.

Main's richer read() fields intentionally remain. Thus merged polling retains main's extra diagnostic reads; it is not byte-identical to dca's lighter read path and needs new source-bound evidence. The temporary file is an authored reconciliation candidate, not independent platform approval of its own implementation.

## Clean intersections to retain

| Path/scope | Resolution |
| --- | --- |
| Homepage matrix | Automatic merge preserves main's instanceof Element owner narrowing and both final displacement assertions. Independently checked original 1000 ms poll, two RAFs, 180000 ms case deadline and separate inspect calls. Saved exact auto-merged file: `/tmp/contents-main52-homepage-auto-merged.ts`. |
| Observer unit test | Automatic merge retains both sets of controls: 13 cases. The temporary check adds one same-Event redispatch/composed-path de-duplication control; its exact patch is `/tmp/contents-main52-observer-reuse-event-test.patch`. |
| Native observer controls | Keep main's owner narrowing and clientX/clientY assertions. |
| Positioning source/tests and focused workflow | Preview has no differences from dca in these scopes. In particular the production host's existing same-Event handling and final intrinsic repair remain intact. |
| Positioning package manifest | Keep main's 0.3.0-alpha.2 to 0.3.0 version change. |
| Other main changes | Preserve main release/CLI/Anatomy changes. CLI generated Switch tokens changed; old generated-CSS equality cannot be assumed after integration. |

Both 6710e77363fd02fb77e8af6b24e1a1335f14af32 (passive diagnostics) and 7fe810b410fb7131eb36a11e11662295df1d6cc0 (handle narrowing) are real ancestors of main52. They are independent committed changes to preserve, not evidence that this merge has already run.

## Actual bounded verification

The isolated `/tmp/contents-main52-observer-check/` uses installed repository dependencies and merged unit source; it does not touch the task worktree. Final **14/14 tests passed**, standalone observer TypeScript **exit 0**, and Prettier with the repository configuration **exit 0**. The final unit file preserves the exact automatically merged 13 cases and adds only the 20-line redispatch control; its patch is 892 bytes. Final-byte checks were rerun after applying the repository formatting configuration. Logs are vitest-final.log and tsc-final.log in that directory. Native controls, matrix, generated output, merged workspace typecheck and broader suites were not run.

The first temporary candidate check caught an optional second facts() argument being supplied Array.map's numeric index (13 pass / 1 fail and TypeScript errors). Explicit `(node) => facts(node)` callbacks corrected that temporary authoring mistake. The initial Vitest log is retained as vitest-initial.log; it is not a failure of either published source.

Main integration is now postponed by the parent until the dca native cause is known. No merge, checkout, ref update, source edit or platform write was performed by this preview. The new dca native failure belongs to dca, not this temporary merge candidate.
