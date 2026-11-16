# CodeExample: enhance the current host and separate layout reads

This bounded website scheduling change continues PR #1460 from published `6510b63696a4885a7cb20a3e9f1ff50daa5f1d42`. It is an implementation/evidence record, not stable admission of Tree, Tabs or the 0.3 release. Public package versions remain `0.3.0-alpha.2`.

## Why

The initializer previously acquired every host's file Tree, including hidden hosts, before admitting the outer host Tabs. Source controls already worked natively, so constructing those unvisited Trees added work without helping the current task. Each acquisition can mount multiple real Tree items and Lucide owners. The prior native Search diagnostic attributed work to this path, but its inclusive profile samples are not additive or proof of a particular saved time.

Native selection also read tab geometry immediately after each owner's writes; the projected host overflow hint read `scrollWidth` and `clientWidth` during admission. These reads could force layout between unrelated DOM publications.

The current user-directed repair changes the private scheduling policy. Hidden eager enhancement was not previously forbidden by a public definition. The draft `internal/contracts/prototypes/shadcn-tree-embedded.md` explicitly described the old inner-first order; that description is updated with the implementation, not silently left as a competing guarantee. `P-BASE-TABS` and `P-BASE-TREE` remain draft, and their protocol owners and implementation are unchanged.

## Ownership and resulting behavior

Each example first acquires one complete host Tabs group. Each following idle or fallback timer task re-reads the selected host and acquires only its unattempted file Tree. Hidden unvisited hosts keep their native controls. Selecting a later host queues its Tree; previously acquired Trees keep their identity and local file choices. Superseded hidden requests do no acquisition.

The outer Tabs transports complete host panels. A file Tree inserts its own control beside the native file list and changes file-source labels, while leaving the file-source nodes and their parents in place. Thus it does not need to precede outer transport. Real WC composition tests exercise acquisition after transport, later host selection, failed role admission with native fallback, focused source preservation, and reverse teardown restoring all source nodes. An existing focused native control or source still prevents its projection from stealing focus. Cleanup failures still block replacement of a possibly live owner.

Native selection, ARIA and hidden state remain synchronous. Non-focused native reveal is coalesced per viewport in an owned animation frame and revalidates owner, document, connectivity, selected tab and hidden/inert ancestry. Actual keyboard focus reveal remains synchronous and cancels the obsolete queued read. The no-animation-frame alternative remains immediate. Late cancelled callbacks cannot consume replacement reveal work. Projected overflow measurement joins the existing reveal frame; the overflow hint keeps its existing text/location.

## Executed evidence

Node `24.22.1`, pnpm `10.32.1`; one Vitest worker, no file parallelism. These are local HappyDOM tests with explicitly injected scheduler turns and geometry, plus real WC Tree/Tabs composition. They do not measure browser latency or paint.

| Run | Actual outcome |
| --- | --- |
| Same final 13 new scheduling/layout tests, original 6510 product files | 1 passed, 12 failed, 38 unrelated cases explicitly filtered; exit 1, 7.094 s |
| Final complete client, real Tabs, real Tree and no-JS suites | 65/65 passed, zero failed/pending; exit 0, 9.536 s |
| Strict TypeScript, five affected roots plus existing website environment declarations | Exit 0, 5.807 s |

The no-animation-frame control passes on both sources. The new scheduling assertions include the authorized current-host policy; they are not all claims that the old implementation violated a prior normative rule. Existing tests that assumed two hidden/eager Trees before host Tabs now assert the new order and request each host explicitly before expecting its Tree. Their selection, local override, source identity, role, focus, cancellation, zero-handle, reentrant acquisition, reverse-release and error-propagation assertions remain.

The first related candidate run retained 13 failures caused by those old eager order/count assumptions and the old synchronous overflow observation. The following two-file run passed 47/47, followed by the expanded three-file run 61/61 and the final four-file 65/65. These are overlapping runs, not additive coverage counts. An earlier selected type run failed because this fresh worktree lacked the existing `@floating-ui/dom` workspace dependency link; restoring that local link resolved it without product or lockfile changes. Original logs remain.

Evidence lives in the task's `codeexample-evidence` directory. The final baseline, candidate and type receipts bind full commands, timestamps, per-file before/after hashes and process results. Every bound tracked source file was identical before and after each execution. The baseline receipt binds old product files with the same final test source; it is not represented as a clean baseline checkout.

## Remaining acceptance

The original production Search deadlines, getters, actions and ready markers are unchanged. This local evidence does not declare the remaining native Search case fixed, nor does it replace the CodeExample browser interaction/visual matrix, full current-head CI, formal independent GitHub approval or release acceptance. Parent integration owns those current-source browser and review results.
