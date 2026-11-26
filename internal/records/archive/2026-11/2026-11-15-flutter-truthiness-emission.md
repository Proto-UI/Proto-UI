# Direct Flutter conditional emission repair

This record describes a bounded repair to the existing, exported direct emitter. `flutter-source-v1` remains unimplemented in the public target registry. This is neither Flutter Widget acceptance nor a new release profile.

## Cause and ownership

Independent review of PR #1460 found that its newly admitted conditional expression emitted the checked condition directly into Dart. The parser and IR checker admit non-Boolean conditions, while Dart requires a Boolean condition. For example, the valid authored expression `0 ? 'yes' : 'no'` emitted a Dart numeric condition and failed compilation.

The existing native truthiness helper already defines the relevant scalar, optional-value and undefined behavior. The omission belongs to the emitter; changing the Prototype definition, parser admission or IR version would not repair it. The direct emitter also used Dart `void` operation results as arguments to that helper in `!` and `if`. Dart rejects those arguments.

The repair shares one compile-time lowering function across `?:`, `!` and `if`. Ordinary values use the existing `nativeTruthy` helper. A non-literal undefined result represented by IR `void` executes its expression once as a statement and then yields `false` from a native immediately invoked function. Exceptions still propagate, and the target language retains lazy branch evaluation. No Runtime, IR interpreter, component identity dispatch or new host helper was introduced.

The separately owned compiler work in PR #1462 was inspected read-only and was not incorporated or modified. This repair changes the already published direct emitter in PR #1460 and its regression evidence only.

## Discriminating evidence

The opt-in test is `packages/compiler/test/flutter-conditional.native.test.ts`. With `PROTO_UI_DART` pointing to an installed Dart SDK, it parses fixed authored input, calls the actual emitter, copies its generated setup statements and scalar support without rewriting their expressions, then executes them using Dart.

The four cases cover:

- A Boolean-condition control that already passes before the repair.
- Numeric zero, signed zero, nonzero values, NaN, empty and nonempty strings, null, undefined, arrays, a present false optional value and an absent optional.
- One condition evaluation, lazy selected/unselected branches, preserved unselected throwing branches, and three void-returning helper effects.
- Three genuinely Dart-`void` operation calls in `?:`, `!` and `if`, using typed port doubles that count the effects. These doubles do not validate NativeOwner lifecycle or a Flutter Widget.

The final identical test source has SHA-256 `02eb00631a4a93418cb19fac100be7a14599dcfbe88929b3086ed1d0092e8a10`. On the old emitter `2969570e5b76322b34a24384394008aa7eecc7a040191e566170ee26cfc0dcec`, the Boolean control passed and the other three cases failed with actual Dart type diagnostics. After the repair, emitter SHA-256 `ca8fc74fa9a5cd324458f7581ef13745f74cc572de2f8538b2b2d0e7dd8e4545`, all four cases passed with no skips in 2.923 seconds. The preceding three-case red run is preserved separately; it is not substituted for the final four-case comparison.

Execution used Dart SDK 3.9.2 for Linux x64. Its official archive was verified against SHA-256 `ec22e81271582def81d3e10e2a555ae5d3d81c6951465a3d16cfc47938e9f92a`. The evidence archive, excluding the SDK distribution, has SHA-256 `21b7b51fd0063acbb18819421fc3caabe59a6b7d823851881860d8cfa7e503d3`. It retains original inputs, IR, complete emitted modules and support, executed Dart programs, stdout/stderr, red/green runner logs and source receipts. Its 79 listed files were independently mirrored with no hash differences.

The affected existing ControlLabel lowering, exception flow, relational comparison and expression-type suites additionally passed 267/267 tests across four files with no skips, one worker, in 21.098 seconds. Selected strict TypeScript checking of the changed implementation and native test passed using the repository configuration; its existing `skipLibCheck:true` was retained. Formatting and `git diff --check` passed.

## Reproduction and remaining boundary

```sh
PROTO_UI_DART=/absolute/path/to/dart \
  corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/flutter-conditional.native.test.ts \
  --no-file-parallelism --maxWorkers=1 --minWorkers=1
```

`PROTO_UI_DART_EVIDENCE_DIR` optionally retains the generated programs and raw execution receipts. Without `PROTO_UI_DART`, these native tests explicitly skip; an ordinary suite run cannot be cited as Dart execution.

The private compiler package is excluded from the public package release train. This correction does not change the existing `0.3.0-alpha.2` candidate version or IR schema 6. Full Flutter SDK compilation, Widget behavior, native consumer acceptance and profile activation remain separate unfinished work.
