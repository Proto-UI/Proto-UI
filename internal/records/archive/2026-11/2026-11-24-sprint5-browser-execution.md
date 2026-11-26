# Sprint 5 browser execution: source-bound WC ownership and original setup failure

Both actual runs below used source `0b7b212d3193ea5c7ae219c0501036ee1255e3f2`, Node 24.22.3, pnpm 10.32.1, frozen dependencies and sandboxed Chromium 145.0.7632.6. They have distinct acceptance boundaries and complete original archives in the [manifest](evidence/2026-11-24-sprint5-browser-execution/manifest.json).

## Generated WC SSR ownership: 4/4

The real emitted server HTML and client bundle passed all four original browser scenarios, with zero skipped and no page errors:

1. Reconnect from `unmounted` retires the old State, exposes no overlapping active owner, and creates/mounts one replacement whose real visible value updates to 9.
2. Reconnect from disposal preserves the same fresh-owner guarantee; an old callback does not retire the replacement.
3. Terminal disposal during reentrant reconnect leaves no owner or output and rejects later props.
4. Removing and reinserting in one checkpoint preserves the existing owner/State and avoids redundant lifecycle callbacks.

The source-bound [receipt](evidence/2026-11-24-sprint5-browser-execution/owner-receipt.md) includes generated-artifact hashes and inspected screenshots. The raw archive is 68,478 bytes, SHA-256 `ea57527093c90a7ebe634a2dd2ba6d6f7e0190c889a0444016dd99f4902db861`. Its two earlier setup failures executed zero tests because `/tmp` was full. The successful run changed only this task's TMPDIR to available project storage. No other user's files or processes were removed and no browser sandbox was disabled.

This evidence covers the private emitted WC scenarios. It does not admit a public SSR profile, certify React/Vue consumers, or establish the separate browser Compiler preview deadline.

## Original canonical production baseline: zero page journeys

The [separate production receipt](evidence/2026-11-24-sprint5-browser-execution/production-setup-receipt.md) records a failed setup. The original whole-website build generated CLI assets and many Astro source assets, then reached its unchanged 20-minute resource bound (1,200,515 ms; SIGTERM; resource-deadline). The outer runner exited 1; no page journey executed. Real CJK fonts were present. This run supplies no observation for the 250 ms preview retirement contract.

Its original 117,333-byte archive has SHA-256 `e5db80fc0aa74cdb7c8a4a5a60cf86034920f6dfefd0086a77df7089e28923a6`. Partial production output is not accepted as a production artifact. Later hosted results remain bound to their own public source and cannot retroactively change this outcome.
