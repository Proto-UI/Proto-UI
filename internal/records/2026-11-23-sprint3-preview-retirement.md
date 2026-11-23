# Sprint 3: verify preview retirement before replacement

This bounded continuation for [PR #1713](https://github.com/Proto-UI/Proto-UI/pull/1713) starts from `1658768483ba5d81e4502a64945fe5c0a21dda1d`. It adapts the reviewed [Sprint 5 preview repair](https://github.com/Proto-UI/Proto-UI/commit/d985f1a67) without copying that branch's GPUI changes or replacing Sprint 3's production browser receipts.

## Reproduced defect and correction

The old Sprint 3 host sends its sole `dispose` message before an immediately retired child necessarily has a listener. It also resolves the retirement promise at 250 milliseconds without requiring the child acknowledgement. Removing the frame is not evidence that authored cleanup completed. The full ten-case protocol suite ran against that unchanged implementation: **2 passed, 8 failed, zero skipped**. Seven failures observed a promise resolving instead of rejecting without acknowledgement; one observed the premature disposal message.

The child now announces listener readiness after installing the existing disposal handler. The parent accepts that announcement only from the current opaque iframe with the matching token and revision, then sends retirement once. The original 250-millisecond budget begins immediately and never restarts on a late handshake. A missing acknowledgement rejects after reclaiming the frame/listener; a real acknowledgement preserves any cleanup failure. Completed retirement cannot be revived by late signals.

The existing production browser probe still checks denied access to the parent document, local storage and cookies. Its three explicit try/catch blocks replace the nested named helper that introduced an unavailable transpiler `__name` reference when the callback was serialized into the iframe. All other Sprint 3 runner content, source/delivery seals, target journeys and production receipt assertions remain unchanged.

The selected direction is traceable to draft `C-LIFECYCLE-OWNER-INITIALIZATION-0001` criteria D/E/G and `C-LIFECYCLE-0002` G/K. This patch changes no entity lifecycle and establishes no public SSR or arbitrary state migration guarantee.

## Executed evidence and remaining boundary

- The same complete ten protocol cases passed **10/10**, with zero skipped, after the repair. The fixture injects messages and time through happy-dom; it is not native-browser execution.
- The browser client, revision session and retirement protocol integration selection passed **23/23** across all three intended files, zero skipped. This includes the ten protocol cases above and retains explicit failed-retirement propagation before replacement.
- Production receipt, delivery-index and real relocated-assets controls passed **35/35**, with zero failures or skips. The relocated-assets control bundles and executes actual source/target assets from a different caller working directory.
- Node **24.22.3**, frozen/offline **pnpm 10.32.1**, a single Vitest worker and a 1.5 GiB Node heap bound were used. Prettier and `git diff --check` succeeded.
- The reviewed Sprint 5 sandbox and protocol-test sources are byte-identical to this candidate. The browser runner is adapted only at the sandbox callback, retaining Sprint 3's additional production behavior.

The [manifest](evidence/2026-11-23-sprint3-preview-retirement/manifest.json) binds source hashes, commands, baseline/candidate counts and a byte-preserving archive of raw results. The original old-head [acceptance run](https://github.com/Proto-UI/Proto-UI/actions/runs/45202101258) remains historical. Its compiler lane passed its source controls but failed while installing CJK fonts before the production journey; no product or browser pass is inferred. New-head native/browser acceptance, the other direct and installed consumers, and normal independent review remain separate requirements. No old failed receipt, 250 ms deadline, sandbox guard or assertion was weakened.
