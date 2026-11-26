# Sprint 5: retain diagnostic bypass controls after train integration

This non-normative follow-up belongs to [PR #1738](https://github.com/Proto-UI/Proto-UI/pull/1738). Another session merged the original [PR #1715](https://github.com/Proto-UI/Proto-UI/pull/1715) before the input guard and corrected material-bridge validator were published. The candidate preserves those signed-off commits and normally merges the concurrent train; it does not rewrite the old PR or its failures.

## Actual integration failure and focused fixture correction

At `cf3fede0a13e0479a118665cf176bd3e7efff386`, frozen installation succeeded. The complete integrated bundle suite executed 2,064 tests: 2,062 passed and two newly merged Sprint 6 fixtures failed. Both fixtures contained the exact diagnostic route and `packages/adapters/base/src/material/program.ts` but no module graph. The validator correctly rejected missing module-edge provenance; the tests expected the older ordinary-shell error wording.

Both fixtures now declare the complete exact route -> producer -> same material program chain, first requiring no issues for that valid owner graph. Adding a direct static route -> program edge must then produce exactly the producer-bypass error for that same route and module. This retains the original forbidden target and adds a discriminating positive baseline. It does not replace the assertion with acceptance of an arbitrary error. The validator, provider permissions and existing missing/duplicate/dangling graph and framework controls are unchanged.

The first complete-fixture run retained two failures because the exact expected diagnostic lacked the identity backticks added by the existing diagnostic normalizer. Those raw failures and the hash-verified intermediate fixture are preserved separately. Correcting only the expected identity quoting produced 2,064/2,064 passing tests, with zero skipped or todo. The five source-input and preview-lifecycle files also executed all 32 tests successfully.

## Remaining evidence and honest result

The subsequent production-receipt controls executed 34 tests: seven passed and 27 failed during fixture import, each because the throwaway repository omitted `scripts/compiler/browser-repository-root.mjs`. This was not a successful receipt rejection. The already published main revision `824f7b12d828a179670e1d751f5f2c14d97d995d` adds that exact dependency to the copied fixture. Normal integration and a real rerun remain the next step; no new product exception is added here.

The independent post-run readback matched all five tested source hashes. Format and diff checks passed separately after the stopped sequence. The original pipeline statuses remain failed rather than being rewritten into a green aggregate. No canonical browser run or whole-PR acceptance is claimed by this record.

The [manifest and raw archives](evidence/2026-11-23-sprint5-integrated-controls/manifest.json) bind the exact parent, candidate sources, commands, toolchain, all three gate outcomes, input controls, fixture failure and original outputs. The two-case correction received independent source review; this is not a GitHub APPROVED review. Formal CI/DCO, actual browser acceptance, required review and the original release/application/hardware criteria retain their separate authority.
