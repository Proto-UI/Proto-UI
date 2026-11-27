# Native input-dependent scope closeout

CSS scope start and end selectors can depend on an input property even when the input causes no attribute mutation. The native Focus Entry observer previously collected nested style selectors but omitted these native CSSScopeRule selector boundaries. A checked input outside the entry could therefore change its real visibility without updating entry projection during the same trusted event.

This change reads the native start and end IDL selectors while walking the existing stylesheet rules. It preserves unknown-selector conservatism, the author's finite native-part input repair, the original event capture order, and all existing timeouts.

## Source and actual regression

The baseline is 1afa22e88c087db244f0e28a835b2926fb8bce8e, a records-only successor of the author's 25ca6fcaecd917457f6f3d694b3e12bfb522e89a. No duplicate finite-part product repair was applied.

The two original native dir=auto cases and two new native scope cases were selected together from the complete Shadow test file. Against the unchanged baseline product, the original two passed and both new scope cases failed with assertion errors. After the minimal product change, all four passed. The other 190 cases were filtered and are not claimed as passed.

The scope fixtures verify real native CSSScopeRule parsing, start/end selector readback, trusted checkbox input, a still-absent checked attribute, opposite start/end visibility behavior, and the entry projection observed in the same native dispatch. Original case and setup deadlines remain unchanged. The raw Vitest reports retain each selected title; the reporter printed a shared expected/received diff for the two failures, so that shared rendering is not presented as two independent full object dumps.

The author's unchanged complete input-origin file passed 60 of 60. The original workflow policy command passed 31 of 31 with zero failed, cancelled, skipped, or todo tests. The first driver misparsed Node's default reporter summary after the child had already exited zero; reconciliation used the original stdout and did not rerun the tests. Both the original driver error and the successful child output remain in the archive.

## Workflow and acceptance boundary

The existing native input step now selects exactly the original two dir=auto titles plus the two new scope titles, and verifies all four exact names passed. Its output paths, worker configuration, cleanup, original 20-case browser acceptance, SSR controls, and timeouts remain unchanged.

These local native tests ran with Node v24.22.3 and Chrome for Testing 145.0.7632.6. They do not replace the new published-source browser, source/type, and production acceptance. The author's prior 25ca canonical browser, production, and GPUI evidence remains preserved for that source. This correctness regression is not claimed as the cause or repair of the earlier 250 ms Preview cleanup issue.

The [manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint5-native-scope-input-closeout/manifest.json) and [raw archive](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint5-native-scope-input-closeout/execution.tar.gz) include exact source hashes, commands, times, raw red and green reports, all original control outputs, and the source-review boundary.
