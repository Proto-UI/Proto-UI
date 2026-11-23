# Search opener handback continuation

## Regression and owning contract

At Sprint 1 source `758eec304481aad9885ddb882257fd0fb273cfdd`, a first Search opening requested without first focusing its Button reaches the public Dialog's entered state and focuses the query. Closing detaches the public panel, but leaves focus on body rather than the current opener. The same request is used by the global shortcut; this deterministic fixture does not synthesize or claim native keyboard delivery.

The original production Search at `4a2320762ba5f4319dec1915ca4e138772dceb0c` explicitly called `commands.focus('open')` from its accepted-close cleanup. Its behavior was not solely an incidental native-dialog default. The current composition supplied its explicit opener-return request only to a replacement Dialog. A shortcut opening can have no preceding logical opener owner for the generic Focus Scope to restore.

The repair belongs to the Website Search consumer. It supplies the existing guarded handback factory to every committed Dialog generation, and arms one return for each actual opening. The public panel's presence still determines when the return may finish. Reopening cancels the prior close's pending request; later accepted closing owns a new request. Owner replacement or disposal cancels pending work, and a newer external focus epoch prevents stale return even if that focus later blurs to body.

The draft `P-BASE-DIALOG-CONTENT-FOCUS`, `P-BASE-DIALOG-CONTENT-PRESENCE` and `P-BASE-DIALOG-CONTENT-CONTROLLED` criteria retain their original boundaries. The draft `C-AS-FOCUS-SCOPE-0002` distinguishes its default previous-owner restoration from an explicitly owned consumer handback. No prototype, Focus Module, compiler or public timing contract changes.

## Regression evidence

The new first-open case failed before the source repair with the intended final assertion: body was active instead of the opener. Entry, query focus, logical closing and public presence detachment had already passed. The fixed Node 24.22.3 / pnpm 10.32.1 run took 9.038 seconds: one selected failure and 34 unselected cases.

The first post-fix three-file run took 33.756 seconds: 47 passed, two failed. The new first-open case passed; the original theme-lease file passed 6/6 and Matrix activation passed 8/8. This is a new bounded observation, not deletion or reclassification of the historical two expanded-suite failures.

The two post-fix failures were the old interrupted-close tests: each reopened the Dialog, closed it again normally, and then expected no return at all. The updated tests retain the negative assertion while the reopened Dialog is fully entered and the query has focus, then require exactly one return for its later accepted close. The first-open case also repeats the opening in the same generation. Separate initial-close controls preserve newer outside focus, including blur back to body, and terminal disposal. Existing replacement, preparation/publication failure, cross-runtime and disposal controls remain.

Raw red and first post-fix logs, commands, source hashes and JSON results are retained under the continuation evidence directory `sprint1-short-batch`. Final focused validation and native keyboard/production timing results remain separate receipts.

The connection became unavailable before the next remote test launch. A local isolated checkout restored all five candidate files byte-for-byte against their recorded remote SHA-256 values. On Node 24.22.3 / pnpm 10.32.1, the completed focused run passed **55/55**: 37 public-mode, 10 disposal and eight recovery cases, in 35.047 seconds. The [receipt](./evidence/2026-11-23-sprint-followthrough/sprint1-search-handback/s1-closed-cycle-negative-controls.receipt.json), raw log and Vitest JSON retain the actual commands, source identities and outcomes. Source hashes remained stable throughout the run. Existing dependencies were reused with the identical lock digest; this focused run alone does not claim a fresh local frozen installation, a completed 44-file aggregate, native keyboard delivery or production timing acceptance.

The subsequent complete original expanded selection passed **44/44 files and 723/723 tests**, with zero failed or skipped tests, in 117.686 seconds. The 44 paths were recovered directly from the retained `s1-expanded-final.json.gz` report (720 tests, 718 passed and two failed). All original cases remain, with three new public-mode cases added. The [expanded receipt](./evidence/2026-11-23-sprint-followthrough/sprint1-search-handback/s1-original-expanded-44.receipt.json), exact selection, raw log and Vitest JSON preserve the fresh result; the earlier 718/720 outcome remains historical evidence. The existing theme-lease and Matrix activation assertions passed in this complete run without changing their deadlines. Native keyboard, original production Search timing and native Matrix acceptance remain pending.

## Exact source-binding review

The two old matrix bodies were recovered and hash-matched before comparing their complete deltas.

| Source | Recovered old revision | Old Git blob | Old SHA-256 | Reviewed new SHA-256 |
| --- | --- | --- | --- | --- |
| `site-search-commands.ts` | `953b450e13dce3c5156918249fb183b5bab677be` | `53fade32a4c7929fbfa06e64b2fc2f9fb34e44ca` | `7fa9135a6c446af8a8f9b4af9d585c80e85c210d831c429873e12f4dc6b67bf3` | `4a8a1c86e11d2ba477da34050b8d75ad19681f3826c4291f60febaf73a023547` |
| `site-search-composition.ts` | `46cc35a498908da28fbc9e15c0b0223cc47ba61e` | `18f0d5cb70a71ebd8f1e52bf4629249d2878a5ab` | `8574e57260fd676bf407b7161f3409b2ea07a996c65a56ef935291cef21296b7` | `9450263676765eac08e155b218a464c70020a110286a9910a86df90b97c83c8f` |

The commands delta also includes Sprint 1's previously unbound initial-projection retry repair. A failed, uncommitted idle Dialog controller is retired and recreated with current runtime coordinates; pending or committed generations are retained. Retirement remains tracked for cleanup, and stale completion cannot publish readiness after owner replacement or disposal. The independent Search data/session owner remains live. This stays within the existing dialog/input-results/launcher rows. The composition delta only adds the per-opening arm and its terminal revocation under the existing dialog/input-results/loading-failure owners.

Only those two exact source digests are renewed. All matrix row states, raw import rules, prototype lifecycle status and original acceptance requirements remain unchanged. This source review does not clear inherited admission findings elsewhere in the repository. The original 1000 ms production Search deadline and Matrix 60000 ms deadline remain in force; local unit results do not certify them.
