# Preserve the integrated manual browser boundary

## Why the earlier candidate needs reconciliation

The first boundary repair was tested on a tree where browser_acceptance was already a reusable workflow_call input. Concurrent main commit 09ba78ca511fdf46e028c219767673f9b8f9364e deliberately removes that reusable input and keeps the existing browser lane as a default-off workflow_dispatch choice. It also independently removes the repeated native Scroll steps.

The hosted PR merge of head 5b82b6708bfdbf9cac1a45fece31dc7f400f3ccc into main 33ac501a90cbe0f074fdb05c7e862076a280ff76 (synthetic merge afb5705f) therefore reports 25 passed / 6 failed in run 45221487768, job 137856629582. Those six failures all reject the narrower reusable input object. The earlier 31/31 result remains valid for its recorded tree and does not establish a pass on this new merge. The original records and raw failures remain retained.

## Current repair

Normally merge the fresh main ref recorded in the manifest. Keep its wrapper unchanged: only Adapter is reusable, browser is an explicit manual opt-in, and each complete Scroll target executes once. The helper again requires exactly the one Adapter reusable input. It additionally checks the actual manual browser input is present, optional, boolean and default-off, and that its exact guard delegates to the existing browser workflow with both complete source regression and production lanes enabled.

Controls reject moving browser back into workflow_call even with a false default, missing or weakened manual input metadata, unconditional or Adapter-coupled execution, a replacement owner, and either disabled child lane. All original Adapter, Package-budget, Website, unknown-input and native Scroll negative controls remain, including both new duplicate-target counterexamples.

## Validation boundary

The actual merged original reproduces 25/31, then all 31 scheduling controls pass with zero skips. Both additional test commands and the repository schedule audit from the actual ci-config-audit job also pass; their complete counts, commands and logs are in the manifest. The wrapper hash is unchanged from the fresh main merge throughout this repair.

The first ledger-control invocation passed 19/21 and failed two writes with ENOSPC in the shared system /tmp. Its raw output is retained. Only that failed command was repeated with the same source and assertions using the recorded owned TMPDIR on the project volume; all 21 then pass. No shared files were deleted, and already-green scheduling and cycle controls were not rerun.

These are scheduling and failure-propagation checks. This record does not claim a new native consumer or browser acceptance run. The old two-reusable-input interpretation is superseded by the explicit integrated main policy above.

## Original Sprint wiring on the fresh merge

The selected Sprint 1 wiring check passes 1/1 on this exact fresh merge. The adjacent Sprint 3 workflow/receipt command initially passes 31/32: its original Unix socket length assertion correctly rejects the longer project TMPDIR. Without changing source, assertions or the socket limit, that same command passes 32/32 with an owned short /var/tmp directory. Both outputs and exact environment paths are archived; the first already-green wiring test was not repeated. All final counts have zero skips.
