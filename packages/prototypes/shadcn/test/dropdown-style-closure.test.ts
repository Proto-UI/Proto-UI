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
  for (const token of ['bg-destructive/10', 'bg-destructive/20', 'text-destructive', 'pl-7'])
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
    expect(css).toContain('padding-left: 1.75rem;');
  }
});
