import { describe, expect, it } from 'vitest';
import { gpuiNativeSdkFiles } from '../src/gpui-native-sdk';

/**
 * The generated GPUI owner module is assembled from several compiler sources.
 * A call to a symbol that no emitted source defines compiles as a Rust
 * `cannot find function` error, and the native consumer gate only reports it
 * after a full cargo build against the pinned Zed dependency graph.
 */
describe('generated GPUI native owner source', () => {
  it('calls only the ControlLabel symbols it defines', () => {
    const owner = gpuiNativeSdkFiles().find((file) =>
      file.path.endsWith('/gpui-native-owner.rs')
    )!.contents;

    // Every ControlLabel symbol the module calls has to be defined by the
    // same module. A renamed or removed definition leaves the call behind,
    // and the native consumer no longer compiles.
    const defined = new Set(
      [...owner.matchAll(/\bfn\s+(control_label_[a-z0-9_]+)/g)].map((match) => match[1]!)
    );
    const called = new Set(
      [...owner.matchAll(/(^|[^A-Za-z0-9_.])(control_label_[a-z0-9_]+)\s*\(/g)].map(
        (match) => match[2]!
      )
    );
    const missing = [...called].filter((name) => !defined.has(name)).sort();
    expect(missing, 'the generated owner source calls undefined ControlLabel symbols').toEqual([]);
  });
});
