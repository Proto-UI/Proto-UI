// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { gpuiNativeSdkFiles } from '../src/gpui-native-sdk';

describe('GPUI text accessibility publication wiring', () => {
  it('attaches TextRun children after authored child merging in the actual Element callback', () => {
    const source = gpuiNativeSdkFiles().find((file) =>
      file.path.endsWith('/gpui-native-a11y.rs')
    )!.contents;
    const callback = source.match(
      /^fn a11y_synthetic_children\([^]*?(?=^fn write_a11y_info\()/m
    )?.[0];
    expect(callback, 'the emitted Semantics Element must expose its native callback').toBeDefined();
    expect(callback).toContain('self.element.a11y_synthetic_children(prepaint,builder);');
    expect(callback).toContain('builder.parent_node().clear_children();');

    // The consumer tests prove the TextRun semantics independently. This gate
    // covers the missing edge they cannot exercise: TestPlatform never activates
    // accessibility, and GPUI keeps A11ySubtreeBuilder construction private.
    // Append outside the merge condition, after it has cleared authored children.
    expect(callback).toMatch(
      /}\s*crate::gpui_native_owner::text_accessible_children\(&owner,\s*builder\);\s*}\s*$/
    );
    expect(callback!.match(/text_accessible_children\(/g)).toHaveLength(1);
  });
});
