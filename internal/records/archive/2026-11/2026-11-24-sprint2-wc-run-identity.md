# Sprint 2: one WC Run and lifecycle module per logical owner

## Independent counterexample

Review of the first-class lifecycle-module slice found that the WC emitter created a new Run and lifecycle object inside every callback invocation. The initial regression compared two reads inside one callback and therefore missed the difference across callbacks.

An independent driver ran the same authored source through a real Core Runtime session and each of the four generated Web consumers. The source retained `run.lifecycle` in `created` and compared it with the module received by `mounted`. Core, React, Vue 3 and Vue 2 returned `{same:true,mounts:1}`; WC returned `{same:false,mounts:1}`. The red receipt retains the exact source and six relevant source hashes; its SHA-256 is `b2818537c4fd24f59b83e484fcc47efecaab3b13d0d949f8a1e91318d129d537`.

WC now lazily constructs its Run once per logical owner and reuses it for subsequent callbacks. The lazy boundary preserves existing host initialization order. Each invocation still checks owner liveness, enters/leaves its callback-depth scope and restores the previous `currentRun` for nested callbacks. The module does not extend an owner's terminal lifetime or bind to a replacement owner.

The enhanced four-profile fixture also exposed a Vue 2 value boundary: a public call supplied the number `1` to the Boolean ViewIntent operation and was accepted. WC likewise lacked that Boolean guard in its Run module. Both now reject a non-Boolean value before changing intent; WC explicitly rejects terminal presence changes instead of silently returning during disposal. React and Vue 3 already rejected the invalid public argument.

The independent review also found that a public method could explicitly declare a lifecycle-module input. React and Vue 3 refused that boundary later, while WC and Vue 2 accepted it. The new module is internal to an existing owner, so shared operation validation now rejects that input at both source and cold-IR admission, including nested records, collections and callbacks. This is limited to the newly introduced `run-lifecycle` type and does not alter older capability/profile parameter policies. An ordinary data string with the same spelling remains legal.

## Evidence

The same independent driver was rerun after the repair. Core and all four generated targets returned `{same:true,mounts:1}`. The green receipt SHA-256 is `5d5831027e6e340a7ee1d48a989e4a699b7aca2c2df2ff07dfbcc0a87a272512`. The driver SHA-256 is `4ce167a65882a6e7ebae90a6efb89768bd0b93af1b31cc21fecd942b7c6cd177`; the [local compiler evidence bundle](evidence/2026-11-24-sprint2-compiler-local/README.md) retains both reports, logs and the driver under `review-lifecycle-cross-callback-*`.

The lifecycle-module file now compares identity across `created`, `mounted`, a Props watcher, `unmounted` and a new view epoch. It retains the old-callable/replacement-owner isolation and source/cold-IR authority refusals. Its final **24/24** cases passed on the repaired source, including five public-input source negatives, an independently forged cold-IR input and the ordinary string positive. The combined local-helper, lifecycle-module and frozen-array regression completed **69/69**. The initial enhanced red run is preserved: WC failed cross-callback identity and Vue 2 accepted the invalid number; React/Vue 3's expected refusal messages required a fixture matcher correction.

The enhanced lifecycle fixture's complete strict generated artifacts passed **4/4** in a fresh single-worker process with a 1,024 MB heap, including supporting TypeScript/JavaScript under `strict` and `checkJs`. The final bounded source/test TypeScript program checked 15 roots and their imported graph with zero diagnostics. These remain bounded Runtime/Happy DOM, generated-artifact and source/IR checks; this record does not establish physical browser, AT, full native, SSR or the complete original lifecycle matrix.
