# Explicit logical direction style projection

Date: 2026-10-10. Scope: the existing CLI Web style renderer, not the Compiler or a new Proto semantic operation.

Calendar's prototype owner requested finite `direction-ltr` and `direction-rtl` presentation tokens for an explicit logical direction input. The renderer now maps those tokens to CSS `direction: ltr` and `direction: rtl` in document and Shadow output. It does not reverse a flex layout or infer direction from DOM state. Unsupported values still produce the existing unsupported-token diagnostic.

A focused negative test first reported one failure and 43 existing renderer passes because both tokens were absent. The same renderer suite now passes all 44 tests. The integrated seven-file check, including Drawer layout/capture and Form feedback, passes 110 tests. No browser or native visual claim is made by this vocabulary change. Calendar keyboard, locale, and caption semantics remain the responsibility of their prototype definition and implementation slice.
