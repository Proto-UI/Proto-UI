import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectProtoStyleTokensFromFiles } from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoShadowStyleTokenCss,
  renderProtoStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
import { SHADCN_STYLE_TOKENS } from '../../../cli/src/generated/shadcn-style-tokens';

describe('Shadcn AlertDialog complete physical style closure', () => {
  it('enumerates every authored part and imported passive Button paint in document and Shadow CSS', async () => {
    const root = path.resolve('packages/prototypes/shadcn/src/alert-dialog');
    const files = (await readdir(root))
      .filter((name) => name.endsWith('.ts'))
      .map((name) => path.join(root, name));
    files.push(
      path.resolve('packages/prototypes/shadcn/src/dialog/style.ts'),
      path.resolve('packages/prototypes/shadcn/src/dialog/action-paint.ts')
    );
    const tokens = (await collectProtoStyleTokensFromFiles(files)) as string[];
    for (const token of [
      'p-6',
      'shadow-lg',
      'gap-1.5',
      'gap-2',
      'flex-wrap-reverse',
      'h-9',
      'px-4',
      'py-2',
      'rounded-md',
      'shadow-xs',
      'bg-primary/80',
      'bg-accent',
      'text-accent-foreground',
    ])
      expect(tokens).toContain(token);
    for (const token of tokens) expect(SHADCN_STYLE_TOKENS, token).toContain(token);
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render(tokens);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      for (const declaration of [
        'padding: 1.5rem;',
        'height: 2.25rem;',
        'padding-inline: 1rem;',
        'padding-block: 0.5rem;',
        'gap: 0.375rem;',
        'gap: 0.5rem;',
        'flex-wrap: wrap-reverse;',
        'justify-content: flex-end;',
      ])
        expect(css, declaration).toContain(declaration);
    }
  });
});
