# Numeric native CI bootstrap on a cold dependency cache

Date: 2026-11-23

This record reports a CI configuration failure and its bounded repair. It does not change a spec lifecycle or report a successful replacement CI run.

## Observed failure

The [Compiler GPUI source consumers run 45135018701](https://github.com/Proto-UI/Proto-UI/actions/runs/45135018701) checked out `7d3e9e6329afebc3cd6c361cb665f9304ceb05ca`. Its Linux job `137559144291` and macOS job `137559144275` both passed the generated 30-unit ordinary fixture, full locked GPUI/shared-SDK graph, default library build, and ordinary/delivery consumers. Both then failed before compiling the numeric accessibility consumer, during its first `cargo +1.98.1 metadata --offline --all-features` call.

Both job logs report `no matching package named accesskit_consumer found` in the crates.io index, required by the generated `proto-ui-gpui-native` SDK. The dependency was added for the SDK's real AccessKit consumer tests. The ordinary consumer graph treats the SDK as a dependency and does not resolve the SDK's own dev-dependencies; its successful locked graph and build do not populate this new numeric workspace's test dependency closure.

This is a cold registry-cache assumption in the numeric workspace bootstrap. The numeric, sequential-focus, SDK atom and subsequent Base Button/Label tests did not execute in those failed jobs; the earlier passing steps must not be reported as their acceptance.

## Bounded change

Remove `--offline` only from that numeric fixture's initial metadata command in `.github/workflows/compiler-gpui-source-consumers.yml`. This freshly generated workspace already uses a first, unlocked metadata resolution to admit its generated package identities; allowing it to retrieve declared dependencies is consistent with that phase.

The following full Cargo graph check remains locked. The numeric accessibility, sequential-focus and SDK test commands retain `--locked`, as do the ordinary and Base Button/Label consumers. Their configured GPUI source and revision, generated manifests, seed lock, production compiler and SDK code are unchanged. No missing dependency or failed test is skipped or converted into success.

## Validation and remaining evidence

Validation passed: duplicate-key-rejecting YAML parsing, `bash -n` for all 21 run blocks, Prettier for the workflow and this record, and `git diff --check`. A structural comparison against the observed source commit confirmed only the single numeric bootstrap argument removal; all other workflow jobs, commands, triggers and permissions match.

These are configuration checks, not a claim that the failed native jobs have rerun successfully. A fresh exact-head Linux/macOS run must still execute the numeric, sequential-focus, SDK and Base Button/Label gates and retain their receipts. The independent source-regressions job in the original run remains a separately reported result.
