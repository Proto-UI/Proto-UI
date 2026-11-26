# Shenko native consumer: control semantics and retained overlays

This follow-up starts from published candidate `cc42163b01eb13ecee1c43308221d44902ca7856` (A6). It records actual production failures, their shared Compiler/host repairs, and bounded replays on the subsequent working source. The [archive index](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-shenko-native-controls/index.json) binds the original bytes of the separate successful, failed and rejected-candidate observations. Final clean-commit production and browser acceptance are subsequent gates, not claims made by these working-source receipts.

The changes continue [upstream PR #1732](https://github.com/Proto-UI/Proto-UI/pull/1732). They do not change IR8, public ABI, the original strict size thresholds or the migration's total of nine newly introduced executable cases. This follow-up adds no independent test case. Existing scenarios were strengthened only at the already reviewed naming, controlled editing and focus observations; the Select verification below uses six existing files without further Select-specific test edits. The native-host file includes the earlier naming assertion extension, so this is not a claim that every test file is byte-identical to published A6. Counts from separate replays overlap and must not be added into a full-suite total.

## Actual A6 production findings

The real A6 production bundle passed the four reading journeys: **78 checks, zero page errors**. This establishes the earlier initial-follow, natural-arrival and terminal cleanup repairs at A6; it does not establish the subsequent dirty A7 candidate. The full original `production-browser-a6-v4-01` receipt and its reading receipt are included in the archive index.

The same observation run attempted all eleven manual groups and recorded seven action errors. Its `observations-recorded` status is not a pass. Two groups that completed their actions also exposed wrong behavior:

| Actual observation | Responsibility established from diagnosis | A7 candidate change / remaining evidence |
| --- | --- | --- |
| Subject-details and attachment-remove Buttons lost their supplied `aria-label`; exact original names could not be located. | `nameFromContent()` was withdrawing a scalar `aria-label` owned by the host. This was not a missing fixture title. | Canonical A11y and Compiler projection repaired; original accessible-name queries must be rerun. |
| Typing `-12.75` into the number field produced `-2.751`, then ArrowUp produced `-1.751`. | A cross-module Focus refresh projected the previous TextControl value inside the input callback and moved the caret. | Unrelated refresh no longer projects text values; real sequential typing remains to be rerun. |
| Route arrow navigation stayed on Files; Space did not activate Inspect/Chat. | Roving member enumeration wrongly treated exclusion from sequential Tab as exclusion from the roving group. | Native focus membership repaired; the existing route keyboard group remains to be rerun. |
| Select Trigger focused and changed `aria-expanded` to true, but no listbox/options appeared. | Actual generated Content mounted inline, then moved through a new portal subtree; settled alignment saw one Trigger, two Surfaces, no Viewport and no ItemText and correctly rejected the structure. | Generic React Overlay retention and stable portal repair; the original Label → Space/selection/closing group remains to be rerun. |
| Mobile More failed while acquiring AvailableLayout, with a setup-phase State-watch error. | Native host reconciliation used the setup-only authored watch API during runtime attachment. | Internal host subscription used instead; the real More/Drawer flow remains to be rerun. |
| File-bridge observation could not read the response body because the inspector cache had evicted it. | This original observation failed at response capture. The failure alone does not establish a FileInput semantic defect or a pass. | Preserve the failed attempt and bind any separate response diagnosis to its own receipt. |

The original production observation receipt is archived separately from the extracted `actions.json` readback; additional normal-input diagnosis is in `diagnosis-03-receipt.json` and `select-file-receipt.json`. The Select instrumentation used a separately bundled diagnostic copy; it is not clean production acceptance. Its trace and original producer bytes were retained.

## Accessible names preserve host scalar ownership

`nameFromContent()` now contributes no scalar `aria-label`. An explicit `name(...)` remains an owned scalar projection, including explicit `name('')` withdrawal. Existing last-setup-wins behavior, ownership restoration and ControlLabel conflict rules remain. The canonical Web module and compiled native A11y use the same boundary; Shenko does not add duplicate hidden text to conceal the defect.

The same two existing scenarios first failed on the pre-repair behavior: **67 passed, 2 failed**, exit 1. The repaired six-file scope then passed **158/158, zero skips**, exit 0. That scope covers canonical A11y, Runtime and Web Component A11y, ControlLabel and the generated React native-host bridge. `C-A11Y-0001` and the existing `T-A11Y-0001` projection notes describe the boundary without introducing another executable case.

Evidence: `a6-a11y-naming-summary.json`, `a6-a11y-naming-before-receipt.json`, `a6-a11y-naming-fixed-receipt.json`. The before log remains unchanged.

## Text values, roving focus and AvailableLayout phase

Native TextControl separates value projection from general property refresh. An unrelated module refresh uses `applyText(false, false)`. Attach, explicit synchronization, reset, accepted host commit and controlled rejection/rollback keep their value-writing behavior. The existing composition, prelude, callback generation and view-lease guards remain.

The two existing single-line/multiline controlled editing scenarios were replayed before the fix. Both failed: the callback observed the old `seed`/selection rather than the current `proposal`. The focused selection intentionally left the other 67 tests unexecuted; these are not 67 additional failures or skipped acceptance cases. The repaired original nine-file scope passed **276/276, zero skips**, including the original rejection, composition and remount assertions.

Roving navigation now includes live enabled roving members even when `navParticipation` is `none`; sequential scope/Tab exclusion is unchanged. No new navigation policy is added to Shenko.

AvailableLayout's native reconciliation uses the existing owner-internal `subscribeState` mechanism, rather than setup-only `watchState`. Epoch/current-root checks, lease cleanup and the public setup guard remain. The six original canonical positioning files produced **65 passed / 4 failed**, so this replay remains exit 1, not a successful generated Drawer test.

The four failures are all in `packages/modules/positioning/test/lease-generation.test.ts`:

- pending writes after `dispose`: inline `position: fixed; top: 0px; left: 0px;` remained where empty style was expected;
- pending writes after `replace`: the same residual style;
- pending writes after `invalid-target`: the same residual style;
- revoked input anchor: `0px` remained where empty style was expected.

The test and relevant canonical implementation files match A6 and main `2479acecddf8f9801cdbee0c538ca08d7e79c9d4` byte for byte. **That comparison is source evidence, not a main-commit test run.** A separate run replayed the original six-case lease file on clean A6, clean before and after, at 02:52:25–02:52:32 UTC on 2026-11-23. It produced **2 passed / the same 4 failed**, exit 1. The original receipt, tests JSON and log were read back and SHA-verified in `a6-clean-lease-baseline-01`. Receipt SHA: `9d72625cb8f18aec8ceae9cd34207abbf57dee3450e13ed0c8029a6ca6648542`; log SHA: `f5f336c18789a2f6ca40cd25741f9f13526fabd8edadb3dbb0d77868a21ef58b`. These failures were not repaired or weakened by this follow-up.

Evidence: `a6-native-text-focus-repair/receipt.json`; `a6-available-layout-subscribe-fix/targeted-receipt.json`, `tests.json`, `lease-baseline-source-comparison.json`. Fresh generated More/Drawer browser acceptance remains separate.

## React retained Overlay host

The Compiler now reads a private native host view policy derived from reached `asOverlay` declaration and an actual Presence binding. Only a bound Overlay retains its detached hidden root and authored children. Ordinary L1 `setPresent(false)` and nonportal shape remain unchanged. Closed children can register their logical collection/anatomy roles without invoking an absent parent's authored render.

The live React profile uses a stable host-owned `display: contents` portal container in the origin's actual Document. React owns the child tree. The host moves its container to the document destination before accepting the mounted frame and parks it by the origin on detach. The canonical visibility helper supplies the detached paint/AX/Tab suppression rule and is included in source provenance. Context subscriptions and logical parentage survive view detach.

Owner-ready publication creates the closed shell even when no render frame is published. A mount is acknowledged only after its physical root exists. Last accepted template and the initial slot key preserve the intended reconciliation layer. Terminal container cleanup uses the existing deferred owner-disposal boundary so same-turn StrictMode replay does not destroy it; cleanup preserves the first thrown value, including falsy values.

Independent review found and corrected a second edge: a mount frame could be published, then presence withdrawn before React accepted it. Both scheduler guards now still publish one detach when `latest.kind !== 'detach'`, even if the owner never reached mounted. Initial closed `latest === null` and already parked `latest.kind === 'detach'` do not loop. This state-machine path was reviewed statically; no dedicated new executable scenario was inserted.

### Exact existing test scope

| Existing file | Passed cases | What it establishes |
| --- | --: | --- |
| Compiler `lifecycle-disposal-errors.test.ts` | 30 | Ordinary React/Vue2/SSR disposal and falsy-error behavior |
| Compiler `react-context-source.test.ts` | 15 | Logical Context, absent-view subscriptions, strict ancestry and stale delivery |
| Compiler `react-source.test.ts` | 11 | Ordinary L1, pending-mount update, StrictMode and Suspense boundaries |
| Compiler `react-native-host.test.ts` | 1 | Root attributes/events/refs and naming |
| Adapter Base `view-visibility.test.ts` | 2 | Canonical pending/detached visibility rules |
| React Adapter `select-presence-remount.integration.test.ts` | 12 | Canonical Base/Shadcn Select controlled handoff and reopening reference behavior |
| **Total** | **71** | **Six original files, zero failures/skips; not 71 compiled Select scenarios** |

Final replay ran 03:21:39–03:22:03 UTC on 2026-11-23, exit 0, with stable recorded source. The same final source passed scoped Compiler strict checking, exit 0, zero diagnostics. The 12 Adapter Select cases are reference evidence, not execution of the repaired generated Select.

The actual public `upstream/selectContent.proto.ts` entry was freshly compiled through source → JSON IR8 → independent validation → public React emission before the final scheduler adjustment. After that emitter-only adjustment, the identical serialized IR (`40aa37ca2b08b3d8046618deec705ff14339b37acedd0c3c0d3e69136ea4ecf9`) was independently validated and re-emitted with the repaired emitter. All **36 written files, including 34 support files**, passed the complete reached strict check. This is not a second fresh source compilation, a full 46-entry production build or a browser pass.

Evidence: `a6-react-overlay-host-repair/summary.json` and its linked source/re-emission/strict/final-test receipts. The schema remains IR8. `captureViewOperation()` remains unsupported by the Compiler; no conformance is inferred from private epochs or Focus's detached-ancestor guard. Vue/Vue2 retained-portal behavior is not repaired or certified by this React-only change.

## Size work: retained changes, rejected candidates and unchanged limits

All figures below are separate paired measurements under the original strict nine-entry policy. They describe dirty source checkpoints and must not be presented as a final A7 budget result.

| Candidate retained in the working source | Existing behavioral replay | Observed paired gzip delta (React / Vue / Web Component) |
| --- | --- | --- |
| Shared private Web Resident/Presence inline-style ownership | 38 passed + 1 existing TODO; fresh actual Drawer + reached strict passed | −65 / −58 / −72 |
| Fresh AxisInput untransformed-box reads | 62/62; actual NumberFieldLabel value-import path reaches the canonical axis asset and passes strict | −18 / −19 / −21 |
| Shared original `runAllSteps` cleanup/notification algorithm | 248 passed + 1 existing TODO; fresh Drawer + reached cleanup-asset strict passed | −12 / −39 / −39 |
| Shared private motion style read/restore helpers | 38 passed + 1 existing TODO | −12 / −11 / **+1** |

These extractions preserve fresh reads, value/priority order, lease/Map identities, loss-callback deletion order, document boundaries, first-error semantics including falsy values, and the original iteration/cleanup sequencing. The TODO remains a TODO, not a pass.

The Axis verification initially assumed DrawerContent would reach AxisInput; its scratch artifact assertion failed. The original successful Drawer compilation/strict result was retained, the incorrect assumption was recorded, and the existing real NumberFieldLabel entry supplied the actual value-reachable axis asset evidence. No production capability was added merely to satisfy the harness.

The private five-method Focus dispatch candidate passed its 112 original tests but increased Runtime/React/Vue gzip by 1/3/5 bytes. It was precisely reverted. This is separate from the retained native roving-membership correctness repair.

The motion style I/O candidate was initially reverted due to its Web Component +1-byte delta. After independent review, the reviewed integration candidate restored the exact measured bytes: React/Vue improved by 12/11 bytes while Web Component remained below its unchanged limit. Both the original reverted receipt and the restoration decision remain. Restoration is not a new measurement.

The last retained checkpoint measured before the subsequently rejected decoration guard candidate is **7/9**, exit 1:

| Entry                      | gzip bytes | Original limit | Result     |
| -------------------------- | ---------: | -------------: | ---------- |
| Runtime root               |    101,427 |        101,500 | pass       |
| React Adapter root         |    165,510 |        165,500 | over by 10 |
| Vue Adapter root           |    164,314 |        164,300 | over by 14 |
| Web Component Adapter root |    198,929 |        199,000 | pass       |

The other five original entries pass. A later private decoration-bound-host guard candidate increased React and Vue by 5 bytes each and was precisely reverted to the pre-candidate source SHA `af980e6cf932fdb60782ea8051258585793a7381499b30d553458fa272086233`. The restored canonical snapshot matches that source. The values above remain the previously measured retained checkpoint; they are not a new measurement of the restored whole tree.

That rejected candidate's original seven-file decoration replay was **98 passed / 1 failed**, not a pass. The same Web Component `remove split marker` reuse failure reproduced on the exact before-file source (**60 passed / 1 failed**), with other scoped inputs unchanged. This establishes that the failure predates that single-file candidate only; it does not establish clean A6/main behavior or dismiss another changed source as a cause. Both failed replays remain in `a6-decoration-bound-host-dedup/receipt.json` (SHA `011500651aad49a97ca5d834dda9ae5e64738d48b479317900136c91c1a67862`).

No limit is raised, downgraded to advisory, skipped or inferred from a smaller entry.

Evidence: `a6-motion-ownership-dedup/receipt.json`, `a6-axis-geometry-dedup/receipt.json`, `a6-synchronous-steps-dedup/receipt.json`, `a6-motion-style-io-dedup/receipt.json` plus `receipt-reverted.json`, `a6-focus-navigation-dedup/receipt.json`, and `a6-decoration-bound-host-dedup/receipt.json`. The first three receipts retain their original pending-review wording; the later explicit review decision is separate, not a rewritten historical receipt.

## Final bounded source checkpoint

The last retained extraction shares the exact fresh ancestor walk between Web Resident Motion and Presence. Each of the four call sites still allocates and traverses at its original time, preserving `getRootNode()` before `parentElement`, conditional ShadowRoot host access, method receivers, complete traversal, observer behavior and exceptions. No cache or public package export was added.

The six unchanged Motion files passed 38 cases with their one existing TODO. Official canonical host generation/check retained 36 inputs. Fresh actual DrawerContent source passed JSON IR8 independent validation, public emission and the full reached strict graph: 41 written files including 39 support files. The canonical helper is reached through a real value-import path, not only listed in provenance.

The same frozen source then passed all nine original strict budgets, exit 0:

| Entry                      | gzip bytes | Unchanged limit | Result |
| -------------------------- | ---------: | --------------: | ------ |
| lucide/icons/x             |      2,879 |           3,000 | pass   |
| lucide root                |    637,306 |         700,000 | pass   |
| core root                  |     11,378 |          11,500 | pass   |
| runtime root               |    101,427 |         101,500 | pass   |
| adapter-react root         |    165,446 |         165,500 | pass   |
| adapter-vue root           |    164,243 |         164,300 | pass   |
| adapter-web-component root |    198,859 |         199,000 | pass   |
| prototypes-base/button     |      5,385 |           6,000 | pass   |
| prototypes-shadcn/button   |      7,812 |           7,900 | pass   |

The paired measurement changed only the three reviewed Motion files among 3,828 actual package-budget inputs. The full 7,625-file measured source digest is `eaf452782b5dd0a09e5255bb846e38537e4248f63770d43c84b5bfe4c5dd04df`. The unchanged five entries and Runtime result are recorded alongside the three adapter reductions. This is a source-bound working-tree measurement; later formatting, publication and clean-commit checks remain separately identified.

The exact receipt is archived as `a6-motion-ancestry-dedup--receipt.json.gz`. All rejected candidates and their failed gates remain above and in the archive.

## Subsequent acceptance boundary

The completed source checks above are bound to their exact recorded inputs. The actual published follow-up must separately establish clean-commit full types, the original Compiler/Scroll scope, fresh 46-entry Shenko production generation and independent reconstruction, and the unchanged four reading journeys plus all eleven interaction observation groups. Original role/name queries and sequential typing remain the acceptance inputs; diagnostic CSS locators and instrumented assets do not replace them.

The A5 full CI run [45092982511](https://github.com/Proto-UI/Proto-UI/actions/runs/45092982511) completed with failure. Its type chain and both native consumer jobs passed, but `test-general` was cancelled and multiple browser/production jobs failed. Those results belong to A5. A6's lightweight PR workflow success did not run the heavy gates. The previous local full type OOM and interrupted retry remain failures to complete that scope.

The actual A6 application build already demonstrated a material size cost: its four JavaScript assets total 2,820,192 raw bytes and 748,954 gzip-9 bytes, compared with the committed PR #389 baseline's 1,246,251 and 355,256 bytes under the same Node/zlib method. The gzip increase is 393,698 bytes (110.821%). This is a real application measurement, distinct from the upstream nine-entry budgets, and a subsequent build needs its own measurement.

No complete CI success, merge approval, native operating-system picker, real platform IME, assistive-technology, model/backend or other host-target acceptance is inferred from the bounded Web evidence. The unsupported Compiler `captureViewOperation` boundary and unverified Vue/Vue2 retained-portal paths remain explicit.
