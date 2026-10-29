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

## Complete generated GPUI compile checks — 2026-10-27

Two additional author checks used the real generated components and complete
`proto-ui-gpui-native` Value/host SDK against pinned GPUI, not extracted kernels
or replacement Value wrappers. Source generation remained on the approved d4-based
projection `f05b162982405f53a20aa18fccc5dd4cf05f8aa9`; this is not execution of the
complete b6/cf88 repository combination. Only temporary artifact/lock preparation
and offline compile-only dependency execution were in scope. No component ran,
repository dependency changed, system package was installed or lifecycle claim
was promoted. Earlier evidence and failures above remain historical records.

| Fixture | Source / IR provenance | Complete generated artifacts | Consumer lock SHA256 |
| --- | --- | --- | --- |
| numbers/strings | Raw input SHA256 `84a03a6a5cd6b7ed960717f9c2f20fd70f565521d0c760ae9e18d09fb90cece1`; source-graph provenance `40aeaef17b572ae6b9d76a029fa72336c1239fd67ae5675f79ab83af6bbae906`. No separate parsed-IR JSON was retained for this fixture; do not invent an IR-file hash. | Component.rs `412eb9aa8907be002ba8c3e7f5a9103dc32ddf86bdc6b9aa5ecf91d96f19a649`; generated-artifacts JSON `c21de54294e0225aebb3eb681f35a8426f038ca417a4acf7843ffbf5bd27a7fc`; all 16 supporting files materialized. | `d719415271ffb4ad9f64e8183fe81d1e149cb8b82d97628abcebe0399d250bec` |
| canonical bottom condition | Raw input SHA256 `5612f69d80a9181b1a5d62df87d4cb49acab2dfe1f8978d8571b19203fd5a194`; saved parsed-IR JSON `4b408a699bde5eb72f360cd9c7808c0f8b5e9e4b17d2e60f00744b15e906992a`. Source produces canonical `union[]`; no nested-IR mutation. | Component.rs `3055e075cdea2d8d8c46a523cd1003c84b03bbb058572a59d664b1951805c124`; generated-artifacts JSON `557730253fd2923f6e1daa9f38785733887cb7c98bb522a9be3e1423872d60c3`; all 16 supporting files materialized. | `56a64cbff1ed36d330f6a48b37aa307454b8b2c49272d95c32cffa3a37c8ea2b` |

The numbers/strings input and generation method appear in the prior appendix.
The canonical bottom input was the existing condition probe, parsed with
`fileName: 'bottom-condition.proto.ts'`, validated, then emitted without IR edits:

```ts
import {definePrototype} from '@proto.ui/core';export default definePrototype({name:'bottom',setup(def){def.expose.method('compare',(x:'a')=>{if(x==='a')return false;if(x<null)return true;return false;});return r=>r.el('div',[]);}});
```

Write each emitter result's `code` to `Component.rs` and every `supportingFiles`
entry to its exact safe relative path, including Cargo manifests and SDK sources.
The bottom `.truthy()` condition therefore type-checks against the real Value,
not a manually reconstructed enum. Separate directories preserve both fixtures.
Their lock comparison found only the local generated root name changed:
`generated-gpui-c4930c3117456cbe637f58e70cdd9e75` versus
`generated-gpui-d7d4d4245a21b29251b4b476a68e67d8`. All third-party
name/version/source/checksum tuples, third-party features and SDK supporting
bytes were identical. Both locks contain 479 packages: 458 registry packages,
19 Git packages at four pinned revisions, and two local packages.

Toolchain: official Rust/Cargo 1.98.1 x86_64-unknown-linux-gnu; rustc commit
`48a229ceaefd4985c50990b14116b6d856af0985`, Cargo commit
`797e8a9bca276c1c9f9f738d2a20f484fa4eea9d`. Official standalone archive SHA256
`24ba1338a2d35c5a3247936546429e163fa674d726102af18bdf624582c57aea`
matched its official HTTPS checksum; no independently trusted signing-key chain
verification is claimed. Before compilation, all registry archive hashes and
extracted member bytes/types/executable bits were checked; four Git checkouts
were checked against 4,703 tracked blob bytes, executable modes and symlink
contents. Existing Cargo extraction permissions strip group/other access; no
permission changes were made. The bottom precompile check was recorded at
18:52:48–18:52:54Z. A separate delayed read-only postcompile check ran at
2026-10-27T19:01:55.008467+00:00–2026-10-27T19:02:00.773185+00:00; it compared all
18 consumer files (including lock) against retained evidence hashes,
458 registry archives/extracted contents and four Git checkouts (4,703 tracked
entries), including untracked/ignored-file checks. It found no changes or errors.
This was performed after review identified the missing postcompile report, not
at compilation completion; no claim of continuous observation is made. The
original compile runner itself checked only the lock before/after.

For each exact fixture, the successful command was equivalent to the following,
with absolute prepared paths, a scoped credential-free environment, one worker,
no proxy/token values and a fresh network namespace. `--offline` was additional
Cargo enforcement, not a substitute for isolating build-script networking.

```sh
unshare --user --net -- env -i PATH="$TOOLCHAIN_BIN:/usr/bin:/bin" LANG=C.UTF-8 \
  CARGO_HOME="$SCOPED_CARGO_HOME" CARGO_TARGET_DIR="$FIXTURE_TARGET" \
  RUSTC="$VERIFIED_RUSTC" CARGO_NET_OFFLINE=true CARGO_BUILD_JOBS=1 \
  "$VERIFIED_CARGO" check --manifest-path "$CONSUMER/Cargo.toml" \
  --lib --target x86_64-unknown-linux-gnu --locked --offline --message-format=json
```

| Actual check | Result and retained diagnostics | Resource observation |
| --- | --- | --- |
| numbers/strings, started 18:47:34Z | exit 0; 0 errors, 4 unused-variable warnings: `value` at Component.rs:12/19 and `window`/`cx` at :126. | 125.17 s wall; child maxRSS 851,704 KiB. |
| canonical bottom, started 18:53:05Z | exit 0; 0 errors, 5 warnings: unreachable expression at Component.rs:76 plus unused `value` at :12/19 and `window`/`cx` at :117. | 121.87 s wall; child maxRSS 851,676 KiB. |

Each run observed 287 distinct package IDs and 342 compiler-artifact events
(all `fresh: false`); 40 build-script-executed events involved 33 distinct
packages, and 23 packages produced proc-macro artifacts. Event counts and package
counts are different; neither is a count of proc-macro invocations.
Child maxRSS is not aggregate concurrent memory peak. Warnings were retained,
not newly suppressed; no `-D warnings` pass is claimed. The first numbers/strings
launcher failed exit127 because `/usr/bin/time` was missing, before Cargo ran;
that failure was preserved, then existing Python resource accounting replaced
only the measurement wrapper. Earlier metadata DNS failure and its successful
retry inheriting unchanged platform network settings remain separate records.
No dependency scripts ran during the prior metadata-only stage.

Public reproduction limits: this record provides inputs, generation/check methods
and exact lock digests, but the two complete consumer locks and dependency/tool
archives are currently retained only in the evidence packages/temporary workspace,
not checked into this public repository. Thus the public text alone is not a
self-contained or fully offline reproducible build. Do not use a private Library
link as public evidence, silently regenerate a different lock, or claim omitted
archives were independently rehashed by a reviewer of the compact evidence ZIP.

These full-module checks add a new evidence layer. Earlier Rust1.85.1 primitive
kernels and handwritten bool receiver controls remain separate; their NaN/Infinity
inputs bypass public finite-number admission. Main's Rust1.99.1 generated-condition
plus minimal Value/Json wrapper is also a separate isolation control. The new
checks establish complete-module type compatibility for the two named fixtures,
not execution of relational truth tables or unreachable code. Nested IR, the full
operator/position matrix, lifecycle, host string transport, windows/rendering,
Qt and Flutter remain outside these checks.

`C-COMPILER-RELATIONAL-0001-Q-NATIVE-EVIDENCE` and
`T-COMPILER-RELATIONAL-0001-Q-INDEPENDENT-AND-NATIVE` remain open for stable
activation; no spec lifecycle or acceptance criteria changed. Formal review and
applicable exact-head CI remain separate repository conditions. No
`COMPILER_MERGE_READY` is asserted by these author compile-only results.

## Official GPUI public-entry runtime check — 2026-10-27

This additional author-run check uses the unchanged numbers/strings complete
consumer described above, generated from projection
`f05b162982405f53a20aa18fccc5dd4cf05f8aa9`. It is not execution of the complete
current PR or newer main. The earlier compile-only and kernel records remain
historical, not rewritten as runtime results. No implementation, assertion,
entity lifecycle or dependency declaration in this repository changed.

Rust/Cargo 1.98.1 and official distribution checksum remain as recorded above;
no independent signing-key chain verification is claimed. The unchanged
479-package lock selects 301 packages for this Linux test, including 34
build-script packages and 24 proc-macro packages. The added test-support closure
was explicitly admitted before execution, not inferred from its manifest presence.
Offline Cargo tree and actual build packages/features exactly matched the reviewed
envelope. Successful build produced 358 compiler-artifact events and 41
build-script-executed events across those 34 packages; event counts are not
package counts or counts of macro invocations. All 458 registry archives/extracted
contents and four Git sources/4,703 tracked entries were checked before and after;
consumer input hashes and lock were unchanged. No credentials, system packages or
network access were used during building/running; a fresh user/network namespace
supplemented Cargo offline mode. This user/network namespace plus environment
cleanup is not a mount namespace or filesystem-allowlist strong sandbox.

First no-run build: 20:29:25.203377–20:32:48.748870 UTC, exit 101, ENOSPC writing
GPUI's rlib; no test ran. Its stdout/stderr and hash/size inventory of 2,731 failed
target files were retained. Only that task's failed target cache was removed
(1,951,582,783 bytes); debug information and incremental compilation were disabled
for resource recovery. Opt-level 0, debug assertions, overflow checks, all source
bytes, dependencies/features and assertions remained unchanged. Second no-run
build: 20:33:25.042777–20:36:29.556819 UTC, exit 0, 184.514 seconds, child maxRSS
1,178,100 KiB. This was a build recovery, not a retry of a failed behavioral test.
Four unused-variable warnings (`value` twice, `window`, `cx`) were preserved.

The **only runtime invocation** was 20:38:36.203075–20:38:36.578827 UTC, exit 0,
0.376 seconds, child maxRSS 106,572 KiB. Actual output:

```text
running 1 test
test relational_public ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

The single test uses four macro-managed official contexts, one iteration and zero
retries. Its successful loops perform 24 valid typed/generic public-entry calls
(8 numeric and 16 string), checking 96 relational booleans, plus three exact-message
admission rejections. Counts derive from the unchanged source and passing test,
not independent runtime telemetry. Actual generated Value/SDK conversions and
public dispatch are exercised; there is no replacement Value or forged Window/App.
Construction, explicit disposal and macro cleanup are outside the rejection catch.
Default Rust output capture was retained: successful expected panic output is not
separately visible in the console log; no diagnostic-only rerun was made.

### Prepared-input reproduction

Select/rebuild the fixed projection and emit the complete numbers/strings consumer
using the earlier appendix, preserving all 16 supporting files. The generated
Cargo.toml already has GPUI pinned to
`62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`, including dev feature `test-support`.
Use the exact previously verified lock and dependency archive/checkouts; do not
silently resolve newer dependencies. This public record supplies the complete test
and command sequence, but the full lock, dependency/tool archives, executable, complete approved source
baseline and official macro source remain outside
the public repository. Therefore it is **not self-contained offline reproduction**
from this text alone. Byte-verification reports do not substitute for possessing
and verifying those omitted inputs. The commands parameterize prepared absolute
paths; the no-run command below passes the same harmless runner argument as the
run stage, whereas the recorded no-run invocation omitted the trailing runner
argument. No new execution of this reformatted recipe is claimed.

```sh
# Prerequisites: absolute, separately verified prepared paths. Do not resolve a
# new lock or download dependencies as part of this offline procedure.
: "${CONSUMER:?unchanged numbers/strings full consumer directory}"
: "${TOOLCHAIN_BIN:?verified Rust/Cargo 1.98.1 bin directory}"
: "${SCOPED_CARGO_HOME:?verified fixed dependency cache}"
: "${FIXTURE_TARGET:?dedicated disposable target directory}"
: "${LOG_DIR:?separate existing evidence directory}"
# Save the exact Rust block below to $CONSUMER/tests/relational_public.rs.
# Cargo.toml must be the generated manifest, including pinned GPUI test-support.
printf '%s  %s\n' \
  d719415271ffb4ad9f64e8183fe81d1e149cb8b82d97628abcebe0399d250bec "$CONSUMER/Cargo.lock" \
  95d8664fa269fbf98c2fa16a6160f2898d21eb450551b013470979068734fc83 "$CONSUMER/tests/relational_public.rs" \
  412eb9aa8907be002ba8c3e7f5a9103dc32ddf86bdc6b9aa5ecf91d96f19a649 "$CONSUMER/Component.rs" | sha256sum -c -
# Both commands use the same profile; debug assertions/overflow checks stay on.
for stage in build run; do
  set --
  if [ "$stage" = build ]; then set -- --no-run; fi
  unshare --user --net -- env -i \
    PATH="$TOOLCHAIN_BIN:/usr/bin:/bin" LANG=C.UTF-8 \
    CARGO_HOME="$SCOPED_CARGO_HOME" CARGO_TARGET_DIR="$FIXTURE_TARGET" \
    RUSTC="$TOOLCHAIN_BIN/rustc" CARGO_NET_OFFLINE=true CARGO_BUILD_JOBS=1 \
    CARGO_PROFILE_DEV_DEBUG=0 CARGO_PROFILE_TEST_DEBUG=0 CARGO_INCREMENTAL=0 \
    "$TOOLCHAIN_BIN/cargo" test --manifest-path "$CONSUMER/Cargo.toml" \
    --test relational_public --target x86_64-unknown-linux-gnu \
    --locked --offline --message-format=json "$@" -- --test-threads=1 \
    > "$LOG_DIR/$stage.stdout" 2> "$LOG_DIR/$stage.stderr" || exit "$?"
done
```

Complete `tests/relational_public.rs` below has SHA256
`95d8664fa269fbf98c2fa16a6160f2898d21eb450551b013470979068734fc83`.
Its historical draft header is retained to preserve approved/executed bytes;
the dated execution record above supersedes that header's unexecuted status.
The final comment claiming panic diagnostics remain visible is also historical:
default successful-test capture hides them; executed source bytes were not edited.

```rust
// REVIEW DRAFT ONLY: not compiled or executed.
// Uses the unchanged generated_gpui_component and its real Value/SDK.
use generated_gpui_component::CompiledComponent;
use gpui::{AppContext, TestAppContext};
use serde_json::{json, Value as Json};
use std::panic::{catch_unwind, AssertUnwindSafe};

// Official macro supplies separate real contexts and its documented teardown.
// One iteration, fixed seed, no retries; no user-defined platform or fake refs.
#[gpui::test(iterations = 1, retries = 0, seed = 0)]
fn relational_public(
    cx: &mut TestAppContext,
    reject_null: &mut TestAppContext,
    reject_bool: &mut TestAppContext,
    reject_string: &mut TestAppContext,
) {
    cx.skip_drawing();
    let window = cx.add_window(|window, cx| {
        CompiledComponent::new(json!({}), None, window, cx)
    });
    // End the component read borrow before native_drive may update that entity.
    let handle = window.read_with(cx, |component, _| component.handle()).unwrap();
    let numbers: &[(f64, f64, [bool; 4])] = &[
        (2.0, 10.0, [true, true, false, false]),
        (10.0, 2.0, [false, false, true, true]),
        (-0.0, 0.0, [false, true, false, true]),
        (3.5, 3.5, [false, true, false, true]),
    ];
    for &(a, b, expected) in numbers {
        let actual = cx.update_window(window.into(), |_, window, app| {
            handle.method_0(a, b, window, app)
        }).unwrap();
        assert_eq!(actual, expected.to_vec(), "finite numbers {a:?}, {b:?}");
        let generic = cx.update_window(window.into(), |_, window, app| {
            handle.call("numbers", vec![json!(a), json!(b)], window, app)
        }).unwrap();
        assert_eq!(generic, json!(expected));
    }
    let strings: &[(&str, &str, [bool; 4])] = &[
        ("2", "10", [false, false, true, true]),
        ("\u{10000}", "\u{e000}", [true, true, false, false]),
        ("", "a", [true, true, false, false]),
        ("a", "aa", [true, true, false, false]),
        ("same", "same", [false, true, false, true]),
        ("\u{e9}", "e\u{301}", [false, false, true, true]),
        ("\0a", "\0b", [true, true, false, false]),
        ("\u{1}", "\u{2}", [true, true, false, false]),
    ];
    for &(a, b, expected) in strings {
        let actual = cx.update_window(window.into(), |_, window, app| {
            handle.method_1(a.to_owned(), b.to_owned(), window, app)
        }).unwrap();
        assert_eq!(actual, expected.to_vec(), "strings {a:?}, {b:?}");
        let generic = cx.update_window(window.into(), |_, window, app| {
            handle.call("strings", vec![json!(a), json!(b)], window, app)
        }).unwrap();
        assert_eq!(generic, json!(expected));
    }
    cx.update_window(window.into(), |_, window, app| {
        handle.dispose(window, app);
    }).unwrap();
    drop(handle);

    // Each rejection has a separate macro-owned official context.
    // Only the actual generated public call is caught, inside a normally
    // returning GPUI update closure. Construction/update/teardown failures
    // escape and fail the test; they cannot count as argument rejection.
    let invalid: [(&mut TestAppContext, &str, [Json; 2]); 3] = [
        (reject_null, "numbers", [Json::Null, json!(1)]),
        (reject_bool, "numbers", [json!(true), json!(1)]),
        (reject_string, "strings", [json!(1), json!("x")]),
    ];
    for (cx, name, arguments) in invalid {
        cx.skip_drawing();
        let window = cx.add_window(|window, cx| {
            CompiledComponent::new(json!({}), None, window, cx)
        });
        let handle = window.read_with(cx, |component, _| component.handle()).unwrap();
        let rejected = cx.update_window(window.into(), |_, window, app| {
            catch_unwind(AssertUnwindSafe(|| {
                handle.call(name, arguments.to_vec(), window, app)
            }))
        }).unwrap();
        // The rejected call stops in check_method before invoke/phase change.
        // Disposal is outside catch; a cleanup panic is a test failure.
        cx.update_window(window.into(), |_, window, app| {
            handle.dispose(window, app);
        }).unwrap();
        drop(handle);
        let error = rejected.expect_err("invalid public entry must reject");
        let message = error.downcast_ref::<String>().map(String::as_str)
            .or_else(|| error.downcast_ref::<&str>().copied()).unwrap_or("");
        assert_eq!(message, "invalid exposed method arguments",
                   "unexpected panic, not admission rejection");
    }
    // Macro handles parked tasks, app quit, context drop and dispatcher drain.
    // No panic hook suppression: expected rejection diagnostics remain visible.
}
```

This checks listed finite-number and valid Rust/JSON string transport cases,
including numeric-looking strings, UTF-16 supplementary/BMP ordering, prefixes,
combining sequences and controls. It does not admit nonfinite public inputs or
lone surrogates. Drawing was skipped on official TestPlatform; no real OS window,
font/rendering/clipboard or external HTTP behavior was accepted. Four simple
construct/dispose paths are not the full lifecycle/reentrancy matrix. Bottom
runtime, the full operator/position matrix, Qt/Flutter, stable activation,
independent acceptance and current whole-tree CI remain separate. The prior
canonical/nested complete-artifact equivalence is not a bottom runtime execution.
`COMPILER_MERGE_READY=false / pending` remains unchanged.

## Spelling-independent relational source smoke — 2026-10-29

This follow-up addresses PR #1024 QA comment 6481013117 on source head
`418a42bbb77a2143c75cb3eec17fbef533d033d2`. It changes only the existing
relational test and this record, not Compiler production behavior or draft
admission semantics. The original record and all historical failures remain.

The old string regex required `relational_left`, `relational_right` and same-line
`; let` text. Its bottom counterpart also fixed three temporary names and panic
prose. Two disposable controls against actual emitted source reproduced the
false-negative mechanism: consistent left-temporary renaming and a newline after
the first semicolon each failed the old regex (2 failed / 175 skipped, exit 1).
The controls and their failures were retained outside the production candidate;
this is an oracle failure, not a Compiler or Rust runtime failure.

The replacement is a fast token/binding structural smoke, explicitly not a Rust
parser or native acceptance. It ignores whitespace between tokens, keeps string
values intact, tolerates equivalent Unicode escape spelling, and captures distinct
temporary names with consistent references. The bottom fixture discovers its
unique argument-zero binding rather than fixing the generated parameter name.
It still requires the expected operand identities in order, each once within the
matched block, a divergent `Value`-typed result and its corresponding receiver.
Panic string wording is not contractual. Source text in comments, additional
work outside the matched block and general Rust syntax remain outside this
bounded smoke; actual behavior requires separate native evidence.

Positive controls transform each actual emitted artifact, not historical output:
rename temporaries (and the bottom input binding), introduce newlines, vary bottom
panic prose and use equivalent Unicode escapes. Handwritten negative controls
reject reversed operand evaluation, repeated left or right evaluation, duplicated
blocks and collided bindings. All four operators, all 64 bottom cases (rhs
null/false, return/condition/not/logical-left, canonical/nested IR), source/IR
rejections, independent numeric/UTF-16 expectations and Web effect tests remain.

Actual author validation on the fixed current source, with original Vitest
configuration and dependency versions unchanged:

- Before the test change: five files, **216 passed**, exit 0.
- After the test change: the same five files, **221 passed**, exit 0.
- TypeScript 5.9.3 scoped `tsc --noEmit`: exit 0, no diagnostics; original strict
  and skipLibCheck settings retained, not whole-repository type acceptance.
- `git diff --check`: exit 0. Fresh-context static source/log review found no
  definite blocker for this bounded Draft update; no formal approval occurred.

Commands, run with a credential-free environment, isolated HOME/TMPDIR and an
inherited seccomp restriction denying socket creation:

```sh
node node_modules/vitest/vitest.mjs run \
  packages/compiler/test/expression-types.test.ts \
  packages/compiler/test/data-types.test.ts \
  packages/compiler/test/relational-comparison.test.ts \
  packages/compiler/test/parser.test.ts \
  packages/compiler/test/targets.test.ts --maxWorkers=1 --minWorkers=1
node node_modules/typescript/bin/tsc -p <scoped-config-extending-repo-tsconfig> --noEmit
```

All 86 prior locked npm packages were restored from official registry metadata;
tarball SHA512 and SHA256 matched the retained inventory before execution. No
lifecycle script, package upgrade or dependency/lock edit occurred. `pnpm-lock.yaml`
blob `2e61d039437eb82af7068653be86e553f2304e0e` is identical at d4 and this
418a baseline. Existing missing Astro base-config, TypeScript source-map and Vue2
development notices remain in logs. The baseline log clock used the runner's
local zone; subsequent runs explicitly set UTC. This isolation does not claim a
mount/filesystem allowlist sandbox. The record is not a self-contained offline
distribution of the dependency archives.

Patch reviewed and explicitly approved for isolated execution:
`9ad093a342007806d7ed8e603df0d4e609eeccd838e4f611e317a8fc4842a2b6` (SHA256).
Applied test file:
`5e31acd2e3065b07735a61255f78785d97798a8b01f3d45ad2a7177f8e77f403` (SHA256).
The preparation copy had one additional trailing LF; applying the unchanged
approved patch to the exact Git source preserves its actual file ending.

Native verification is still in progress at this append. New generation emitted
64 bottom inputs plus numbers/strings and reachable effect-order consumers;
18 complete byte classes and their alpha-renamed/formatted variants are prepared.
An initial external generator helper failed because top-level await was treated
as CommonJS; the preserved retry uses `.mts` and succeeded. This is a harness
format correction, not a product fix or native pass. Fixed Rust/Cargo 1.98.1 and
the original GPUI dependency closure are being restored and verified; no result
is transferred from the historical f05b native receipts. Reversed/double-evaluation
runtime controls, native compilation, broader host domains, Qt/Flutter, formal
independent review and exact new-head CI remain distinct conditions. Draft and
`COMPILER_MERGE_READY=false / pending` remain; no merge or issue closure is claimed.

The specifically authorized #1019 body appendix records the bounded original-owner
continuation without rewriting prior text or changing closed state. Its actual
lease is 2026-10-29T14:14:38Z through 2026-10-30T14:14:38Z, no automatic extension;
PR receipt: https://github.com/Proto-UI/Proto-UI/pull/1024#issuecomment-6499173791.
It does not take over frozen #902 work, #1032 fixture repair, capture timestamps
or any other owner. AI assistance: OpenAI Dots.


## Complete native source controls and per-operator negative evidence — 2026-10-29

This append closes the earlier publication-time “native in progress” note; it
preserves that historical text rather than rewriting it. Executed generation is
bound to `418a42bbb77a2143c75cb3eec17fbef533d033d2` plus the explicitly approved
patch SHA256 `9ad093a342007806d7ed8e603df0d4e609eeccd838e4f611e317a8fc4842a2b6`.
Those Compiler bytes were published at `da5c2b1c2441bbe640de3f267046d77bdd6f4665`.
Neither later integrated `43d6320bcedc125d520e6c1fe1f545fd55241cca` nor current
main `9ab0fcad0fd9b5b49513a6b335e5007abea2d844` was locally executed by this
validation. This documentation update is not a source execution approval.

### Completed v3 results, including the invalid cache experiment

At 14:46:45–14:49:04 UTC, the 64 bottom inputs formed 16 byte-identical full
compile-file classes (including supporting files); original/equivalent pairs
produced 32 successful full-consumer cargo checks. This reduction is not full
artifact/provenance equivalence. Reachable numbers/strings and effect-order
original/equivalent consumers each ran through official GPUI TestAppContext:
four successful runtime invocations. Each numbers/strings invocation exercised
24 typed/generic public calls, 96 relational results and three exact admission
rejections. Bottom evidence is compilation, not execution of unreachable code.

The first v2 experiment shared a target directory without invalidating same-named
generated roots. Its equivalent checks reused old rmeta; even a deliberately
reversed consumer incorrectly passed. **All v2 results are excluded from
acceptance.** v3 cleans only each generated root before check/no-run, requires
all root compiler-artifact events to have `fresh=false`, records actual `-vv`
rustc commands and input hashes, and copies/hashes rmeta/rlib/test executables
before the next fixture. Third-party cache reuse is retained and disclosed.
The later runtime command uses its own just-built executable; this is not a
claim that every dependency was rebuilt from an empty target.

v3 retained all warnings: 216 across 32 checks and 24 across six no-run commands.
The original `.ts` helper top-level-await format failure and duplicate prepared
`[dev-dependencies]` failure remain historical harness errors, not product
failures or successful native evidence. The fixed generated manifest was used
without adding dependency features. The v3 summary SHA256 is
`aabe639c48b99646b988f45f23d246bcd6b76cf4b6ebfb1af93b4e195fbb8c31`.

v3's two deliberately broken variants compiled successfully and failed at the
first `operator0 repetition0` LR assertion, observing RL and LLR. This proves
only that first negative case: its single test stopped there. The following v4
run addresses that specific gap without changing production code or dependencies.

### Four independent operator controls (v4)

The only changed byte content in each v4 consumer copy is its own
`tests/effect_order.rs` harness below. Original/equivalent/reversed/double-left
`Component.rs`, generated supporting files, manifests and locks are unchanged
from v3. Each operator now has an independent official GPUI context/test, one
iteration, fixed seed and zero retries. Positive cases repeat twice and check
both the result and accumulated LR/LRLR trace. Each negative test fails on its
first repetition, so there is no claim that negative second repetitions ran.

Actual generated-input fixture (unchanged, including its redundant semicolon):

```typescript
import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'relational',setup(def){const log=def.state.string('log','');const left=()=>{log.set(log.get()+'L');return 1;};const right=()=>{log.set(log.get()+'R');return 2;};def.expose.method('compare0',()=>left() < right());def.expose.method('compare1',()=>left() <= right());def.expose.method('compare2',()=>left() > right());def.expose.method('compare3',()=>left() >= right());def.expose.method('trace',()=>log.get());;return r=>r.el('div',[]);}});
```

Actual complete v4 test harness, retained verbatim rather than reformatted:

```rust
// Actual generated component and official GPUI TestAppContext; not a mock Value.
use generated_gpui_component::CompiledComponent;
use gpui::{AppContext, TestAppContext};
use serde_json::json;

fn check_operator(cx: &mut TestAppContext, index: usize, expected: bool) {
    cx.skip_drawing();
    let window = cx.add_window(|window, cx| CompiledComponent::new(json!({}), None, window, cx));
    let handle = window.read_with(cx, |component, _| component.handle()).unwrap();
    let mut expected_trace = String::new();
        for repetition in 0..2 {
            let actual = cx.update_window(window.into(), |_, window, app| {
                handle.call(&format!("compare{index}"), vec![], window, app)
            }).unwrap();
            assert_eq!(actual, json!(expected), "operator{index} repetition{repetition}");
            expected_trace.push_str("LR");
            let trace = cx.update_window(window.into(), |_, window, app| {
                handle.call("trace", vec![], window, app)
            }).unwrap();
            assert_eq!(trace, json!(expected_trace), "ordered once-only operator{index} repetition{repetition}");
        }
    cx.update_window(window.into(), |_, window, app| handle.dispose(window, app)).unwrap();
    drop(handle);
}

#[gpui::test(iterations = 1, retries = 0, seed = 0)]
fn relational_effect_order_op0(cx: &mut TestAppContext) {
    check_operator(cx, 0, true);
}

#[gpui::test(iterations = 1, retries = 0, seed = 0)]
fn relational_effect_order_op1(cx: &mut TestAppContext) {
    check_operator(cx, 1, true);
}

#[gpui::test(iterations = 1, retries = 0, seed = 0)]
fn relational_effect_order_op2(cx: &mut TestAppContext) {
    check_operator(cx, 2, false);
}

#[gpui::test(iterations = 1, retries = 0, seed = 0)]
fn relational_effect_order_op3(cx: &mut TestAppContext) {
    check_operator(cx, 3, false);
}
```

Harness SHA256: `67ab3e3d12d83c030b9ac4a130b219c28514add2cd375d0a05d44e731e04d86f`.

| Consumer | Component.rs SHA256 | no-run exit | runtime exit |
| --- | --- | --- | --- |
| `effect-order` | `a72008c40de9844e318bba90819cf1f636a3b5038d69e7cf07a8245b175b9cc7` | 0 | 0 |
| `effect-order-equivalent` | `90b47aeb8db453dfca77d8f4f5618abf69df86cfc0178c0e8212d06aa875efd7` | 0 | 0 |
| `effect-order-reversed` | `05257fdc8c285557220dc6d9e401a7e5ea618f1efc152f7887d840f11bcead00` | 0 | 101 |
| `effect-order-double-left` | `6bd87048d917e619c5674281c0dfea1ff6f2dd93ec938bdd385f5974701653f8` | 0 | 101 |

Both original and alpha-renamed/reformatted variants passed all four tests:
eight positive test results across two runtime invocations. Both deliberately
broken variants compiled first, then failed all four independent tests:
eight expected negative results across two runtime invocations. For each of
`operator0`, `operator1`, `operator2`, `operator3`, the reversed variant observed
`String("RL")` and the double-left variant `String("LLR")`, versus
`String("LR")`, at the ordered-once assertion. The bool result assertion ran
first. A compiler error, environment failure or arbitrary nonzero exit is not
counted as a negative semantic result. No double-right native mutation was
added, and this is not a complete mutation-testing suite.

### Reproduction contract and evidence boundary

Use the unchanged emitted complete consumer, its generated manifest and the
retained locked dependencies; install the test above as `tests/effect_order.rs`.
The v3 equivalent transform consistently alpha-renames local comparison
bindings and replaces `; ` separators with a newline. The negative transforms
swap the left/right binding statements, or add one left evaluation before the
existing left binding, in each of the four emitted comparisons. The complete
consumer hashes above fix the actual transformed inputs; source text is not a
license to apply an unrestricted regex to arbitrary Rust programs.

The recorded command shapes below use `cargo` as shorthand for the fixed
Rust/Cargo 1.98.1 toolchain's absolute executable under the no-network wrapper.
They are not an instruction to run an unapproved new tree or use ambient Cargo.

```text
cargo tree --locked --offline --target x86_64-unknown-linux-gnu --edges normal,build,dev --prefix none --format {p}|{f}
cargo clean --package <exact generated manifest package.name> --target x86_64-unknown-linux-gnu --locked --offline
cargo test --test effect_order --target x86_64-unknown-linux-gnu --locked --offline --no-run --message-format=json -vv
cargo test --test effect_order --target x86_64-unknown-linux-gnu --locked --offline
```

Before each no-run, require successful generated-root clean, unchanged input
hashes, real root rustc output and non-fresh root artifact events; retain the
binary hash/copy before advancing to the next fixture. The runtime must name
the corresponding binary. Parse each of four failed tests and its exact LR
assertion, not merely cargo exit101. v4 follows this contract. The root-clean
step does not erase original source, failure logs or third-party archives.

Execution uses an explicitly constructed empty credential environment, separate
HOME, Cargo offline plus seccomp socket denial, one build job, incremental0,
debug-info0, opt-level0 and retained debug/overflow assertions. This is not a
filesystem allowlist or real-OS UI/assistive-technology test. GPUI test-support
and all original features are unchanged. Dependency trees match the retained
301-package feature/source closure; actual no-run artifact closure is 301.
The earlier check-only closure was 287, not 301 rebuilt packages. No production
deployment, account access, package upgrade or source-level test deletion occurs.

Full raw logs, command argv/environment/timing, pre/post input hashes, actual
root artifact events and binary copies are retained under the work handoff
`qa-evidence/pr1024-resume-20261029/native-validation-v3/` and
`native-validation-v4/`. These are workspace paths, not public download URLs.
The repository record embeds the small actual harness/input and key results;
it is **not** a self-contained offline distribution of toolchains, dependency
archives, all generated consumers or binaries. A digest is an identity check,
not proof of availability. The reused numbers test's old “not compiled” comment
is preserved as historical source and superseded by its actual execution logs.

The v4 run at19:00–19:01 UTC retained four compiler warnings per no-run.
Summary SHA256: `17fb04dfc128992d977d2704786d49facff2ac194e157f63c92f61dd2532d1c2`.
After execution, all458 registry archives/extracted entries and four pinned Git
sources were byte-verified again with `errors=[]`; the post-verification receipt
SHA256 is `97a083ab6cde06f3be5a9a3b6bd860ff66701e4b4ddc465d4f006fb2981eef4d`.
This post-execution check has its own timing; it is not a claim of continuous
filesystem immutability. A separate read-only reviewer recomputed retained
artifact hashes and checked no-run/runtime/input correspondence; that reviewer
did not independently execute the consumers or submit a formal approval.

### Current integration and remaining work

The 43d hosted run40924204779 passed types, rust, rust-macos, rust-interop and
release-consumer-react. Its general job123634354119 checked out synthetic
`1c4afe3e21ab26c4d8e7aad4ed8625dca5cd801d` for 43d against b57, passed docs413,
and failed the prototype-catalog gate with497 errors at18:19 UTC. All497 ordered
error lines exactly match the executed clean-b57 baseline; the downstream
Compiler suite was not reached. It is neither a Compiler pass nor497 newly
introduced Compiler defects. The gate is not skipped, whitelisted or weakened.
Latest main's five Runtime changes remain a different, locally unexecuted
combination; no content-free merge was added to restart CI.

These are author execution receipts plus separate static receipt review, not
formal independent acceptance. Review, required current-head CI, broader native
host-domain/OS lifecycle coverage, Qt/Flutter and stable spec activation remain
outstanding. Draft and `COMPILER_MERGE_READY=false / pending` are unchanged.
AI assistance: OpenAI Dots.
