# Sprint 4 combined public semantic and shader validation

Date: 2026-11-24 (Asia/Shanghai).

The integrated continuation at `282cbca2c375b371470eb75853750ba023f420b3` passed **181/181 tests across 13 selected files**, with zero failed, skipped or pending tests. The exact candidate includes the frozen-input reconstruction and definition-binding tools, the public semantic receipts, and the immutable shader data specialization, merged with main `0adde15d1e5dacb112cdad4d8d7811e015cc4456`.

This run joins the public dormant/optional-callable/getter/abrupt-return controls with the new shader data proof, native shader/project lowering, target admission and no-DOM Runtime controls. It verifies the interaction of these changes on one committed source tree. Node 24.22.3 and pnpm 10.32.1 executed Vitest with one worker and `NODE_OPTIONS=--max-old-space-size=1536`; no assertion or source changed during the run.

The [receipt](evidence/2026-11-24-sprint4-combined/receipt.json) retains the complete command, UTC start/end times, source head/tree, exact test-file selection and lossless raw report hashes. The report-only commit that adds this record is later than the executed source and is not relabeled as the tested head.

The original IR10 packet was unavailable to this local execution. No original private compiler, complete workspace, physical browser, GPU hardware, native platform, release or owner acceptance is inferred from these selected tests. Browser execution is tracked separately; the prior launch failure remains in the [shader candidate record](2026-11-24-sprint4-static-shader-data.md).
