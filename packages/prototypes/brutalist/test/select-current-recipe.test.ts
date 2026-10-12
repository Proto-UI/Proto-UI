import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { collectProtoStyleTokensFromFiles } from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
const testDirectory = path.dirname(fileURLToPath(import.meta.url).replace(/^\/@fs/, ''));
const source = (name: string) => path.resolve(testDirectory, '../src/select', `${name}.proto.ts`);
it('keeps the fixed Neo check out of text flow and reserves its right-side gutter', async () => {
  const tokens = await collectProtoStyleTokensFromFiles([source('item')]);
  for (const token of [
    'absolute',
    'right-2',
    'size-3.5',
    'size-4',
    'shrink-0',
    'pr-8',
    'pl-2',
    'flex-1',
    'whitespace-nowrap',
  ])
    expect(tokens).toContain(token);
  expect(tokens).not.toContain('size-5');
});
it('gives authored Value and Trigger the fixed intrinsic recipe', async () => {
  const trigger = await collectProtoStyleTokensFromFiles([source('trigger')]);
  const value = await collectProtoStyleTokensFromFiles([source('value')]);
  expect(trigger).toContain('w-full');
  for (const token of ['flex', 'flex-1', 'items-center', 'gap-2', 'text-left'])
    expect(value).toContain(token);
  expect(readFileSync(source('content'), 'utf8')).toContain("align: 'center'");
});
it('new recipe tokens have document and Shadow physical CSS without a Select compiler branch', () => {
  const tokens = [
    'absolute',
    'right-2',
    'size-3.5',
    'size-4',
    'shrink-0',
    'pr-8',
    'pl-2',
    'flex-1',
    'whitespace-nowrap',
    'w-full',
    'text-left',
  ];
  for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
    const css = render(tokens);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    for (const declaration of [
      'position: absolute;',
      'right: 0.5rem;',
      'width: 0.875rem;',
      'width: 1rem;',
      'flex-shrink: 0;',
      'padding-right: 2rem;',
      'text-align: left;',
    ])
      expect(css).toContain(declaration);
  }
});
