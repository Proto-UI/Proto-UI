# Compiler relational admission follow-up (#1019)

This is a dated migration/evidence record, not an independent normative source.
The proposed direction is cataloged in draft `C-COMPILER-RELATIONAL-0001` and mapped
by draft `T-COMPILER-RELATIONAL-0001`. Neither entity is a stable target guarantee.

The current user directed completion of unfinished Compiler work and delegated
portable semantic choices. The fixed source parent is
`d4c5587beb00ef058b72473b9b69bd85365e79e7`; the seven-path role
`DotCompilerRelational20261027` is recorded in
https://github.com/Proto-UI/Proto-UI/issues/1019#issuecomment-6439016041.
Its lease expires 2026-10-28T10:06:53Z, without automatic extension.
This does not reopen the closed issue or take over the frozen #902 IRv10 worktree,
#1022 C lane, Transition #1018 or CLI #1020. Merged #1021 fixed authored-hook
identity, not these relational semantics; #1023 is a separate Runtime type fix.

## Migration

The old shared inference accepted primitive mixed/nullish relations. GPUI chose
text versus numeric conversion from the left operand type and used Rust string
ordering. The bounded migration rejects mixed pairs and any invalid union pair,
through the same inference used by source admission and forged-IR validation.
Authors must narrow or explicitly convert both values to a chosen common kind;
there is no automatic rewrite and no new conversion API in this change.
Strict equality, concatenation, other arithmetic and portable-data nonfinite
rejection remain outside the semantic change.

GPUI classifies the shared primitive kind (including literal unions), binds both
operands once in order, and compares text via UTF-16 iterators. Numeric operators
remain direct ordered relations, including NaN false and signed-zero equality.
Rust literal encoding now processes original characters, preserving controls and
literal backslash-u text; authored lone-surrogate literals diagnose explicitly.
No Rust toolchain was installed or invoked. Dynamic host string transport is not
expanded or fully accepted by this slice.

Independent static review identified two defects in the first candidate: bottom
against null/boolean escaped GPUI emission as TypeError, and non-literal string
sites could retain lone surrogates which UTF-8 output replaces. Both reproduced
as 4 failed / 86 passed before repair. Bottom comparisons now retain an unreachable
expression with once-only operand evaluation, without reclassifying an empty
domain. All strings sent to the Rust literal encoder now share a diagnostic guard,
including record keys, members, type fields and configuration; any diagnostic
discards the entire generated module. Known owning source spans are carried into
diagnostics. The independent opaque hook registry still uses injective UTF-16
keys, which can represent lone surrogates without Rust strings containing them.
Tests check actual emission failure, successful output UTF-8 roundtripping and
two distinct surrogate hook keys; they do not claim Rust compilation.

A subsequent independent review found that the pre-emission walker also visits
DataType literal nodes, which do not themselves carry source spans. The typed
parameter case reproduced a diagnostic with an undefined span. The walker now
carries the nearest real IR owner span through arrays and schema children;
the regression requires every diagnostic span to belong to the parsed IR and
the parameter diagnostic to cover its actual annotation. PropIR spans currently
cover the descriptor rather than its key token, so the general checks verify
real owner provenance and source bounds, not a fabricated key position.
The expanded four-Web-consumer truth tables include numeric strings ('2' versus
'10') and internally computed positive/negative infinity, with all four operators;
portable-data rejection of nonfinite payloads remains unchanged.
Actual `diagnosticsJson` and text `formatCompilerDiagnostics` both threw while
reading `span.file` on the v2 candidate (3 failed / 103 passed with the new span
and formatter regressions). Their repaired paths must remain explicitly
unsupported and preserve source-backed diagnostics, not silently accept the type
or suppress the formatter call. No formatter source file is changed.

## Evidence and limits

The original two inference/data suites passed 19/19. The first new matrix against
unchanged implementation had 46 failed / 31 passed. After implementation, the
unchanged legacy null>=number acceptance assertion failed explicitly (1 failed /
86 passed); it was migrated to assert rejection rather than removed. These logs
remain in the source-bound review archive. New negative expectations originate
in the current semantic decision, not a claim of historical stable rejection.

The local consumer executes emitted WC and supporting modules with real approved
Floating UI resolved from its declared positioning owner. Transpilation is only
an execution harness; separate targeted TypeScript checking is required. Handwritten
expectations cover number, NaN, signed zero, string prefixes, UTF-16 ordering,
normalization differences, controls and effect order. Unsupported local function
declarations and helper literal argument widening encountered during fixture
construction are preserved as harness failures; they are not fixed by expanding
language admission.

React, Vue3 and Vue2 generated consumers additionally execute the same handwritten
matrix and effect-order probe with lock-pinned official packages, downloaded with
SHA512 verification and without lifecycle execution. Native Qt, Flutter and GPUI
emission checks are not runtime acceptance; native execution remains UNTESTED.
Standard spec authoring initially rejected this candidate's question/case ID
prefixes; those were repaired without changing criteria. Its remaining failures
are the existing P-BASE-SWITCH / C-FIELD-SWITCH-0001 and P-SHADCN-CHECKBOX /
C-CHECKBOX-LABEL-COMPOSITION-0001 relation-version mismatches. Preserve the actual
nonzero result, baseline graph comparison and separate scoped schema evidence;
do not call the repository catalog green. Independent review and hosted CI remain
separate. No UI appearance changes
or browser screenshots are claimed. Astro base-config and missing TypeScript
source-map warnings are retained in local test output.

## Design references

- [TC39 IsLessThan](https://tc39.es/ecma262/#sec-islessthan): UTF-16 code-unit order and numeric unordered behavior, not wholesale JS coercion adoption.
- [Dart String.compareTo](https://api.dart.dev/dart-core/String/compareTo.html): code-unit lexicographic ordering.
- [LLVM fcmp](https://llvm.org/docs/LangRef.html#fcmp-instruction): ordered/unordered distinction, not a backend implementation mandate.

AI assistance: OpenAI Dots.


## Rust 1.85.1 expression evidence — 2026-10-27

This dated addendum supersedes the earlier tool-unavailable statement only for
bounded expression kernels and language probes. It does not change the draft
contract or claim full native acceptance. Production code and test semantics
are unchanged by this record update.

### Source selection and scope

The actual execution source was d4 plus the original seven-path contribution and
bottom fix: tree `f05b162982405f53a20aa18fccc5dd4cf05f8aa9`. The public source
commit supplying those paths is `b6c7fe209395e77e50c3a2abd18ea57d91fc253c`, whose
complete integrated tree is `48a9f9ff2be25c5f29fb29dae044d2f0f9181049`.
These are different full trees. Git comparison found no differences between
them under `packages/compiler`, `packages/core`, or `pnpm-lock.yaml`; that does
not transfer execution acceptance to the full b6 combination.

With those public objects already available in a local clone, reconstruct the
execution projection in a new worktree. `CLONE` and `REPO` must be explicit
absolute paths, and `REPO` must not already exist. This only selects source;
it does not install dependencies or execute the resulting code.

```sh
: "${CLONE:?absolute clone containing the public commits}"
: "${REPO:?absolute new isolated execution worktree}"
git -C "$CLONE" worktree add --detach "$REPO" d4c5587beb00ef058b72473b9b69bd85365e79e7
git -C "$REPO" restore --source=b6c7fe209395e77e50c3a2abd18ea57d91fc253c --staged --worktree -- \
  packages/compiler/src/expression-types.ts \
  packages/compiler/src/gpui-source.ts \
  packages/compiler/test/expression-types.test.ts \
  packages/compiler/test/relational-comparison.test.ts \
  spec/contracts/C-COMPILER-RELATIONAL-0001.yaml \
  spec/tests/T-COMPILER-RELATIONAL-0001.yaml \
  internal/records/2026-10-27-compiler-relational-admission.md
test "$(git -C "$REPO" write-tree)" = f05b162982405f53a20aa18fccc5dd4cf05f8aa9
```

This projection reconstruction was checked by the author with a temporary Git
index; its tree matched exactly. No full new-main project execution was performed.

Use the existing fixed-lock official dependency preparation for that projection:
Node, `tsx` 4.21.0 and its lock-pinned execution dependencies (including esbuild),
and TypeScript 5.9.3, without lifecycle scripts or dependency/lock changes.
The reproduction below does not download or install them. Missing dependencies
are a preparation blocker, not permission to fetch newer versions or use stubs.
`NODE` is the absolute existing Node executable; `REPO/node_modules` must already
contain the verified dependency closure. Python 3 and Linux `unshare` are also
required. If the user/network namespace is unavailable, stop rather than removing
isolation. `OUT` is an absolute, initially empty temporary directory.

`RUSTC` is the absolute executable from the verified temporary standalone
Rust 1.85.1 x86_64-unknown-linux-gnu rustc/std prefix. No Cargo packages or GPUI
build scripts run. Official distribution and checksum:

- https://static.rust-lang.org/dist/rust-1.85.1-x86_64-unknown-linux-gnu.tar.gz
- https://static.rust-lang.org/dist/rust-1.85.1-x86_64-unknown-linux-gnu.tar.gz.sha256
- Observed archive SHA256: `b7202563a52b47f575b284a5a4794fafd688e39bfe8fd855b5e80129e671cb7f`.

The official HTTPS checksum matched. An independently trusted signing-key chain
was not established; this is not a signature-verification claim. Only rustc/std
components were extracted into a temporary prefix, without running an installer,
changing system configuration or resolving Cargo dependencies.

### Complete generation, extraction and test sequence

This uses the actual parser and GPUI emitter, then extracts eight inner
comparisons. The sole semantic adaptation replaces Value conversion calls with
primitive parameters. The extraction manifest records each original fragment,
character offset, byte offset and resulting expression. It fails if a fragment
is absent. Handwritten expectations are independent of the emitter.

NaN and infinities enter the primitive kernel directly, bypassing the generated
public method's finite-number admission. They are kernel robustness/semantics
probes, not proof that the public API permits or successfully receives nonfinite
values. No portable-data boundary is widened.

```sh
set -eu
: "${REPO:?absolute approved execution projection path}"
: "${OUT:?absolute empty temporary output directory}"
: "${NODE:?absolute existing Node binary}"
: "${RUSTC:?absolute verified Rust 1.85.1 rustc binary}"
mkdir -p "$OUT"
cat > "$OUT/kernel-input.proto.ts" <<'PUI_EOF'
import { definePrototype } from '@proto.ui/core';
export default definePrototype({name:'relational-kernel',setup(def){
  def.expose.method('numbers',(a:number,b:number)=>[a<b,a<=b,a>b,a>=b]);
  def.expose.method('strings',(a:string,b:string)=>[a<b,a<=b,a>b,a>=b]);
  return render=>render.el('div',[]);
}});
PUI_EOF
cat > "$OUT/emit.ts" <<'PUI_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
async function main() {
  const [repo, output] = process.argv.slice(2);
  if (!repo || !output) throw new Error('usage: emit.ts REPOSITORY OUTPUT');
  const { parsePrototype } = await import(pathToFileURL(resolve(repo, 'packages/compiler/src/parser.ts')).href);
  const { emitGpuiSource } = await import(pathToFileURL(resolve(repo, 'packages/compiler/src/gpui-source.ts')).href);
  const source = readFileSync(resolve(output, 'kernel-input.proto.ts'), 'utf8');
  const parsed = parsePrototype(source, { fileName: 'kernel-input.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const result = emitGpuiSource(parsed.value);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  writeFileSync(resolve(output, 'kernel-generated.rs'), result.value.code);
  writeFileSync(resolve(output, 'kernel-generated-artifacts.json'), JSON.stringify(result.value, null, 2) + '\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
PUI_EOF
cat > "$OUT/extract.py" <<'PUI_EOF'
# Extract actual emitted inner comparisons, not Value substitutes.
from pathlib import Path
import hashlib,json,sys
r=Path(sys.argv[1]);raw=(r/'kernel-generated.rs').read_text()
ops=['<','<=','>','>='];manifest=[];functions=[]
for kind,signature in [('numbers','a:f64,b:f64'),('strings','a:&str,b:&str')]:
    expressions=[]
    for op in ops:
        fragment=(f'relational_left.scalar_number() {op} relational_right.scalar_number()' if kind=='numbers' else f'relational_left.text().encode_utf16().cmp(relational_right.text().encode_utf16()) {op} std::cmp::Ordering::Equal')
        assert fragment in raw, ('Missing actual emitter fragment',fragment)
        inner=fragment.replace('relational_left.scalar_number()','a').replace('relational_right.scalar_number()','b').replace('relational_left.text()','a').replace('relational_right.text()','b')
        manifest.append({'originalFragment':fragment,'offset':raw.index(fragment),'byteOffset':raw.encode('utf-8').index(fragment.encode('utf-8')),'offsetUnit':'Unicode character index; byteOffset also provided','extractedExpression':inner,'adaptation':'primitive parameters replace Value conversion calls; no Value/GPUI behavior claim'})
        expressions.append(inner)
    functions.append('fn '+kind+'('+signature+')->[bool;4]{['+','.join(expressions)+']}')
(r/'kernel-extracted.rs').write_text('// Extracted expression kernels; Value conversion and framework omitted.\n'+'\n'.join(functions)+'\n')
(r/'extraction-manifest.json').write_text(json.dumps({'generatedSha256':hashlib.sha256(raw.encode()).hexdigest(),'fragments':manifest},indent=2)+'\n')
PUI_EOF
cat > "$OUT/kernel-tests.rs" <<'PUI_EOF'
// HANDWRITTEN independent oracle. Include kernel-extracted.rs only after the
// approved emitter runs and the extraction manifest verifies actual output bytes.
include!("kernel-extracted.rs");
#[test]
fn numeric_relations() {
    for (a,b,expected) in [
        (1.0,2.0,[true,true,false,false]),
        (2.0,1.0,[false,false,true,true]),
        (0.0,-0.0,[false,true,false,true]),
        (f64::NAN,1.0,[false,false,false,false]),
        (1.0,f64::NAN,[false,false,false,false]),
        (f64::NEG_INFINITY,f64::INFINITY,[true,true,false,false]),
        (f64::INFINITY,f64::INFINITY,[false,true,false,true]),
        (f64::NEG_INFINITY,f64::NEG_INFINITY,[false,true,false,true]),
    ] { assert_eq!(numbers(a,b),expected); }
}
#[test]
fn utf16_relations() {
    for (a,b,expected) in [
        ("2","10",[false,false,true,true]),
        ("\u{10000}","\u{e000}",[true,true,false,false]),
        ("\u{e000}","\u{10000}",[false,false,true,true]),
        ("a","a",[false,true,false,true]),
        ("","a",[true,true,false,false]),
    ] { assert_eq!(strings(a,b),expected); }
}
PUI_EOF
cat > "$OUT/receiver-before.rs" <<'PUI_EOF'
// HANDWRITTEN Rust type-inference probe. Not generated GPUI or a Value model.
#![allow(dead_code, unreachable_code)]
fn probe() -> Option<()> {
    ({ let _left = 1; let _right = 2; unreachable!("language probe") }).then_some(())
}
fn main() {}
PUI_EOF
cat > "$OUT/receiver-after.rs" <<'PUI_EOF'
// HANDWRITTEN Rust type-inference probe. Not generated GPUI or a Value model.
#![allow(dead_code, unreachable_code)]
fn probe() -> Option<()> {
    ({ let _left = 1; let _right = 2;
       let result: bool = unreachable!("language probe"); result }).then_some(())
}
fn main() {}
PUI_EOF
unshare --user --net -- "$NODE" --import "$REPO/node_modules/tsx/dist/loader.mjs" "$OUT/emit.ts" "$REPO" "$OUT"
python3 "$OUT/extract.py" "$OUT"
cd "$OUT"
unshare --user --net -- "$RUSTC" --version --verbose
unshare --user --net -- "$RUSTC" --edition=2021 --test kernel-tests.rs -o kernel-tests
unshare --user --net -- "$OUT/kernel-tests" --nocapture
# The old receiver must fail. Keep its diagnostic, not just the exit status.
if unshare --user --net -- "$RUSTC" --edition=2021 receiver-before.rs -o receiver-before > receiver-before.stdout 2> receiver-before.stderr; then
  echo 'Unexpected old receiver success' >&2; exit 1
fi
cat receiver-before.stderr
unshare --user --net -- "$RUSTC" --edition=2021 receiver-after.rs -o receiver-after
# Do not call either divergent receiver probe.
```

For direct inspection, the extracted kernel text is reproduced below. The script
above regenerates it from actual output; this block is not a substitute emitter
or a GPUI Value model.

```rust
// Extracted expression kernels; Value conversion and framework omitted.
fn numbers(a:f64,b:f64)->[bool;4]{[a < b,a <= b,a > b,a >= b]}
fn strings(a:&str,b:&str)->[bool;4]{[a.encode_utf16().cmp(b.encode_utf16()) < std::cmp::Ordering::Equal,a.encode_utf16().cmp(b.encode_utf16()) <= std::cmp::Ordering::Equal,a.encode_utf16().cmp(b.encode_utf16()) > std::cmp::Ordering::Equal,a.encode_utf16().cmp(b.encode_utf16()) >= std::cmp::Ordering::Equal]}
```

### Actual observations and provenance

The portable sequence above was executed from the approved projection on
2026-10-27T18:01:58.305069Z–18:01:59.859179Z, exit 0. Generated code, supporting
artifacts, extracted kernel, oracle and both language probes remained byte-for-byte
equal to the prior evidence. No full b6 project code was executed.

- `rustc 1.85.1 (4eb161250 2025-03-15)`, host x86_64-unknown-linux-gnu,
  commit `4eb161250e340c8f48f66e2b929ef4a5bed7c181`, LLVM 19.1.7.
- Kernel compilation exit 0; execution: `2 passed; 0 failed`, covering 13 input
  pairs and 52 relational results. Numeric strings use lexical rather than numeric
  order; U+10000 sorts before U+E000 by UTF-16 code units.
- Handwritten bool/then_some receiver-before: exit 1, E0282, “type annotations
  needed / cannot infer type”. Receiver-after: exit 0 with one unused-variable
  warning for `result`. Neither divergent probe was called. These probes do not
  compile the actual GPUI Value or complete generated component.

The first standalone generation/extraction stdout/stderr files were not retained;
conversation tool results reported exit 0 and empty output. They were not backfilled.
Fresh generation at 2026-10-27T17:59:03.987422Z–17:59:04.862146Z and extraction at
17:59:04.862162Z–17:59:04.896725Z each exited 0 with separately saved empty stdout
and stderr, reproducing the original bytes. The later portable run above is a
third distinct record, not a re-dating of the original Rust results.

SHA256 values:

- `kernel-generated.rs`: `412eb9aa8907be002ba8c3e7f5a9103dc32ddf86bdc6b9aa5ecf91d96f19a649`.
- `kernel-generated-artifacts.json`: `c21de54294e0225aebb3eb681f35a8426f038ca417a4acf7843ffbf5bd27a7fc`.
- `kernel-extracted.rs`: `f5c5853c3d21f3fca9bcbbed9174d7002975654656abd639ebef109c71a318d0`.
- `kernel-tests.rs`: `4b6d6031cfc1a66040a77a01fb94270a9362ee97e769a1682f8fb691b0562e88`.
- `receiver-before.rs`: `6f0d147dd2c6736e013725c7e90d3194af43c425cc25e850ffb1280be79cea1f`.
- `receiver-after.rs`: `6677254da5607543131c9f791886c0f4a0dc5bb06c5776f8f7e8777c9847e493`.

Raw `kernel-input.proto.ts` SHA256 is
`84a03a6a5cd6b7ed960717f9c2f20fd70f565521d0c760ae9e18d09fb90cece1`.
The emitted `provenance.source.sha256` is instead
`40aeaef17b572ae6b9d76a029fa72336c1239fd67ae5675f79ab83af6bbae906`:
`parser.ts:654–657` hashes `JSON.stringify` of sorted module `[file, full text]`
pairs; `gpui-source.ts` copies `ir.source` into provenance. Here the sole pair is
`['kernel-input.proto.ts', rawSourceText]`. This path-bearing source-graph digest
is neither the raw-file digest nor an IR digest. Exact input text is preserved.

The scoped evidence archive contains inputs, outputs, extraction mappings and
execution logs, but not the complete Compiler tree or large Rust distribution.
Review of that archive alone can rehash its contained files and source-graph input;
it cannot independently rehash the omitted tree or tool archive. The public
source-selection procedure and official checksum URL make those separate checks
possible without publishing a private Library link.

Main's separate [Rust 1.99.1 control](https://github.com/Proto-UI/Proto-UI/pull/1024#issuecomment-6449556146)
used actual old374/newb6 generated conditions wrapped in a minimal Value/Json
context, edition2021 `--emit=metadata`: old E0599, new exit0 with an unreachable
warning. That is not this Rust1.85.1 handwritten bool E0282 result, and neither is
full GPUI consumer acceptance. Main's [complete b6 JS 216-test run](https://github.com/Proto-UI/Proto-UI/pull/1024#issuecomment-6449049218)
likewise remains a distinct execution record.

### Remaining acceptance conditions

Draft `C-COMPILER-RELATIONAL-0001-Q-NATIVE-EVIDENCE` still calls for independent
review and GPUI/Flutter/Qt consumer evidence, including host string transport,
before stable admission. These kernels do not cover Value conversions, complete
expression evaluation order, framework compilation, lifecycle or rendering.
Lone-surrogate transport is not represented by Rust `str` probes. Full generated
GPUI modules, Qt and Flutter consumers remain UNTESTED by this author validation.
Existing CI failures and other owners' work remain separate; no
`COMPILER_MERGE_READY`, formal approval, ready transition or merge is asserted.
