# Sprint 2: String conversion of mutable data arrays

The full integration regression exposed two String-conversion failures. Ordinary array literals now carry their writable `value-array` permission, while the String intrinsic still admitted only the older readonly data-array representation. As a result, `String([1, 2])` incorrectly failed source admission before the GPUI target could issue its intended unsupported diagnostic.

The intrinsic now accepts an ordinary mutable array only when its whole element graph has a finite data representation and contains no callable, accessor or owner authority. It retains the original array type and expression; no freeze, copy or source folding is introduced. The duplicate unreachable legacy String branch was removed.

A 768 MB standalone probe confirms source admission and cold JSON IR validation for the numeric-array source, successful output for all four Web profiles, and the existing `PUI4003` scalar-only String boundary for GPUI. Arrays containing callbacks or State handles still receive the source-level `PUI1006` refusal.

The regression adds direct generated consumers in all four Web profiles. Each reads the original array, appends a value and reads again, so a snapshot, freeze or replay of the initializer would be observable. Those runtime cases are queued for the next coordinated regression window; their execution is not claimed by the source-generation probe.
