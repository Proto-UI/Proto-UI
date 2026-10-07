import { describe, expect, it } from 'vitest';
import { assertConsumerBoundary } from './consumer-boundary.mjs';
const graph = (paths: string[], imports: { path: string; external?: boolean }[] = []) => ({
  inputs: Object.fromEntries(paths.map((p) => [p, {}])),
  outputs: { 'app.js': { imports } },
});
describe('optical artifact graph boundary', () => {
  it('accepts real emitted packages and the explicitly private optical prototype', () => {
    const result = assertConsumerBoundary(
      graph(['packages/core/dist/index.js', 'packages/prototypes/liquid-glass/src/button.ts']),
      { packed: true }
    );
    expect(result.publicSourceInputs).toEqual([]);
    expect(result.packageInputs).toHaveLength(2);
  });
  it.each([
    'apps/www/src/components/PrototypePreviewer/demo-renderer.ts',
    'apps/www/src/components/PrototypePreviewer/registry.ts',
    'apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime.ts',
  ])('rejects website/runtime dependency %s', (path) =>
    expect(() => assertConsumerBoundary(graph([path]))).toThrow('website runtime graph')
  );
  it('rejects externalized virtual URLs rather than emitting a broken browser bundle', () =>
    expect(() =>
      assertConsumerBoundary(
        graph([], [{ external: true, path: 'virtual:proto-ui/runtime-retry-urls' }])
      )
    ).toThrow('unresolved external'));
  it.each(['packages/core/src/index.ts', '../foreign/packages/adapters/react/src/index.ts'])(
    'rejects public source leakage %s',
    (path) =>
      expect(() => assertConsumerBoundary(graph([path]), { packed: true })).toThrow(
        'reached source'
      )
  );
});
