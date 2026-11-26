# GPUI external Scroll observation after physical viewport clamping

## Defect and bounded repair

A retained external viewport can be a later sibling of its compiled owner. GPUI applies a wheel delta before that viewport clamps it during prepaint. The owner's tail prepaint callback could observe the temporary overscroll first, consume the reader-input mark and incorrectly resume end-follow even though the physical viewport ultimately did not move.

The tail canvas remains present. Its callback now reads the current builtin-projection flag at execution time, stores the boolean so the RefCell borrow ends, and performs the tail observation only for the builtin viewport. External observations retain the existing paint callback after all prepaint. This also preserves legal binding replacement between render and callback.

This implements the existing draft [end-follow pause contract](../../spec/contracts/C-SCROLL-END-FOLLOW-0001.yaml); it does not change its lifecycle or authorize raw/clamped input as reader arrival.

## Actual source and regression

The executed parent was 3d69ba8b3ca877e4b36227e4f8f3c53649f30a49, based on fixed 0b7b212d3193ea5c7ae219c0501036ee1255e3f2 plus the separately validated external_scroll producer restoration. These are not results for a newer remote PR head.

The four original reader test bodies remain byte-identical. The fifth case uses the same native wheel helper and a real later sibling viewport over the owner's physical bounds. It retains the original owner-bounds, clamped-offset and viewport-geometry assertions, then checks pause, append, real arrival and later following. No ScrollHandle offset or observation is assigned.

- Owner before SHA-256: 41c7ad5a4bc33882e2c88b1db02d1f8dd2dce0e3c480ac2f7a93bfa6e2e538ce.
- Owner after SHA-256: e5050fda084fd3d831fea7fff83186f110278da0e7684e273b001732d06d7f07.
- Reader before SHA-256: 436ff5b882f0e1367895f8f4c30e6cd54ab3fc8d2e9e573ebad5b29c20efb5c5.
- Reader after SHA-256: 8e8ed8d5f994163f491fcd9ae91062667d4c5622553e2f87898ead8c6512fd21.

## Actual red and green

On the unchanged SDK, the complete five-case target finished on 2026-11-23 at 20:42:04 UTC with **4 passed, 1 failed, 0 ignored, 0 filtered out**, exit 101. Only the new sibling case failed: actual following versus expected paused, after its physical geometry and unchanged final offset assertions had passed. This was an assertion failure, not compilation, setup or timeout. Red source hashes were stable.

After the sole callback condition repair, the complete reader target passed **5/5** and the complete ordinary target passed **46/46**, with zero ignored or filtered cases. Standard producer, locked dependency graph and default SDK library checks also passed. The green batch took **79.361 seconds**, 20:43:41 to 20:45:01 UTC, with stable source hashes throughout.

| Green stage       | Started (UTC)                    | Finished (UTC)                   | Exit |
| ----------------- | -------------------------------- | -------------------------------- | ---- |
| producer          | 2026-11-23T20:43:42.633916+00:00 | 2026-11-23T20:44:01.567329+00:00 | 0    |
| locked-graph      | 2026-11-23T20:44:01.590731+00:00 | 2026-11-23T20:44:02.508250+00:00 | 0    |
| default-sdk-check | 2026-11-23T20:44:02.533834+00:00 | 2026-11-23T20:44:06.659992+00:00 | 0    |
| scroll-reader     | 2026-11-23T20:44:06.684802+00:00 | 2026-11-23T20:44:53.806471+00:00 | 0    |
| ordinary          | 2026-11-23T20:44:53.894750+00:00 | 2026-11-23T20:45:01.080153+00:00 | 0    |

Both runs used actual Node 24.22.3 and Rust/Cargo 1.98.1, GPUI revision 62e5991dd0f0c8a3af8d5e7e9c4652490d468db8, locked Cargo manifests, one build job and zero development/test debug level. Each bounded native batch retained the original 45-minute job limit. The producer regenerated every output; no generated Rust or Cargo lock was edited. Normal repository Prettier left the authored owner patch unchanged.

The reader target command was the original full-target command, with no name filter:

    cargo +1.98.1 test --locked --manifest-path "$OUT/generated/transition/Cargo.toml" --features test-support --test scroll_reader -- --test-threads=1 --nocapture

The green batch also ran the full ordinary target and original default SDK check. Exact argv, environment and source guards are in the archived receipts. This is Linux native framework event evidence, not physical OS input or a macOS run.

## Preserved evidence

[Execution archive](evidence/2026-11-23-gpui-sibling-scroll-clamping/executed-validation.tar.gz) contains both raw runs, their drivers/receipts and the precise source before/after patches.

- Archive SHA-256: b93a868f54f20bca7bcdc1821a724048fec751be00c99eb476031c87378ecff4.
- Red reader log SHA-256: ec044fcdb2fb3f2d8cb71bb4e2c0c491da8dadfa5a4f5e893e224c3a256f1299.
- Green reader log SHA-256: ea6f0900239be6f8cf101d937edc9ba7d2a28b6616f90b5a585131fcb0568fd8.
- Green ordinary log SHA-256: 1869911051b0f11f84d9e1537716daf3abf010e78135e9d2daa27c1e115bb8fb.
- Green status SHA-256: f99692715f6221265530f41d7a9725570c4e7485cd329b7966fecdd779356eec.

ControlLabel action-lease and browser diagnostics remain separate work. No remote branch, review, check status or specification lifecycle is changed by this record. Commit-hook results are recorded separately from native execution.
