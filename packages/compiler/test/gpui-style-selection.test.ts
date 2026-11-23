// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGpuiNativeStyleFiles } from '../src/gpui-native-style';

describe('standalone GPUI selection style boundary', () => {
  it('carries the canonical bounded none mapping into compiler consumers', () => {
    const result = buildGpuiNativeStyleFiles(['select-none']);
    expect(result.unknown).toEqual([]);
    const mapping = result.files.find(
      (file) => file.path === '.proto-ui/style/mapping.rs'
    )!.contents;
    const canonical = readFileSync(
      resolve('native/gpui/crates/proto-ui-gpui/src/style.rs'),
      'utf8'
    );
    const arm = /"user-select" \| "-webkit-user-select" if value == "none" => \{\}/;
    expect(mapping.match(arm)?.[0]).toBe(canonical.match(arm)?.[0]);
    expect(mapping).toMatch(arm);
    // The actual emitted Rust test exercises both prefixed properties and keeps
    // text/all/auto unsupported. Downstream native SDK execution is a separate gate.
    expect(mapping).toContain(
      'none_selection_matches_plain_text_without_admitting_selectable_text'
    );
  });
});
