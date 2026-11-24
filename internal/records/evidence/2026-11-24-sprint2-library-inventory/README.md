# Whole-library inventory runner validation

See the [complete execution and boundary record](../../2026-11-24-sprint2-library-inventory.zh-CN.md).

`validation.json` binds the actual two-entry, twelve-compilation sample, its unchanged earlier rows after resume, the incomplete-universe merge and the rejected overlapping merge. Every archive member was read back and hashed. `small-sample.tar.gz` contains the complete bounded run: plan, full-universe partial report, durable rows, closures, actual emitted-file metadata, worker requests/resources/process statuses and raw command streams.

The compressed executed runner is reconstructed to exactly the SHA recorded by the original plan. The later code change only tightened the ratchet for removed unsupported rows; its final three tests are retained separately. This distinction prevents reporting execution against a different script version.

The original 394-entry history ledger lives at [library-profile-history-35195a6.json](../../../compiler/library-profile-history-35195a6.json). Its real source bytes were recovered; original 5/394 outcomes were not replayed or rewritten.

This sample is not a full sweep of the final integrated source. Unexecuted rows remain `UNTESTED`, and unimplemented public profiles remain declaration-only.
