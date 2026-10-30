import path from 'node:path';
import { expect, it } from 'vitest';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';

it('collects the complete Dropdown source and generates document and Shadow destructive/inset declarations', async () => {
  const collected = await collectProtoStyleTokens(
    path.resolve('packages/prototypes/shadcn/src/dropdown')
  );
  expect(collected.every((token) => typeof token === 'string')).toBe(true);
  const tokens = collected as string[];
  // Profile-qualified runtime paint must remain in the static CSS closure.
  // Flat recipe keys retain the actual left/right declarations in collection.
  for (const token of [
    'bg-destructive/10',
    'bg-destructive/20',
    'text-destructive',
    'pl-8',
    'pl-2',
    'pr-2',
    'p-1',
    'shadow-md',
    'pl-7.5',
    'pl-9.5',
    '-mx-1.5',
  ])
    expect(tokens).toContain(token);
  for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
    const css = render(tokens);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain(
      'background-color: color-mix(in oklab, var(--pui-destructive) 10%, transparent);'
    );
    expect(css).toContain(
      'background-color: color-mix(in oklab, var(--pui-destructive) 20%, transparent);'
    );
    expect(css).toContain('padding-left: 2rem;');
    expect(css).toContain('padding-right: 0.5rem;');
    expect(css).toContain('margin-inline: -0.375rem;');
  }
  // Whole family+Base source collection with the multi-profile recipes is a
  // real scan, not a stub; it exceeds the 5s default on a loaded host.
}, 60_000);
