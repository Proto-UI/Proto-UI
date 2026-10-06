# Public benchmark calibration browser bootstrap bound

The exact #775 source `83633a21fe16bb41dda7dd9b5440d9c5c8623172` failed Interaction benchmark calibration job `112361242062` before observing any interaction: Chromium process launch exceeded the evaluator's 10000ms startup limit. The existing raw setup failure remains recorded. Independent native diagnostics on the same work sequence measured browser-ready at 18367ms and 22640ms; these are setup observations, not acceptable interaction latency or proof of a specific scheduler defect.

The evaluator now uses a bounded 30000ms process-launch budget, matching the existing documentation/browser-setup policy. This changes no public semantic oracle, action assertion, action timeout (1200ms), screenshot timeout (5000ms), test deadline or workflow process deadline (90s with the existing termination grace). It adds no retries, network permissions, skipped positive/negative cases or success fallback. Failure still produces blocked setup and raw evidence; no total-run guarantee is invented inside the evaluator.

The existing unavailable-browser control now checks that both returned and persisted environment metadata expose the exact startup/action/screenshot bounds. Full model/unit results and new native outcomes are reported on the repair PR; the local environment does not support Chromium, so native cases are explicitly skipped locally and require GitHub verification. Prior 10s failures retain their original metadata and are not relabeled.

This is a shared startup-only repair prepared on accepted main, separate from the large #775 audit and #832 product stacks, so other authorized carriers can take its normal dependency history without copying a fork.

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
