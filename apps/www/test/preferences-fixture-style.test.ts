// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderProtoStyleTokenCss } from '../../../packages/cli/src/services/proto-style-css';

describe('preference fixture physical style closure', () => {
  it('compiles every probe token and retains a concrete white/blue paint oracle', () => {
    const source = readFileSync(new URL('./fixtures/preferences/main.ts', import.meta.url), 'utf8');
    const tokens = [...source.matchAll(/tw\('([^']+)'\)/g)].flatMap((match) =>
      match[1].split(/\s+/)
    );
    expect(tokens.length).toBeGreaterThan(5);
    const css = renderProtoStyleTokenCss(tokens);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('background-color: var(--pui-background)');
    expect(css).toContain('background-color: var(--pui-primary)');
    expect(css).toContain('color: var(--pui-foreground)');
  });
});
