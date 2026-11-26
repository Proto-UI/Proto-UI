# Rebind retained Table membership after logical reparenting

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Finding and old/new evidence

Review of the valid-projection repair requested an explicit departure check. Four executable Web Component controls keep the physical elements connected while moving a row and its cells, an individual cell, or a header and caption out of a valid Table, and move a complete row between two valid Tables and back.

With both Anatomy and Table production files restored to `5445b04c970f6fb46ccd871d2fbe509709c80e45`, all four controls fail. Departing elements retain their old `row`, `cell`, or `columnheader` role. A row moved into the fourth position of another Table keeps its old row index `3`. The first projection-continuity candidate also fails the departure controls: the defect predates that candidate. The old unconditional clear loop iterates only the current `domainRecords`, so it never reaches a member that has already left the queried domain.

The retained WC owner updates after logical reparenting without entering a new mount epoch. Table previously rebound membership only during configuration/mount paths and ignored ordinary `updated` completion. Its cached `domainScope` and old semantic facts could therefore survive a logical move.

## Repair

On an `updated` completion, a declared Table part compares the current Anatomy scope with its cached scope. Only a real scope change invokes the existing `notifyRoot()` path. `bindDomain()` clears the old part projection, updates the scope, and recomputes the old root; `notifyRoot()` also recomputes the destination root when one exists. Same-domain updates perform no extra topology recomputation. This adds no observer, global scan, host-specific Table capability, new scheduling, or lifetime.

All four actual WC controls pass after this repair. Removed still-connected elements lose their structural role, coordinates, spans, and Table-owned labelled-by relation while the remaining Table remains valid. The transferred row and cell report `3 → 4 → 3`; header IDREFs follow the matching header in each destination domain rather than the previous header. Removing one authored header reference and then removing an optional caption also retracts the corresponding IDREFs. Retained logical object IDs remain identity, rather than being regenerated from protocol keys.

The generic A11y suite separately continues to cover physical target replacement, detach/rematerialization, owner-document changes, ID reservation cleanup, and terminal disposal. The new tests specifically prove still-connected Table membership moves; they do not claim a new native-browser or assistive-technology acceptance result.

## Verification and remaining Matrix limit

- Final combined focused checks pass: 19 test files, 126 tests, including Anatomy/A11y/Table modules and all four official Web-adapter Anatomy/Table integrations.
- Five changed source/test files and their transitive imports pass a focused TypeScript check; whole-workspace and native checks remain integration work.
- Before this follow-up, the `bb334c7f9c4be1e17c379b3d14792ffa12d72097` two-fix Matrix candidate still reached the external 28-second diagnostic limit with 85 WC mount events and none from other adapters. Its last synchronous mount receipt was at 11.994 seconds. That unprofiled run cannot be used as a strict performance comparison with the profiled original-source run, and it did not establish a Matrix repair.
- This follow-up has not been run through the complete 420-cell diagnostic or native suite. The original native Matrix assertions, cases, and deadlines remain unchanged. Native stall diagnosis, independent review, and exact-candidate CI remain open.
