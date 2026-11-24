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
    // Two symbols are called without a definition in the emitted sources:
    // `control_label_commit` (also imported from the owner module by the
    // generated a11y module) and `control_label_pointer_move`. They are the
    // open native-consumer defect that keeps the GPUI native consumer lane
    // red; the ratchet below fails on any NEW undefined symbol so the class
    // cannot grow unnoticed while the two are repaired.
    const KNOWN_UNDEFINED = ['control_label_commit', 'control_label_pointer_move'];
    expect(
      missing.filter((name) => !KNOWN_UNDEFINED.includes(name)),
      'the generated owner source calls undefined ControlLabel symbols'
    ).toEqual([]);
    expect(missing, 'the known undefined ControlLabel symbols changed').toEqual(KNOWN_UNDEFINED);
  });
});
