# Sprint 2 candidate inventory preservation

The prior prototype coverage JSON is retained byte-for-byte in `previous-prototype-coverage.json.gz`. Its receipt binds the original bytes, archive digest and observed Git revision. The canonical generator refreshed only `candidateSource` and the source-derived consumer rows against `4688e0578e8ef8b0eec1da3aa4c6c8115f71f4d8`; the historical main snapshot, comparison denominator, migrated references and acceptance states were not promoted.

The refreshed view contains 71 comparison rows, 22 Base projection rows, 141 consumer rows and 101 migrated references. These are source inventory counts, not runtime, Compiler, platform or independent acceptance results. In particular, every newly visible missing projection retains its explicit missing state. The full Compiler library/profile inventory is a separate execution gate.

The generator completed with exit 0, and the canonical Web host source check also completed with exit 0. Final consumer runs remain separately bound to their actual candidate and process results.
