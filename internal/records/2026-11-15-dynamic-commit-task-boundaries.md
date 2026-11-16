# Task boundaries between independent author-slot commits

## Observed problem and owner

The website's dynamic author-slot queue serialized host commits through promise continuations. A completed acknowledgement could be followed immediately by another expensive host commit before an unrelated host task had an opportunity to run. This also happens when the next request is first enqueued by an acknowledgement continuation: Search awaits its results publication before publishing its actions. This is a website scheduler issue. It does not change the portable prototype definitions or the compiler.

The current draft direction, `D-HOST-PROTOTYPE-PROJECTION-SCOPE-0001-AUTHOR-SLOTS`, requires the host/ref commit to finish before acknowledgement. It does not require different slots to finish in the same event-loop task. An initially empty dynamic slot remains empty until its author publishes children.

## Repair and preserved ordering

After `hostCommit`, the model transaction, `onCommitted`, and resolving the request acknowledgement, the queue yields through a zero-delay host timer while its lease is still current. The serial lane remains reserved during that task boundary even if the queue is empty at that instant. An acknowledgement continuation can therefore enqueue its next request before the lane resumes. On resumption the queue repeats the current-lease and transaction-admission checks before starting another host mutation.

Already started commits remain atomic. Same-slot queued requests can still be superseded, invalid incoming data cannot evict valid pending work, and disposal or a revoked live lease prevents later host mutations. Host/postcommit failures retain their existing fatal cleanup and rejection behavior. A single request's acknowledgement still resolves before the timer, so the acknowledgement itself gets no additional task delay. Disposing a queue cancels its pending timer and resolves the drain's internal wait; an idle queue does not retain a scheduled callback after disposal.

This is a bounded fairness repair between complete author-slot transactions. It does not split a transaction already in progress, and a zero-delay timer does not guarantee a particular latency, browser paint or native input result.

## Intermediate candidate and continuation correction

The first candidate yielded only when a backlog already existed at acknowledgement. Its source SHA-256 was `570ef8abf7c098a3478d732935fbefb0b2a15600508ce4ecb224139bc807928e`. Independent review correctly retained its empty-backlog limitation rather than claiming native performance acceptance.

The actual Search results-to-actions call sequence showed why that limitation mattered. A separate real-timer probe against the frozen first candidate observed both commits before the unrelated host task. The first probe launch had a module-format setup failure; the corrected `.mts` execution produced the actual behavioral failure. Both attempts remain preserved. The final repair closes that continuation gap and explicitly retires its idle timer.

## Evidence

The first unchanged 14-case fixture produced **10 passes and four failures** against the original source, then **14 passes, zero failures and zero skips** against the first candidate. Its original seven cases remain a byte-identical prefix. The four discriminating failures use real timer tasks to observe acknowledgement, supersession, disposal and live-lease changes between independent commits. They do not use mocked clocks or claim native input coverage.

That first candidate's explicitly selected nine-file affected run passed **192/192 tests with zero skips** in 47.933 seconds, and selected strict types passed in 1.923 seconds. These results remain historical evidence for that revision.

The final 18-case fixture retains the complete preceding 14-case file as a byte-identical prefix. Against the first candidate it produced **14 passes and four failures**; against the final repair it passed **18/18 with zero skips**. The new controls cover an acknowledgement continuation's next commit, retirement of continuation work, same-slot supersession by a newer host task, and actual cancellation of the idle timer.

The final nine-file affected run passed **196/196 with zero skips**, one worker, in 46.897 seconds. It includes actual Web Components, React, Vue and Vue2 renderer/public-instance paths, dynamic composition and theme ownership, and Search public-mode/command/publication controls. All 16 bound source paths remained unchanged. Selected strict types for the two changed entrypoints passed in 2.156 seconds.

The final queue source SHA-256 is `5fac0c57d691fdfa823dfa6f1bbebc794ba48243afd20a0ab5ab91a5d476b025`; the fixture is `d3d56cbfee4d73688db8e1c51e82425ba38069f5a4e7999ef91e3813a604283d`. The first candidate, complete source snapshots, original failures and every intermediate receipt remain available for independent reconciliation.

The preserved v12 CPU profile motivated this investigation but is not acceptance evidence for this change. Its ready task lasted about 828 ms and included actual new-row mounting and dynamic host commits. The original four production journeys and complete 83-case browser suite still need to run on the candidate containing this repair, with their original actions, getters, readiness markers and 1000 ms predicates.
