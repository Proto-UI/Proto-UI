# Search publication ownership and remaining production timing

This record supplements the preserved Search oracle and native timing records. It does not replace their original failures or claim full 0.3 acceptance.

## Bounded implementation repair

Repeated Search paints could resubmit unchanged Dialog props, author-slot trees, action callbacks and InputShell facts subscriptions. The website composition now retains the actual public owner and submitted values for those operations. It coalesces only the current pending or acknowledged publication. A sequence of acknowledged A, pending B, then requested A still overwrites B.

Every continuation checks its publication identity, current Command and actual author box after awaiting a commit. This matters even when an already resolved promise was reused: its continuation may run after the physical target has changed. Close, lock and retirement clear the relevant publication ownership; failed writes do not become successful cached state. Reentrant callbacks and replacement public instances cannot inherit an old action callback.

InputShell binding follows its actual shell/control pair. Unrelated panel or close-instance notifications do not dispose and recreate that binding. A terminally disconnected pair remains retired for that composition owner; a new pair can bind. Ordinary view detachment is not reclassified as terminal disposal.

## Fresh commits and cached acknowledgements differ

An intermediate implementation incorrectly rejected a fresh successful commit when React replaced a preparing author box. The real Homepage Dialog replacement test then lost the focused Retry control: results returned as superseded, so the actions tree was never submitted.

`DemoRuntimeApi.setChildren` acknowledges the host/ref commit. A fresh successful acknowledgement therefore admits the current author box when the request, Command and open/current owner are still valid. Subsequent reuse remains bound to that acknowledged box, and each awaiting continuation checks that binding. The fix follows this existing API responsibility; it does not change readiness, the renderer contract or the original integration assertion.

## Evidence and limits

Original failing fixtures remain preserved: repeated-publication controls, setter and callback reentry controls, cached-acknowledgement replacement controls, and the real Retry replacement failure. The fresh-acknowledgement controls first produced 26 passes and two failures, then passed all 28 with the repair. Combined with the existing 23 public-mode cases, they passed 51/51.

The final affected run covered nine explicitly named files and passed 155/155 tests with zero skips, one worker, in 33.529 seconds. It includes actual composition/public-mode behavior across the Web hosts, owner/session/data logic and the InputShell binding helper. Twelve bound sources were unchanged through the run. Selected strict types for the two changed files passed in 3.676 seconds using the repository configuration. Independent source review checked the fresh-commit and reused-acknowledgement distinction.

The frozen composition source has SHA-256 `2ae76ee72be64dcec48ae013d16d880a8e8b8f92fc4dbb315e550b00315c801e`; its new regression fixture has SHA-256 `2fcbc5ece19548821c05037b0abcfdb92ce45422042b8644b5964038fd5e127b`. The v12 native candidate manifest is `573160d25efc48aa65203d4c894ec08bb49fabf28d6cde6fd5d388cb870d3a1a`, with 89 source paths, explicitly parented to the preserved v11 manifest.

The unprofiled original production four-case run still failed overall: **two passed, two failed, zero skipped or filtered**, in 182.879 seconds. Both complete IME journeys passed. Shadcn still failed the original Vue-to-React 1000 ms poll. Brutalist passed that React poll in 975 ms, then failed the next React-to-Vue2 1000 ms poll. The last observations eventually returned the correct runtime but arrived after their original budgets. All 89 bound sources were unchanged, and the owned preview, Chrome profiles and processes were cleaned up.

The preserved budget-clock comparison distinguishes the strict 1000 ms deadline from the slightly later exception/finally timestamp. Shadcn's final getter took 823 ms and returned 721 ms after the strict deadline; Brutalist's Vue2 getter took 684 ms and returned 80 ms after it. These transport durations alone do not attribute the cost to a particular browser function. The earlier v11 CPU profile is historical evidence, not a v12 profile.

The original actions, locator/getter, predicates, runtime publication and deadlines are unchanged. Full original 83-case acceptance remains unfinished; the local 155-case pass and partial production progress do not replace it.
