# Shadow S3 six-cell replay: five passed, one original deadline failure

Date: 2026-11-23. Non-normative evidence; the complete native acceptance remains open.

The immutable replay used product source `a223be14a81bde0a819a96326ca25c59694193e9`, its actual public-package build, and the original S3 journey. It exercised the two locales and both `keepMounted` settings alongside the locale geometry cases. Five cells passed. English `keepMounted=true` completed its recorded interaction journey but exceeded the unchanged 150,000 ms whole-case deadline as it began the final 320 px viewport check. The cell is failed; completion of its inner journey does not turn it into a pass. The later split-marker ownership guard in `59649ef3` was not in this frozen source.

The standalone consumer uses the public producer's generated bundle and CSS. It is distinct from the official Astro page. Its extra initial diagnostic screenshot and tracing are inside the same deadline; it also does not install the official test's `framenavigated` listener. The replay therefore provides bounded native evidence, not a substituted official-CI result. There is no demonstrated hardware or concurrent-load cause for the final failure.

## Recorded timing

Times below are milliseconds from each cell's `goto` call. They are derived from retained Playwright trace actions; a missing viewport time means the geometry cell does not use that final interaction check.

| Cell | Navigation completed | Ready observed | Initial screenshot completed | Screenshot duration | Journey began | Final viewport check began | Last trace action ended |
| --- | --: | --: | --: | --: | --: | --: | --: |
| zh geometry | 5872.203 | 6991.905 | 7532.005 | 217.482 | 7535.218 | — | 8720.523 |
| zh keepMounted=false | 5235.061 | 6242.680 | 6618.204 | 82.337 | 6623.069 | 95053.669 | 95466.915 |
| zh keepMounted=true | 4563.691 | 5601.740 | 6036.953 | 134.070 | 6041.670 | 99814.334 | 100224.371 |
| en geometry | 7986.267 | 16226.926 | 16853.665 | 117.788 | 16858.149 | — | 18476.128 |
| en keepMounted=false | 5092.443 | 5955.399 | 6350.465 | 94.022 | 6354.705 | 105618.671 | 106067.033 |
| en keepMounted=true — failed | 22023.465 | 34124.534 | 41468.807 | 4702.495 | 42104.506 | 149639.944 | 151143.403 |

## Complete source and raw evidence recovery

The full archive is retained at this persistent device path:

```text
/tank/shared/projects/proto-ui-agent/seven-sprints-20261123-chvf1ono/shadow-replays-4deb-02/s3-delivery-06/shadow-s3-six-cells-2026-11-23.tar.gz
```

It is 131,371,847 bytes, SHA-256 `c7a46216243e03907f528ff5a2ff9fdfc55c8b8df8ffc5bd6b5d007888196b32`. Its 30 members contain 29 input artifacts plus the full receipt, including all six traces, screenshots, frozen app/CSS/journey/runner/build files, execution receipts and timing analysis. All 29 input members were decompressed and compared with their recorded SHA-256; the total uncompressed size is 134,353,664 bytes. The archive was not downloaded into the constrained local workspace or treated as a current-candidate pass.

The adjacent `receipt.json` is the complete member manifest, SHA-256 `1114c3841f8de34ae8941a0d73fc5d3502afee2a36cd325262b79b936f34abad`; `archive-receipt.json` records the archive hash and verification. The original expanded run remains in sibling `s3-attempt-06`, its timing details in `trace-timing-summary.json`, and its source in sibling `replay/s3-06`.

| Source artifact | SHA-256 |
| --- | --- |
| Official `apps/www/src/content/docs/zh-cn/demo-shadow-split-s3.browser.test.ts` | `267f97527acaae9071a9ecb9414f46619ea944f15827215c3e725e2b6c5baece` |
| Public `app.js` | `209c2d58e228abbc9d8bf862b4b2067de74fb9ebb2ad3c79ac56e7347965f531` |
| Generated `style.css` | `ca0b531ca7a1217b5d7b485e2ca5de7c3b0c66b6794880ab838838d4558dc537` |
| `journey.mjs` | `3e41a35c7558822dc822d247b703fe559ab0b767d865fd164ba5d88647e6a08f` |
| Replay `run.mjs` | `f8619dba2f6a6c1c4396c151eba93cd0e6598c32f6b012dc7ee42c86d73c8777` |
| Original source-delivery tar | `fd5dad77933d4f46bfe9dadc878df4bc2269e966bb63ae33ef99df7abcd46781` |

Chrome was 145.0.7632.6, executable SHA-256 `481fea1516a1f2b76454664272f12cd9dd1f20117b21e1f1498e08bc7f872c00`, launched with `--no-sandbox --disable-dev-shm-usage`. The execution ended at 2026-11-23 11:33:15 UTC with exit code 1. Original frame, geometry, focus, AX and lifecycle assertions were retained; complete original admission and current integrated-source CI remain required. The nine unsupported percentage/static Switch transforms remain visible in the original full-profile inventory gate restored by `9402b459`.
