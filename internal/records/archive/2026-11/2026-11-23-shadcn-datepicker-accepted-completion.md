# Shadcn DatePicker accepted-completion observation

The original `collection-profiles-r91` DatePicker case expected a close proposal immediately after a controlled date proposal that its owner had not accepted. The existing `C-CALENDAR-SELECTION-0001-PICKER` contract instead requires the popup to remain open for rejected or pending selection, and permits completion only after canonical acceptance in the same open session. The controlled-open owner then independently accepts or refuses the close proposal.

The test now observes both phases. Before date acceptance it requires no close proposal, unchanged canonical date, an unselected candidate day, the old visible date and an open popup. After the owner accepts that exact date while leaving `open: true`, it requires exactly one `date-selection` close proposal while the controlled open state remains true. The original state-handle identity, profile withdrawal, inherited day rendering, read-only rejection and later explicit close refusal checks remain.

No product code, timeout, selection, source fixture or contract changed. The independent Base Calendar selection suite still runs in full.

- Baseline: original complete Shadcn file, 16 passed / 1 failed / 0 skipped.
- Candidate: complete Shadcn file plus Base Calendar selection, 42 passed / 0 failed / 0 skipped, 10.79 seconds.
- Both run receipts report stable source before and after execution.

[Original failures, complete logs and JSON results](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-shadcn-datepicker-accepted-completion/validation.tar.gz) are retained with [member hashes](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-shadcn-datepicker-accepted-completion/manifest.json). These are source-runtime observations; no new native-browser or assistive technology claim follows from them.
