# Homepage gallery column measurement — 2026-10-26

The original HomeDemo responsive case fails on `14d2fbf85dd782646b95b78a34d53c74147e3a24`: its desktop column sample is one rather than the expected four. The accepted homepage uses CSS multicolumn layout; `gridTemplateColumns` is `none` and cannot measure those columns.

The complete canonical preview for that source was admitted with all 3,859 files and 104,364,128 expanded bytes under the unchanged 100 MiB limit. A separate real local preview records nine cards at four physical column positions on a 1440 px viewport and one position at both 390 and 320 px. This later observation does not replace the original failed test or prove its timing deadline.

The test now counts positive-area card fragments at distinct horizontal positions in the same geometry evaluation. The original four/two/one expectations, input sequences, assertions and deadlines remain unchanged. The affected whole file then passes all 11 cases on the saved candidate; this is not a new main combination result. The preceding 14-file run remains a separate 293-pass/four-fail result, including the unresolved original S4 and paint timeouts.
