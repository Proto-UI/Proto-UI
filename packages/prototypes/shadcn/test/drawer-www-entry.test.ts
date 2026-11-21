import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => document.body.replaceChildren());

it('admits every dependency of the real public Drawer demo while preserving the missing-scope control', async () => {
  // Match the fresh registry in each native-browser diagnostic page. This DOM
  // control proves fixture admission only; motion and geometry stay in Chromium.
  vi.resetModules();
  const { createPublicDrawerEntryFixture } = await import('./fixtures/drawer-www-entry');
  const { getPrototype, listPrototypes } =
    await import('../../../../apps/www/src/components/PrototypePreviewer/registry');
  const { collectPrototypeIds } =
    await import('../../../../apps/www/src/components/PrototypePreviewer/demo-types');
  const { default: demo } =
    await import('../../../../apps/www/src/content/docs/demo-shadcn-drawer.demo');

  expect(listPrototypes()).toEqual([]);
  await expect(createPublicDrawerEntryFixture(false, demo, false)).rejects.toThrow(
    '未找到原型 "shadcn-style-scope"'
  );
  document.body.replaceChildren();

  const fixture = await createPublicDrawerEntryFixture(false, demo);
  try {
    const required = new Set<string>();
    collectPrototypeIds(demo.root, required);
    expect(required.has('shadcn-button')).toBe(true);
    for (const id of required) expect(getPrototype(id).name, id).toBe(id);
    expect(document.querySelector('wc-shadcn-drawer-trigger wc-shadcn-button')?.textContent).toBe(
      'Open Drawer'
    );
    const content = document.querySelector<HTMLElement>('wc-shadcn-drawer-content')!;
    expect(content).not.toBeNull();
    expect(content.style.height).toBe('');
    expect(content.style.width).toBe('');
  } finally {
    await fixture.dispose();
  }
});
