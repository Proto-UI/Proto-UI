# Compiler source regressions and public Input evidence lane

Date: 2026-11-23

This is an engineering record, not a spec lifecycle change or a successful CI receipt.

## Gap and chosen scope

The main CI intentionally skips expensive suites on pull requests. Its exact-ref dispatch runs a broader repository cycle. The existing dispatchable compiler workflows cover focused fixture sets; `.github/workflows/compiler-gpui-source-consumers.yml` previously ran the Linux/macOS native consumer matrix and the two headless Rust source suites, without the complete compiler source directory or workspace type checks.

Add the `source-regressions` Linux job to that existing dispatchable/reusable workflow. Keep the native consumer job unchanged. This avoids another workflow trigger, another schedule owner, or an unrelated full-repository test/release run.

## Executed scope when dispatched

The job uses Ubuntu 24.04, Node 24.22.3, pnpm 10.32.1 with `--frozen-lockfile --ignore-scripts`, and Rust 1.98.1. It sets `ASTRO_TELEMETRY_DISABLED=1`, `NODE_OPTIONS=--max-old-space-size=4096`, and `PROTO_UI_REQUIRE_RUST_DATA_TESTS=1`. The installed Chrome/Chromium must be discoverable; missing browser or Rust execution is a failure.

In order, it generates the website styles, checks workspace and documentation types plus the type contracts, runs the complete `packages/compiler/test` directory with one worker, exercises the actual public Base Input page in two languages and four runtimes, and runs the related Input registration tests plus lightweight public-docs, prototype-catalog and schema-fixture checks. The job has a 45-minute overall timeout; compiler and public Input steps have 25- and 15-minute bounds.

The public Input JSON report must contain exactly eight passed tests and no failures, pending tests or todo tests. Compiler collection uses its normal source configuration without a filtered fixture allowlist. Existing conditional Dart/Flutter and historical corpus-capture skips remain explicit in the saved JSON and skipped-test inventory; running the complete directory is not evidence that those additional native tools or historical modes executed.

## Evidence and failure boundaries

The artifact includes checkout commit/tree identity, manifest and lock hashes, the workflow used, actual installed tool versions, bounded environment facts, before/after tracked source status, and each command's shell-quoted argv, output, start/end times, command exit and log-writer exit.

The wrapper returns a failing command or log-writer exit unchanged. No test step uses `continue-on-error`, a success fallback, or a missing-tool skip. Always-run step outcomes and artifact upload preserve failure, cancellation and later skipped steps; a missing command exit receipt is incomplete evidence, never a pass. The final evidence upload requires files to exist.

This lane does not establish OS-visible GPUI interaction, Dart/Flutter execution, all-browser conformance, release readiness or spec activation. The existing native Linux/macOS jobs retain their separate evidence boundaries.

## Validation status

Configuration validation passed on the recovered Input-docs candidate:

- YAML parsing with duplicate-key rejection, `bash -n` for every new run block, and a structural comparison proving the existing native job, triggers, permissions and concurrency are unchanged.
- `node scripts/ci/check-ci-schedule.mjs`.
- The four CI policy test files used by the main configuration gate: **70 passed, 0 failed, 0 skipped**.
- Public documentation checking, Prettier and `git diff --check`.

`actionlint` was not installed and was not claimed as executed. No heavy compiler or browser suite was run for this configuration-only change. A successful exact-source GitHub run and its artifacts remain required before claiming the new lane passed; local reconstruction or earlier partial suite results cannot substitute for that run.
