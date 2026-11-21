# Axis synthetic layout fixture correction

This record concerns four test fixtures based on `f0b502704b825b5b644639522555d13e3d64231e`. It changes no product code, admission rule, timeout, expected value or authored case. `C-AXIS-INPUT-CONTACT-BASIS-0001` and `T-AXIS-INPUT-CONTACT-BASIS-0001` remain draft; their lifetime cases still require separate native and compiler evidence.

## Observed failure and owning layer

Native run [44956263999, attempt 1](https://github.com/Proto-UI/Proto-UI/actions/runs/44956263999), runtime job [137005019953](https://github.com/Proto-UI/Proto-UI/actions/runs/44956263999/job/137005019953), completed all 1,778 files. Twenty-five formerly passing assertions newly failed: four Adapter extent-cancellation cases, eleven Carousel cases, seven Resizable cases and three Drawer-auto cases. All seven affected test files were unchanged from e775; the corresponding host and tests matched accepted upstream e2c. Upstream commits `c3345e82`, `9a86fcfa` and `258a922b` added finite untransformed computed extents to contact-basis admission and synchronized two host-unit fixtures, but these four downstream fixture builders still supplied only synthetic rect/client dimensions.

The local unmodified tracked f0 source reproduced exactly those 25 failed identities. They were not file-collection failures or timeouts. The correction supplies the same already-authored geometry through the computed-layout observation used by the host.

| Fixture | Same geometry supplied through computed layout |
| --- | --- |
| `packages/adapters/base/test/fixtures/axis-input-conformance.ts` | The same 200→300→400 px width and 100 px height, including the held-contact cancellation and post-disposal change. |
| `packages/prototypes/base/test/carousel-continuous.test.ts` | The viewport's existing width/height/client dimensions, including its existing resize operation. |
| `packages/prototypes/base/test/resizable-group.test.ts` | One scoped map shares the original root and live panel-box functions with computed layout. Panel redistribution still derives from actual exposed sizes; nested groups retain their own boxes. The spy and map are restored after each case. |
| `packages/prototypes/base/test/navigation-overlays/drawer-auto.test.ts` | The same fixed 200×200 px synthetic content box resolves computed dimensions while the actual authored inline `height:auto` remains unchanged and asserted. The existing available-space probe still injects zero padding only on that probe. |

Both scoped proxies preserve all other computed-style values and bind native CSSStyleDeclaration methods to their original receiver. This avoids fabricating product state or overriding actual inline style observations. The first proxy attempt omitted method binding and failed; that negative attempt is preserved below.

## Actual verification

The exact command and all file filters are in the companion JSON. All runs used Node 24.22.3, pnpm 10.32.1, the repository Vitest configuration, one fork worker, the same nine files and the same original 122 case identities. The two unchanged host-unit files contribute 44 existing controls.

| Actual attempt | Duration | Exit | Original cases | Reported unhandled errors |
| --- | --: | --: | --- | --: |
| Unmodified tracked f0 source | 12.500 s | 1 | 97 pass / 25 fail / 0 skip | 0 |
| First fixture attempt, invalid CSS proxy receiver | 12.312 s | 1 | 96 pass / 26 fail / 0 skip | 22 |
| Final formatted fixture candidate | 12.150 s | 0 | 122 pass / 0 fail / 0 skip | 0 |

The first candidate's extra failures came from the fixture proxy losing the CSSStyleDeclaration receiver, not a product change. Its exact diff, log, full report and before/after source hashes remain retained. The final candidate binds method receivers and uses one Resizable spy/map for nested geometry.

AST comparison confirms all original `expect` chains, case titles/inputs and numeric literals remain unchanged. The raw AST audit includes nested calls rooted at `expect`; its node count is not an independent assertion count. Full named case identities are retained in the local red, failed-attempt and final reports and in `case-identity-audit.json`.

## Source and dependency limits

Each actual run's full Git status is preserved. There were 59 untracked `node_modules` symlinks to the existing installation during every focused run. The initial tracked source matched f0 and every run's source/status was stable, but the complete worktree was **not clean**. An earlier progress message called the baseline worktree clean; that wording was incorrect and is corrected here without altering the original receipt.

The candidate's actual Vitest resolver was loaded through Vite and checked: workspace imports for Core, Hooks, four Web Adapters, Base and Shadcn resolve inside the candidate worktree. This checks the declared resolver, not a complete runtime import trace. Third-party dependencies were shared. After validation, only the 59 symlinks created for this worktree were removed; the original installation and ignore rules were left unchanged. Their exact targets and before/after status are retained.

The host, Core protocol, Axis module and Vitest configuration remain byte-identical to f0. The parent will validate the same nine files after integration under a real frozen dependency installation, followed by final binding and native CI. Focused synthetic passes do not replace that evidence or rewrite the f0 cycle. No acceptance status or spec lifecycle is promoted by this record.
