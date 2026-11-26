# Release-gate preset manifest refresh

## Observed failure and ownership

The Finf workflow at `7987860bf4fde0f5bc679f77893b7b66c66bb8b1` ([run 45552801955](https://github.com/Proto-UI/Proto-UI/actions/runs/45552801955)) failed its actual preset-generation check because the committed Shadcn token manifest retained `rounded-[min(var(--radius-md),12px)]`. This is a generated projection repair; it does not change a prototype contract or add a parser exception.

## Regeneration and independent readback

The official `styles:preset:generate` and `check:styles:preset` commands both completed with exit code 0 using the committed CLI implementation and the exact eight Liquid source changes already committed in `9d5fb5b19`. The second command checked Shadcn, Brutalist, Draft families and the motion palette. The full raw receipt, commands, input hashes and original output are retained in `evidence/2026-11-25-release-gate-preset-refresh/official-preset-generation.tar.gz`.

Independent review compared all 1,671 recorded generator input hashes against the committed `8b44c62992a5a3de560c02165bf650d2fe6f6ec7` tree: no input differed. The Shadcn output was copied byte for byte from the generator and has SHA-256 `6c38aa349934aa504c38d04c35c373d5388cd7f146e215614290e99f62ba2dce`. Its sole difference is deletion of the stale token. The other four output hashes already match the committed candidate. No generated file was hand-edited.

## Remaining boundary

This closes the reproduced stale-manifest defect for these inputs. It does not claim that the earlier Finf workflow passed, or that its independent browser failures are resolved. Later CLI or prototype changes require regeneration and the ordinary complete CI checks on their resulting source.
