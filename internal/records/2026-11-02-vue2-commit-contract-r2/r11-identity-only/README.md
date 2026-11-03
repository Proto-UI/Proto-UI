# R11: closed identity-only function bodies — Draft, strict remains red

This is a bounded compiler correction under #1055, continuing Draft #1209 from
`d496d6387b694363657c6ac84b26a0e4c908b602`. It is not completion of Vue2, generic
legacy-template callables, the thin-compiler matrix, or generated typing.

## Exact source and actual results

The fixed execution base remains `783ac833a77102365489d4050f7279c758114ec4`.
Control tree: `9db936d579dffe2c8debb61e43783a1205986b4e` (exact R10 candidate).
Candidate tree: `24520b3c3a07db36419ed1491334e10d4cf8e549`.
The three source/test SHA-256 values in `manifest.json` are the exact executed
bytes. Publishing these leaves onto the existing public ancestry is **not** a
separate execution of the complete publication head or current main.

Actual ten-stage run: 2026-11-03 01:08:59–01:12:29 UTC. Node 24.22.1,
TypeScript 5.9.3, Vue 2.6.14, Vitest 2.1.9, Happy DOM 15.11.7 and the same 105
locked packages as R10. Isolated private PID namespace, cleared environment,
no accounts or network, unchanged repository config, read-only source/deps,
exclusive shared slot; no installation, production deployment or browser claim.

| Check | Control | Candidate |
| --- | --- | --- |
| Exact core collection | 49 | 69: original 49 + separately named 20 |
| Original behavior | 11/11 | 11/11 |
| Original native controls | 36/37 | 37/37 |
| New proof/admission/consumer controls | Not present in R10 | 20/20 |
| Original complete generated strict test | Failed: 97 diagnostics | Failed: 97 diagnostics |
| Focused source strict | 0 diagnostics | 0 diagnostics |
| Separate original regressions | 41/41 | 41/41 |
| Aggregate core | 47/49, exit 1 | 68/69, exit 1 |

All original assertions and the historical no-DCE comment remain. Removing the
five added import declarations and the added `rmSync` named specifier from the
pre-existing `node:fs` import, reverting the capture cap 40→38, and removing the appended
R11 block reproduces original native test SHA-256 `8be12d08282ac8d10f1e4d8a11f5d4236d3db2eba644d1c3a560865fa46ebd7f`
byte-for-byte. No skip, xfail, expectation relaxation, renamed original case or
replacement of the original full strict graph was used. Candidate-only tests
cannot be transplanted to R10 because its compiler-private proof export does
not exist there; this is not a paired 69-case claim.

1,308 artifacts / 24,360,049 bytes were rehashed. All 14 subprocess root checks,
source/layout and dependency checks passed; root bundles and strict scratch
residue were zero. Full failed test messages, emitted graphs, requests and
unfiltered diagnostics remain captured. The two source-strict successes do
not certify generated graph typing.

## Lawful helper: what changed

The unchanged original test authors `make=(text:string)=>r.el('b',text)` and then
mutates the checked formal and child reference to the legacy `template` type.
It aliases and compares the function, but does not call or expose it. Do not
misdescribe this as an authored `Template` annotation.

Control and candidate `input.json` are byte-identical. Control throws
`Vue2 native lowering requires actual template parameter provenance.` before
producing a module; `identity-only/control-failure.json` preserves the actual
failure, not a fabricated control output. Candidate produces an ordinary Vue2
component and the original mounted consumer sees `not-called`.

Actual candidate excerpt from `identity-only/result.json`:

```js
const make = /**
 * @param {unknown} text
 */ (text) => {};
const alias = make;
if ((make !== alias)) {
  return null;
}
```

The original allocation position, distinct identity and formal list remain.
Only an unobservable body is removed at compile time. There is no new runtime
projector, walker, parameter, throw stub, support factory, interpreter, component
identity dispatch, or broad DSL-admission change. The old test comment expressed
the previous implementation preference; this checkpoint explicitly changes that
strategy, not history or a public semantic guarantee. No body-retention assertion
was removed or weakened.

The proof consumes validated IR and the existing canonical `NativeLexicalScope`
from #1120. It closes declaration/alias/identity uses across every syntactic body,
branch, callback and post-return statement. Invocation, return/escape, other use,
unknown callable origin, root/renderer entry, recursive provenance and multiple
creations prevent elimination; the independent known-invoked set is only a veto,
not a proof of non-invocation. The real renderer is retained. No second shared
shape analyzer or public/runtime API is introduced.

New controls include direct/alias calls, dead branches and calls after return,
nested unused bodies, checked callbacks, returned/factory values, declaration
scope versus caller shadowing, alias chains and shared FunctionIR identity with
two creations. Reflection (name/length/toString), array/record escape and recursive
aliases retain the existing upstream rejection. These six negatives are not
claims of native implementation support. `proof-results.json` preserves all 20
actual proof/admission records (14 admitted, 6 rejected), canonical identity
metadata and input hashes. Full input bytes remain in the original evidence;
authored fixtures are in the exact public test source.

## Two additional real consumers: typing is still incomplete

- `identity-arity/`: two independent functions stay at the original renderer
  creation sites, with their original two formals each and distinct identities.
  The native mounted consumer renders `distinct`. Actual TypeChecker results
  show all four unused formals as **Unknown, flags 2**. This is an internal opaque
  type for an unobservable callable body, not a new callable interface or `any`.
- `called-alias/`: identity is observed but the alias is actually invoked; the
  full body remains and the native consumer renders the expected `<b>called</b>`.

Both consumers were checked using the complete actual source/support graph,
ordinary `Consumer.ts`, repository-derived options, real Vue2 declarations,
`strict`, `allowJs`, `checkJs`, and `skipLibCheck: false`. Each has **215 program
files**. Their complete diagnostics remain **59** (identity/arity) and **60**
(called alias). Neither graph is strict-clean. Four correct `unknown` formals and
passing behavior assertions do not replace full-program type acceptance.

The original fixture independently remains **97→97**: complete diagnostic
multiset and all 97 message/source-line/column/span occurrences match. Its
Component.js is byte-identical, SHA-256
`521f5e0d21b71cdab9504c516a8068c9ab08c5b67926910a5c4d8d58d2803ee2`.
The manifest verifies all six actual graph outputs against the immutable R10
carrier; use that existing `reconstruct.py` for those unchanged bytes. **59/60
are different new input graphs, not a measured reduction from 97.**

New graph files are actual emitted bytes. Portable JSON only substitutes the
listed temporary roots; every original diagnostic field, message chain, related
information, position, program file and option remains. Local inverse checks
restore each raw file byte-for-byte. Raw and portable hashes are in the manifest.

## Formatting evidence, including the actual failure

Prettier 3.8.1 data export and recheck both exited 0. The unchanged stricter AST
comparator exited **1**, with all six original negative controls rejecting.
That failure is retained, not relabeled green. Complete finite-diff review found:

- source: all compared AST/literal/flags/parentheses/comments exactly equal;
- new test block: four `multiLine` metadata changes only;
- native file: eleven `multiLine` changes, plus two parentheses whose child is
  exactly the original entire subtree (existing `&&` under `||`, and an existing
  nested conditional branch), and their derived node-count/path differences.

Raw/cooked template payloads and comments are unchanged; full-diff review also
checked that comments stay attached to the same statements/declarations.
There was no comparator mask or third formatting run. The exact adopted output
was then used by all ten real project phases above.

## Remaining work and provenance

The original 97 and both additional graphs' 59/60 diagnostics stay open. Full
legacy-template callable/domain lowering, SSR/hydration and its old walker path,
real browser/production native mixing, all backend/operation closure, retained
bundle and initialization/heap/time evidence are not completed here. No cost
saving is inferred from body omission, source bytes or these focused tests.
Canonical normalization combinations beyond the actual cases are not universally
certified. No broad #1055 checkbox is closed.

Human-assisted current-user contribution; AI assistance: OpenAI Dots. Original
Proto UI MIT source and authorship are retained. Static independent review is
not formal APPROVE, and these developer tests do not imply exact-head CI success,
readiness, merge, protection bypass or deployment. Pure compiler logic: this
actual source/consumer walkthrough is the applicable evidence, not an old UI
screenshot presented as a new version.
