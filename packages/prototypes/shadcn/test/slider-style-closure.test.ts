// @vitest-environment node
import { readdir } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { collectProtoStyleTokensFromFiles } from '../../../cli/src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
async function collect() {
  const root = 'packages/prototypes/shadcn/src/slider';
  const tokens = await collectProtoStyleTokensFromFiles(
    (await readdir(root)).filter((file) => file.endsWith('.ts')).map((file) => `${root}/${file}`)
  );
  return tokens.map((token) => {
    if (typeof token !== 'string') throw new TypeError('Collector emitted a non-string token');
    return token;
  });
}
it('collects the actual passive Slider paint and emits its dimensions and ring CSS', async () => {
  const tokens = await collect();
  for (const token of [
    'h-1',
    'w-1',
    'size-3',
    'size-7',
    'bg-white',
    'border-ring',
    'ring-ring/50',
    'ring-3',
    'forced-colors-focus-outline',
  ])
    expect(tokens).toContain(token);
  const css = renderProtoStyleTokenCss(tokens);
  expect(css).toContain(':where([data-pui-style~="h-1"]) {\n    height: 0.25rem;');
  expect(css).toContain(
    ':where([data-pui-style~="size-3"]) {\n    width: 0.75rem;\n    height: 0.75rem;'
  );
  expect(css).toContain(
    ':where([data-pui-style~="size-7"]) {\n    width: 1.75rem;\n    height: 1.75rem;'
  );
  expect(css).toContain('--pui-ring-width: 3px;');
  expect(css).toContain('@media (forced-colors: active)');
  expect(css).toContain('[data-pui-style~="forced-colors-focus-outline"]');
});
it('closes borrowed-state Slider Rule tokens without relying on other components to seed CSS', async () => {
  const tokens = await collect();
  const expected = [
    'data-[orientation=vertical]:min-h-40',
    'data-[orientation=vertical]:h-full',
    'data-[orientation=vertical]:w-3',
    'data-[orientation=vertical]:w-1',
    'data-[orientation=vertical]:bottom-[calc(var(--pui-percentage)*1%)]',
    'data-[disabled]:opacity-50',
    'data-[disabled]:pointer-events-none',
    'data-[direction=rtl]:data-[orientation=horizontal]:right-[calc(var(--pui-percentage)*1%)]',
  ];
  // This regression must remain red until the shared collector understands the
  // existing authored-asHook state handles. No component whitelist or manually
  // seeded Rule tokens in prototype/preset source are an acceptable repair.
  expect(expected.filter((token) => !tokens.includes(token))).toEqual([]);
  const css = renderProtoStyleTokenCss(tokens);
  for (const token of expected) expect(css).toContain(`[data-pui-style~="${token}"]`);
});
