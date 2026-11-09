import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GET } from '../pages/styles/site-library-theme.css';

describe('Bootstrap navbar frame and family theme bank', () => {
  it('publishes distinct named light and dark navbar values without replacing Shadcn inputs', async () => {
    const css = await GET().text();
    expect(css).toContain('--site-bootstrap-navbar-top: #ffffff');
    expect(css).toContain('--site-bootstrap-navbar-top: #333333');
    expect(css).toContain('--site-bootstrap-foreground: #eeeeee');
    expect(css).toContain('--site-shadcn-font-sans:');
  });
  it('uses a bounded static-top navbar frame and gives both settings sufficient desktop space', () => {
    const css = readFileSync('apps/www/src/styles/site-header.css', 'utf8');
    expect(css).toContain('border-bottom: 1px solid var(--site-bootstrap-navbar-border)');
    expect(css).toContain('var(--site-bootstrap-navbar-top)');
    expect(css).toContain('grid-template-columns: minmax(12rem, 1fr) minmax(12rem, 1fr)');
    // Preserve the existing compact single-column flow instead of forcing
    // nowrap, shrinking text, or hiding the family name to satisfy the screenshot.
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(css).not.toContain(".pui-projection-control[data-control='family']");
  });
});
