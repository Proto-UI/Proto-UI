# Clean 124e Tooltip and Select follow-up

The executed commit was `124e329cfc3cd710c1f1d267d640f1b97ef2f4c9`, tree `c2de370edb9b98a5482556ee433017fbd6bbd258`. The checkout was clean before and after execution. Node was 24.22.3 and pnpm was 10.32.1. Installation used the frozen lockfile; the actual CLI build and documentation style generator ran before the server started.

The unmodified `contrast-tooltip-warm-handoff.browser.test.ts` passed **20/20**. The retained 300 ms handoff budget and negative controls were not changed.

The original `audit-brutalist-contrast.mts` Select matrix passed **8/8** runtime and theme cases, with **96/96** PNG/fact pairs and target predicates, no missing planned targets, and no unresolved cases. This is the selected Select audit, not a whole-family accessibility conformance result.

## Preserved failed invocation

The first combined attempt ran the Tooltip Vitest suite while the audit server was alive. Vite's temporary `vitest.config.ts.timestamp-*.mjs` file correctly invalidated the source watcher. Tooltip finished successfully, but the subsequent Select audit returned HTTP 409 before capturing any frames. Its report, logs, and exit code remain under `124e329/` in the archive.

The successful Select attempt started a fresh, clean audit-only server after Vitest had exited. It did not bypass, filter, or reset the source watcher. Its original source-bound report and exit codes are under `124e329-select-only/`.

## Evidence

`native-receipts.tar.gz` contains the original reports, process logs, source readbacks, generated-style provenance, and a SHA-256 manifest for all 640 raw files. Its SHA-256 is `e963de22f59ecb8dfd32599a1f5f0627a706ebb40ddc22d974b698e391e6125a`. The 96 PNGs and per-frame detailed fingerprints remain in the manifest's recorded raw directory on the execution device. The archive includes the full successful report; it does not claim to contain those image files.

These are original native local runs on an exact clean commit. They are not GitHub Actions receipts or the two retained scheduled release cycles.
