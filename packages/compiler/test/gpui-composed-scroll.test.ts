import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileFile } from '../src/compile';

const root = path.resolve(import.meta.dirname, '../../..');

describe('native composed Scroll lowering', () => {
  it('lowers declared family chrome without dispatching on a component name', async () => {
    const result = await compileFile(
      path.join(import.meta.dirname, 'fixtures/gpui-ordinary-values/composed-scroll.proto.ts'),
      { root, profile: 'gpui-source-v1' }
    );
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.output.code).toContain('scroll_bind_composed_chrome(');
    expect(result.value.output.code).toContain('"rail"');
    expect(result.value.output.code).toContain('"knob"');
    expect(result.value.output.code).toContain('"direction"');
  });

  it('retains the independent unchanged Base Viewport handle-array frontier', async () => {
    const result = await compileFile(
      path.join(root, 'packages/prototypes/base/src/scroll-area/viewport.proto.ts'),
      { root, profile: 'gpui-source-v1' }
    );
    // This valid authored array reaches a separate shared parser boundary
    // before native lowering. Do not rewrite the official prototype or count
    // the generic host consumer as acceptance of this unchanged source.
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Update the recorded Base Viewport frontier and native journey');
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'PUI1006',
        message: 'Arrays cannot leak semantic handles into data.',
        span: expect.objectContaining({
          file: 'packages/prototypes/base/src/scroll-area/viewport.proto.ts',
          line: 31,
        }),
      }),
    ]);
  });
});
