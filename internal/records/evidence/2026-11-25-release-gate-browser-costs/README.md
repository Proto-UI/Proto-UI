# Browser scheduling evidence for run 45537881490

The 18 exact GitHub job log archives bind to commit 4d288166d2d5e42ad6d9b7a34e8a8d03bbc94c0c. They contain 98 terminal suite costs: 83 passed and 15 failed. The other 16 selected suites have no terminal summary; their completion and elapsed costs remain unknown. A failed terminal cost remains a failed result, even when useful for scheduling.

The candidate adds these observed durations to the existing cost model. It preserves all 114 suites, 18 shards, the 720-second work allowance, the 180-second setup reserve, the 900-second job watchdog, and every case deadline. Under that unchanged policy the estimated total is 12095 seconds and the shard estimates range from 668 to 694 seconds. Native CI still has to establish the outcome on the final integrated source.

The first proposed 20-shard analysis incorrectly retained the 120-second unknown fallback after a first terminal observation. That proposal and its false minimum claim are withdrawn. The rejected projection and explicit correction are retained separately; neither is scheduling policy or acceptance evidence. The original pre-reset failed control log was lost and is not reconstructed.

The restored candidate passed all 206 runner, inventory, process-owner, baseline, isolation, keepalive, cleanup, and Sprint1-owner controls with no skipped tests. The exact local output is preserved in runtime-controls.log.gz; controls-receipt.json binds the command and archived source digests. Sprint1's existing separate contents-wheel workflow scope is verified against its actual owner.
