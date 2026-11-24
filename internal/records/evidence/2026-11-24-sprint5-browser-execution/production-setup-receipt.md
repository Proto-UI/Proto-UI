# Original production browser baseline: setup resource deadline

**Failed setup; zero page journeys executed.** Source `0b7b212d3193ea5c7ae219c0501036ee1255e3f2`, tree `84abbfdb50ec64bfd36f09f906bda10b43752f4b`, lock SHA-256 `6e21c4b8444ca5e4a2e427287a76a346137b65d76403579942269bfea1fc7fe8`. The checkout was clean before the build and on post-run readback.

The actual canonical production runner launched Chromium 145.0.7632.6 with its OS sandbox enabled. It then ran the original whole-website production build. CLI generation produced the real init files, the theme and a union of 1,455 package/website tokens. Astro proceeded to generate the full source-asset inventory. At 1,200,515 ms, the runner’s unchanged 20-minute build bound terminated the owned build with SIGTERM (`stopReason: resource-deadline`, `exitCode: null`, no spawn or I/O error). The outer runner exited 1 and recorded only the failed `setup` case.

The final build log is 436,717 bytes, SHA-256 `1376803e8badea92d004d9c838eb6070516740cd9246fd682e0a8caba9b929d2`. Its final output reached Shadcn Data Table source assets. Partial output is not accepted as a finished production artifact. No page was used to test preview retirement, editing/recovery, cancel/reopen or module-Worker cleanup/integrity. In particular, this run supplies no success or failure observation for the original 250 ms preview cleanup contract.

Node was 24.22.3, pnpm 10.32.1, and the fresh frozen install log is retained. Noto Sans CJK SC was actually present according to `fc-match`. Only the task-owned TMPDIR on the project filesystem was used, after the separately preserved /tmp ENOSPC failures. The post-run environment records 32 logical CPUs and the observed load average; it does not establish the cause of the long build. No other seat/process was stopped, and no browser sandbox or acceptance deadline was weakened.

`raw.tar.gz` contains 14 files, including canonical receipt, complete production build log, production manifest, outer log/status, exact command script, frozen install log, relevant source scripts, member hashes and post-run environment. SHA-256 `e5db80fc0aa74cdb7c8a4a5a60cf86034920f6dfefd0086a77df7089e28923a6`, 117,333 bytes.

The independent generated WC SSR owner browser result at the same source remains 4/4 with its own artifacts. The next source must be confirmed by root before checkout. Native direction and target-owner controls can run separately; the full production journey still needs execution on the independent hosted lane with the original contract.
