# Sprint 2 non-native consumer evidence

Product revision: 9d0f47d4ef67bbc3676e4db24c7906f8721e5b42
Product tree: 0c9d31e5bb05d3af79932ec3c62a61480197f9eb
Initial local replay result: FAIL (preserved worker-initialization failure).
Separate Tabs/docs follow-up result: PASS.
Combined verification of the original local scope: PASS.
Consumer scope accepted by the local replay: true
Aggregate Sprint acceptance claimed by this directory: false.

This directory is prepared for copying into a separate evidence branch. It does not modify the product PR or publish anything.

## What to read

- [summary.json](summary.json) records actual scope, observed outcomes and explicit untested or unsupported boundaries.
- [steps.json](steps.json) records the executed commands, expected and actual exits, durations, log paths and log hashes. Wrapper and child durations overlap.
- [frozen-sources.json](frozen-sources.json) binds the downstream Git commits and authored source hashes.
- [negative-controls.json](negative-controls.json) keeps the expected legacy identity failure and original pin rejection visible.
- [historical/9d0f47d4-initial-worker-failure.json](historical/9d0f47d4-initial-worker-failure.json) preserves the initial zero-test worker failure, its real RangeError diagnostic and the exact original 13-test recovery.
- [historical/1450ffd549bc-failure.json](historical/1450ffd549bc-failure.json) preserves the earlier real 1200-second aggregate typecheck timeout.
- [manifest.json](manifest.json) maps every published evidence file to its original key and original SHA-256, its public SHA-256 and exact path-redaction counts.
- SHA256SUMS covers every public file including manifest.json, except SHA256SUMS itself.

## Source and scope

Shenko uses the frozen f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42 commit. Verdant uses the frozen 91a775546ebd21a87d76d76568195a6513437719 commit. These are recorded downstream snapshots, not a claim about their latest development heads.

Shenko's source-seam lane passes 51 tests. Its pinned-artifact lane first retains the original legacy identity result (4 tests, 3 passed and 1 failed), then passes the full 51-test suite with the documented temporary identity-assertion migration. All 39 authored source files match the frozen commit and remain unchanged. The disposable consumer patch records the loader/build integration and assertion adaptation. Verdant retains the original old-pin rejection, changes only the disposable upstream revision pin, then runs its unchanged producer and its original check for 20 artifacts.

The local sequence covers separately produced pinned artifacts and actual installation; the maintained CLI journey; ordinary framework mounts in Happy DOM; the original three Button families across four profiles; production cost receipts; the 23-row source-admission inventory; frozen real Shenko and Verdant consumption; an actual complete 47-package build; separate Tabs 13; and separate docs style generation and docs typecheck. Read the recorded terminal statuses before treating any stage as completed. The initial replay remains FAIL at worker initialization; the same-head follow-up reruns only the unchanged original Tabs 13 with --maxWorkers=1 --minWorkers=1 and then executes the two docs gates. A combined PASS does not relabel the original failure.

The official workspace typecheck is read back from run 45188583301 and artifact 14826253625. Its original receipt SHA-256 is b169a04ad9004030ee79d4194e638acd182376fc6e50941615e0285b5bf184c1. Docs types are separately executed locally. The aggregate check:types command is not claimed to have been rerun.

Unsupported source entries remain unsupported. Tabs 13 are not added to the fixed hosted 304. Cargo, desktop runtime, live backend and release acceptance are not claimed here. Root owns the final combination with full hosted inventory, visual evidence and independent product review.

## Redaction and integrity

The raw/ subtree contains copies of original JSON, logs, patches and orchestration records with only literal machine-path prefixes replaced. The originals remain unchanged in the task control area. Every transformed file has both original and public byte hashes in manifest.json; all numerical outcomes, diagnostics, input identities and historical failures are retained.

Placeholders such as $CONTROL, $PRODUCT_9D and $DEVICE_HOME are display substitutions. Published orchestration copies are provenance material and are not directly executable without restoring the original path mapping. An embedded executed-script hash identifies the original script bytes, while the manifest public hash identifies its path-redacted copy.

No node_modules directory, Git object payload or dependency installation payload is included.
