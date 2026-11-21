import { afterEach, beforeAll, expect, it, vi } from 'vitest';

afterEach(() => document.body.replaceChildren());

async function prepareControl() {
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
  const { collectPublicDrawerEntryStyleTokens } = await import('./fixtures/drawer-entry-build');
  const { renderProtoStyleTokenCss } = await import('../../../cli/src/services/proto-style-css');
  const { tokens } = await collectPublicDrawerEntryStyleTokens();
  // A collector or CSS generation error fails setup; neither is deferred into
  // the fixture's behavior budget or replaced with a fallback stylesheet.
  const css = renderProtoStyleTokenCss(tokens);
  return {
    createPublicDrawerEntryFixture,
    getPrototype,
    listPrototypes,
    collectPrototypeIds,
    demo,
    tokens,
    css,
  };
}

let control: Awaited<ReturnType<typeof prepareControl>>;
beforeAll(async () => {
  control = await prepareControl();
}, 30_000);

it('admits every dependency of the real public Drawer demo while preserving the missing-scope control', async () => {
  const {
    createPublicDrawerEntryFixture,
    getPrototype,
    listPrototypes,
    collectPrototypeIds,
    demo,
    tokens,
    css,
  } = control;

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
    const button = document.querySelector<HTMLElement>(
      'wc-shadcn-drawer-trigger wc-shadcn-button'
    )!;
    const emitted = () =>
      (button.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
    await vi.waitFor(() => expect(emitted()).toContain('select-none'));
    // Use the real composed Button's emitted physical styles as an independent
    // demand: scanning Drawer alone must not silently omit the new child recipe.
    expect(emitted().filter((token) => !tokens.includes(token))).toEqual([]);
    expect(css).toContain('[data-pui-style~="select-none"]');
    const content = document.querySelector<HTMLElement>('wc-shadcn-drawer-content')!;
    expect(content).not.toBeNull();
    expect(content.style.height).toBe('');
    expect(content.style.width).toBe('');
  } finally {
    await fixture.dispose();
  }
});
