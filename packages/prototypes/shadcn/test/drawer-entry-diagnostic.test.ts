// @vitest-environment node
import { expect, it } from 'vitest';
import {
  buildPublicDrawerBoxCss,
  buildPublicDrawerEntryProbe,
} from './fixtures/drawer-entry-build';
it('bundles actual www rendering with observation-only projector and real box/reset CSS', async () => {
  const script = await buildPublicDrawerEntryProbe();
  expect(script).toContain('Drawer settings');
  expect(script).toContain('unresolved-units');
  expect(script).toContain('__drawerEntryProbe');
  const css = await buildPublicDrawerBoxCss(['max-w-sm', 'mx-auto', 'w-full']);
  expect(css).toContain('.max-w-sm');
  expect(css).toContain('.mx-auto');
  expect(css).toContain('.w-full');
  expect(css).toContain('box-sizing: border-box');
  expect(css).toContain('--pui-background');
}, 20000);
