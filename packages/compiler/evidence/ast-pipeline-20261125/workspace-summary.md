# Workspace type-check validation

## Result

Command: `corepack pnpm@10.32.1 -s check:types:workspace`.

| Checkout/environment | TypeScript errors | Exit |
| --- | --: | --: |
| Clean baseline `73ff284730c4b93a8c145bd23a4ab0370edec9a1` | 0 | 0 |
| Current isolated checkout before environment repair | 718 | nonzero |
| Current checkout after dependency links were completed | 2 | 2 |
| Current checkout after ignored generated style artifacts were supplied | 0 | 0 |

There are no additional real workspace type errors relative to the clean baseline.

## Environment repair

Dependency entries were supplied for 59 existing workspace packages from the baseline's already-installed dependencies. Every `node_modules` directory body is a real ignored directory. Third-party entries use the existing dependency store; workspace package links resolve to the current isolated source checkout. No dependency source, business source, or type/lint suppression was changed. The baseline's tracked worktree and index remained clean.

The two remaining TS2307 diagnostics were imports of `apps/www/src/styles/proto-ui-shadow-style.generated.js` from `scripts/analysis/fixtures/shadow-s3/admission.ts` and `scripts/analysis/fixtures/shadow-s4/dialog.ts`. The JavaScript artifact and its declaration are explicitly gitignored and were absent in the isolated checkout. They were supplied byte-for-byte from the same clean baseline's generated output:

| Ignored generated artifact | SHA256 |
| --- | --- |
| `proto-ui-shadow-style.generated.js` | `67e3e6adf39453463137e6f1fb16e58af52c4098d5f5e40a40be0cddaeafb29f` |
| `proto-ui-shadow-style.generated.d.ts` | `76d772bac1c5de84e6fb455683513c74c6d40b55de2744caaf3dfc4e4ead94b8` |

## Official style-generation attempt

`corepack pnpm@10.32.1 --filter apps-www generate:proto-ui-style` was attempted in the background with a 120-second limit. CLI init documentation extraction and theme generation completed, but the full command did not finish within the limit and was terminated with exit 124. No process remained in that job's session. This receipt does not claim a completed fresh style-generation run.

The two shadow-artifact hashes above remained unchanged before and after the attempt. The tracked `proto-ui-style.css` also remained unchanged, and the core/style/CLI/prototype/website source trees had no changes relative to the baseline. The successful current typecheck therefore used the verified same-baseline generated artifacts, rather than a completed fresh regeneration.

## Raw receipts

- `workspace-current.txt`: successful current workspace typecheck.
- `workspace-baseline-73ff2847.txt`: successful baseline comparison.
- `workspace-style-generation.txt`: bounded official generation attempt and hashes.

The detailed dependency-link audit remains at `/tmp/pui-workspace-dependency-links.json` on the validation workstation and is not part of this Git evidence set.
