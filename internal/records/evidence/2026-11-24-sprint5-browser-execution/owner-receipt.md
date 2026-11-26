# Generated WC SSR owner browser receipt

Source: `0b7b212d3193ea5c7ae219c0501036ee1255e3f2`. Result: **4/4 passed, 0 skipped, exit 0**, on Chromium 145.0.7632.6 with the Chromium sandbox enabled. The fixture compiled its real source, served the emitted SSR HTML and actual generated client bundle over loopback, then asserted real browser adoption and ownership.

| Scenario | Observed result |
|---|---|
| Reconnect from `unmounted` | Original server output adopted; old State retired; reentrant reconnect sees no active owner; exactly one replacement created/mounted; replacement State and paint update to 9. |
| Reconnect from `disposed` | Same replacement guarantees, including new owner and State identity, no old callback closing the new lifetime, and visible update to 9. |
| Terminal disposal during reconnect | Old State retired; owner remains null; props rejected; no replacement created; no retained output in the screenshot. |
| Remove and reinsert in one checkpoint | Owner and State identity retained; no extra unmount/dispose/create/mount; real State and paint update to 9. |

All four pages recorded no page errors. The two distinct screenshot contents were visually read back: the active replacement shows 9, and terminal disposal shows only the page heading. `disposed.png` and `same-checkpoint.png` are byte-identical to the inspected active screenshot.

## Provenance and original failures

`raw.tar.gz` contains all four JSON/PNG pairs, generated client bundle, artifact hashes, source prototype, exact browser fixture and harness, frozen dependency install log, complete final Vitest log/report/status and command script. SHA-256: `ea57527093c90a7ebe634a2dd2ba6d6f7e0190c889a0444016dd99f4902db861` (68,478 bytes, 26 members). Its member hash inventory is `raw/export-manifest.json`.

Two earlier attempts are retained as failed setup. Both exited 1 and executed zero tests; the empty JSON reporter success flag does not make them pass. The second default-reporter log identifies `ENOSPC` while Vitest wrote to `/tmp`. Readback showed `/tmp` at 100% with zero available bytes, while the project filesystem had capacity. Only this task's `TMPDIR` was moved to `/tank/shared/projects/proto-ui-agent/sprint5-f7b2/t`. No other files or processes were removed, no browser sandbox was disabled, and no source assertion or timeout was weakened.

The successful execution used Node 24.22.3 and pnpm 10.32.1 after a real frozen install in its isolated checkout. The remote checkout stayed at the exact source above throughout.

## Acceptance boundary

This is evidence for the four private emitted WC SSR adoption/retirement scenarios. It does not establish public SSR target admission, React/Vue adoption, all request/concurrency/serializer cases, all owner combinations, or the browser Compiler/Worker 250 ms preview cleanup contract. The original canonical production browser journey is being run separately with its own source-bound receipt.
