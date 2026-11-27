# Native scope fixture type narrowing

The source lane on 5006bd06a2cd570583dd4387cb1b3eff81932b38 passed all 778 controls, then failed strict types with TS2339: the native style element handle was typed as Node when the fixture assigned its id. The browser and production jobs in [run 45291425129](https://github.com/Proto-UI/Proto-UI/actions/runs/45291425129) had succeeded.

This test-only change verifies that the actual node is an HTMLStyleElement before assigning its id. An unexpected node still throws. It introduces no cast or any and changes no product code, selector, native input, assertion, timeout, worker count or budget.

## Actual validation

- All four selected native cases passed. The other 190 were filtered, and every passed title matched the four exact expected titles.
- The official corepack pnpm@10.32.1 check:types command completed normal style generation, workspace TypeScript and documentation checks with exit 0. Documentation reported 1330 files, 0 errors, 0 warnings and 47 hints.
- Normal Prettier checking and git diff --check passed.
- The first local attempt failed during log retrieval because its temporary filesystem was full, before changing source or starting tests. That failure is retained; it is not a product or type-test result.

## Evidence and limits

[The field-whitelisted receipt](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint5-native-scope-type-guard/receipt.json) records exact source hashes, commands, times, titles, counts and retained-original log hashes. Complete device logs remain retained separately; this commit uploads no execution directory or raw device log. The linked hosted failure remains unchanged, and the next exact-head source/browser workflow supplies public CI originals for this successor.

The production source and workflow remain byte-identical to 5006bd06a2cd570583dd4387cb1b3eff81932b38. Its successful production job is reused only for that unchanged product scope, not described as a new build. This record does not claim integration with the newer main branch or formal maintainer approval.

Source peer: Root. Executor and actual new commit identity: Codex <codex@openai.com>.
