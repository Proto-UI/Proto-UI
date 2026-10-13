import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { collectProtoStyleTokensFromFiles } from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';

async function collect(files: string[]) {
  const tokens = await collectProtoStyleTokensFromFiles(files);
  expect(tokens.every((token) => typeof token === 'string')).toBe(true);
  return tokens.filter((token): token is string => typeof token === 'string');
}

it('statically collects and realizes supported Header, Content, Footer and Title recipes', async () => {
  const recipes = {
    header: ['flex', 'flex-col', 'gap-0.5', 'p-4', 'text-center'],
    footer: ['mt-[auto]', 'flex', 'flex-col', 'gap-2', 'p-4'],
    content: [
      'rounded-lg',
      'border',
      'border-border',
      'bg-background',
      'text-foreground',
      'shadow-md',
      'flex',
      'flex-col',
    ],
    title: ['text-foreground', 'font-semibold'],
  };
  for (const [part, expected] of Object.entries(recipes)) {
    const file = `packages/prototypes/shadcn/src/drawer/${part}.proto.ts`;
    const actual = await collect([file]);
    expect(actual.slice().sort(), part).toEqual(expected.slice().sort());
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss])
      expect(render(actual)).not.toContain('Unsupported Proto UI style tokens');
    const source = await readFile(file, 'utf8');
    expect(source).not.toMatch(/md:|group-data|data-vaul/);
  }
});
it('Title inherits size and Content removes container padding without claiming directional edge paint', async () => {
  const content = await collect(['packages/prototypes/shadcn/src/drawer/content.proto.ts']);
  const title = await collect(['packages/prototypes/shadcn/src/drawer/title.proto.ts']);
  for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
    const css = render(title);
    expect(css).not.toContain('font-size:');
    expect(css).not.toContain('line-height:');
  }
  expect(content).not.toContain('p-4');
  expect(content).not.toContain('grid');
  expect(content).toContain('rounded-lg');
  expect(content).toContain('border');
  expect(content).toContain('shadow-md');
});
