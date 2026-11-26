# Runtime merge-regression evidence

See the [repair record](../../2026-11-24-runtime-merge-regression.md) for the source-bound diagnosis, executed results and limits.

The `.gz` files preserve original bytes. Use `gzip -dc <file.gz>` to inspect them; `manifest.json` records both compressed and original SHA256 values. Original failed controls and draft findings are retained alongside the repaired candidate. The full runner result is 149 passed, zero failed or skipped, on Node 24.22.3/Linux; this is contributor-controlled execution evidence, not a native CI attestation or platform approval.
