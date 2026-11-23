# Sprint 1 #1453: real Shenko Props consumer evidence

The real frontend candidate passed its normal independent build and native application journey at `5fc654aad3487d275cbe5642dc060db4795e68d8`, [run 45260827225](https://github.com/cyjin-yl/shenko/actions/runs/45260827225). The CSS repair and observer are delivered in [Shenko PR #403](https://github.com/cyjin-yl/shenko/pull/403), currently Draft; this is not a claim that the repair has merged to Shenko main. The existing lawful Props watcher remains unchanged.

## Actual consumer and provenance

The application is `cyjin-yl/shenko`, based on main `0e202f7aaecafc6ec761504dfb23cac437ee3e5e`. Its real `TransportBadge` in `crates/shenko-ui/web/src/ui-kit.tsx` consumes the authored `web/prototypes/transport-badge.proto.ts` compiled by the normal build. The source still contains the lawful `def.props.watch(['label'], run => run.update())` introduced in `8a3f2fa1f002d3317bed21b7985b2f77739ccc10` / merged PR #293. There is no `key={label}` remount. The App uses its ordinary `main.tsx`, renderer, LiveController and SocketTransport.

The frozen Proto-UI pin is `ad39435aeb3589d3bc52de3cbd1f4cdd375cec68`; the source lock digest is `e374ba03f76079fd191d63c2da1f62861b7e90bbeba64a0b310027fc2c15b7f8`. This actual application uses React/React DOM 19.3.1. The existing six-cell comparison at the admitted 19.2.6 target remains separate evidence; this application run does not silently relabel its consumer version as the admitted target. The build selects Node 24.22.1, pnpm 10.32.1, TypeScript 5.9.3 and esbuild 0.25.12. The browser observer selects playwright-core 1.58.2 and uses native sandboxed Chromium as a non-root runner user.

## Original evidence and failures retained

1. Main CI run `45145308858` passed all six required jobs. Its web job `137593027871` executed the normal frontend pipeline, 51 Node tests, and independent reconstruction of 12 hashed assets. The unrelated Nightly run `45176253886` on the same main source failed; the main CI result is not a claim that all workflows passed.
2. Observer commit `2ab0b0975af5cd47089338cc7d60721e0d2ddf4d` produced run `45258057568`, which failed workflow configuration before any job started. The initial job-level `runner.temp` expression was invalid; assigning the directory inside a runner step fixed that configuration. No browser failure or browser execution is attributed to this zero-job run.
3. Commit `cf606606aed700b620c19e9afe9069b60e4800f0`, run `45259108229`, actually executed native Chromium 157.0.8103.78. The first Connected observation had the correct label and online style token, the original root and dot nodes, and a visible 64.625 × 24 root, but the dot was 0 × 14 and not visible. Its screenshot independently shows the missing dot. The same receipt also retains a 404 for the fixture's missing `/health` response. Later transitions did not execute in this failed run. The raw artifact ZIP SHA-256 is `10c8471ef455128db3ce4ece76504a0ceccab255578b5e59398ceefe8e44c5a6`.

The dot failure is a consumer CSS defect, independent of the lawful Props watcher. The compiled host is a styled outer `div`; the authored template is an inner `span` with the `i` dot and text. Applying flex only to the outer host did not give the inner inline `i` its declared 6 × 6 box. Source commit `bee0ab531e718ca026b68ba7581f98a734fabf31` makes only this authored inner row `inline-flex`, aligns its children and inherits the existing gap. It does not change the Prototype, generated update policy, node structure, or observation thresholds. The fixture now serves `/health` with the exact status/product/version DTO in `crates/shenko-ui/src/routes.rs`.

## Normal product build and native successor

The first source-fix build, run `45260272021` at `bee0ab531e718ca026b68ba7581f98a734fabf31`, executed the normal build and then correctly failed its comparison against the old committed CSS. Its only three differences were the CSS byte count, CSS hash, and CSS payload bytes. The native consumer was skipped. The original failed comparison, source inputs, all generated assets and job log remain retained; this is not counted as a successful gate.

Commit `5fc654aad3487d275cbe5642dc060db4795e68d8` adopts that producer's 13 files byte-for-byte: 12 assets and their real manifest. Only `static/app.css` and `static/build-manifest.json` changed in Git. Before adoption, every current frontend source input was checked against the producer's admitted inputs, and the CSS source equaled the actual generated CSS. No manifest fields or digests were manually rewritten. The adoption receipt preserves the source, original failure, artifact identity and every copied file digest.

At the resulting commit, the existing `scripts/ci/web_assets.py prepare/check` producer ran again in `node:24.22.1-bookworm`, using the original pin and public package closure. Type checking, 51 frontend Node tests, the existing eight DSH bridge controls, and independent reconstruction of all 12 assets passed. The producer's comparison has zero differences, including stable Compiler/Prototype provenance. Its job is `137994804288`, artifact `14861135664`, ZIP SHA-256 `a283544da5c10994df8e50adb0c7faee2d8e2a56ceed3408d321dd09c4e1518c`.

The native job `137995859916` depends on that exact producer succeeding. It checks the same run and source, the comparison's empty error set, the exact committed manifest digest, every rebuilt payload, and frontend source hashes before loading the actual application. Its 17 checks passed with seven independently recorded phase observations:

| Observation | Text and tone | Retained nodes and visible geometry |
| --- | --- | --- |
| Initial connection | Connected / online | Same root and dot; dot 6 × 6 |
| First close | Reconnecting / reconnecting | Same root and dot; dot 6 × 6 |
| First real reconnect | Connected / online | Same root and dot; dot 6 × 6 |
| Second close | Reconnecting / reconnecting | Same root and dot; dot 6 × 6 |
| Second real reconnect | Connected / online | Same root and dot; dot 6 × 6 |
| Actual theme button selects dark | Connected / online, dark palette | Same root and dot; dot 6 × 6 |
| Close before retirement | Reconnecting / reconnecting, dark palette | Same root and dot; dot 6 × 6 |

There were three actual browser WebSocket instances: the original connection and two replacements. Each replacement followed the real SocketTransport's first retry interval; no timer or scheduler was stubbed. Online and reconnecting computed colors changed and restored as expected. After the synthetic `pagehide`, the real application removed both original nodes and opened no fourth socket during the following 1,500 ms. There were no page, console or fixture-server errors. All ten observed source hashes matched before/after and were independently checked against the committed source; the downloaded producer input/comparison digests also match the native receipt.

The original native artifact `14859473954` is retained as ZIP SHA-256 `2a836b673663a36bb8442edbb61c0b0c44b99d9cd89eeb116279ab60b314ce0f`. It includes the successful normal producer's complete original payload as well as native observations and images. This avoids relying on the workflow's green status alone.

## Raw-image review

The original 1280 × 900 captures were opened separately from the automated checks. The light Connected frame shows a visible green dot and intact label; Reconnecting shows the amber dot and changed label without overlap or clipping; the dark Connected frame retains the green dot and intact text in the dark header. The failed predecessor's frame shows the original missing-dot defect. This is a bounded visual review of these captures, not a contrast-ratio measurement or AT claim.

An independent reviewer (`/root/lifecycle_audit`) also opened all three original images and accepted this bounded visual scope: the green/amber/green dots are visible to the left of the complete state labels and vertically aligned; the status, right-side tools and center navigation do not overlap or clip; the dark theme visibly differs from the light frames. No rebuild or observer change was needed for that review.

The images and complete original receipts are linked from [the evidence index](./evidence/2026-11-24-shenko-props-application/receipt.json). Unmodified reviewable images are retained beside the compressed original ZIPs and logs.

## Observation boundaries

The HTTP and WebSocket fixtures terminate at the real application's network boundary. They do not replace React props, the controller, generated internals or update scheduling. Connection/reconnection observes the actual transport, actual authored label updates and rule-driven tone styles. The original badge root and authored dot are retained across those transitions and a real theme-button interaction. Visibility, geometry and computed styles are explicit automatic observations; saved screenshots need an independent visual read.

The actual App does not expose a public badge handle, and this authored badge has no external slot. Its DOM nodes and authored child are observed here; the prior six-cell fixture's public-handle/external-child/lifecycle evidence remains the appropriate evidence for those exposed surfaces. A synthetic `pagehide` on a still-live realm exercises the App's real installed cleanup and pending reconnect cancellation. It is not a trusted OS lifecycle event, Rust/backend acceptance, deployed-server acceptance, physical-input evidence or AT validation. These limits do not replace or enlarge the original bounded Props issue.

The exact scheduling owner and compatibility disposition are recorded separately in `2026-11-24-props-update-owner-binding.md`. This application work does not activate lifecycle drafts or alter the Runtime Adapter and Compiler defaults.
