import { beforeAll, expect, it } from 'vitest';
import { transformSync } from 'esbuild';
import * as adapter from '@proto.ui/adapter-web-component';
import * as switches from '../src/switch';
import { renderHostIndex } from '../../../cli/src/services/codegen';
import { styleContains } from '../../test-utils/style';

// Execute the actual generated WC facade, with imports bound to this checkout's
// real Adapter and prototypes. No copied preset implementation or layout claim.
beforeAll(() => {
  const source = renderHostIndex('wc', ['shadcn-switch']);
  const { code } = transformSync(source, { loader: 'ts', format: 'cjs' });
  const module = { exports: {} };
  const require = (id: string) => {
    if (id === '@proto.ui/adapter-web-component') return adapter;
    if (id === '@proto.ui/prototypes-shadcn/switch') return switches;
    throw new Error(`Unexpected generated Switch import: ${id}`);
  };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
});
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

it.each(['default', 'replacement', 'omitted'] as const)(
  'generated %s Thumb preset respects Root sm and dynamic default size',
  async (mode) => {
    const root = document.createElement('proto-ui-shadcn-switch') as any;
    adapter.setElementProps(root, { size: 'sm' });
    const replacement = document.createElement('proto-ui-shadcn-switch-thumb');
    if (mode === 'replacement') root.append(replacement);
    if (mode === 'omitted') root.setAttribute('data-pui-no-default-thumb', '');
    document.body.append(root);
    await settle();
    expect(root.getExposes().getVisualSize()).toBe('sm');
    const parts = Array.from(root.children as HTMLCollection).filter(
      (child) => child.localName === 'proto-ui-shadcn-switch-thumb'
    );
    expect(parts).toHaveLength(mode === 'omitted' ? 0 : 1);
    if (mode === 'replacement') expect(parts[0]).toBe(replacement);
    if (parts[0]) expect(styleContains(parts[0], 'size-3')).toBe(true);
    adapter.setElementProps(root, {});
    await settle();
    expect(root.getExposes().getVisualSize()).toBe('default');
    if (parts[0]) {
      expect(styleContains(parts[0], 'size-4')).toBe(true);
      expect(styleContains(parts[0], 'size-3')).toBe(false);
    }
    root.remove();
    await settle();
  }
);
