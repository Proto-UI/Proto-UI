# Count only a surviving entry acquisition

Review 4195877146 is reproduced on 0b7e278a. The host focus capability can synchronously cancel the in-flight entry before returning an accepted result. An unconditional successful-acquisition increment then incorrectly protects the old focused root from the outer target-disable cleanup.

The production repair is one condition: increment the entry-acquisition version only when current() still owns that operation and the host result is not false. Existing cancellation already invalidates current(); no new transaction or exception policy is added. Three baseline cases fail: entry disable, disable followed by re-enable, and an explicit newer no-target entry. The explicit-blur control already passes. The repaired four cases assert physical focus, observed facts and that later readiness does not resurrect the cancelled request.

Independent focused rerun passes 17 tests; related Runtime entry/role/admission and real React startup tests pass 82. Complete validation passes 44 public package builds, full types over 447 files (zero errors/warnings, four hints), the 284-page production build and actual bundle graph gate, and 4575 general tests over 656 files (34 existing todos and three skipped files). All nine budget gates pass unchanged; all eleven measured artifacts and exact source binding are in the companion JSON.

This is a bounded ownership correction to the prior 0b7e repair. Earlier failures and successful evidence remain attached to their original heads. Fresh exact-head CI and native-browser checks remain pending at publication; local Runtime tests use controlled host callbacks and happy-dom. No external approval, main merge or new public semantic guarantee is claimed.
