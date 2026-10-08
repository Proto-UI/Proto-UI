import { describe, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { createStyleSnapshotter, renderSnapshotSelectorCss } from './snapshot-prototype-style';
import {
  startupButtonProps,
  snapshotStartupStyle,
  codeStartupPaintCss,
} from './site-startup-paint';
import { readFileSync } from 'node:fs';

describe('startup paint comes from actual prototype style output', () => {
  for (const family of ['shadcn', 'brutalist'] as const) {
    it(`${family} snapshots menu and truthful disabled search`, async () => {
      const menu = await snapshotStartupStyle(`${family}-button`, startupButtonProps(family));
      const search = await snapshotStartupStyle(`${family}-button`, {
        ...startupButtonProps(family, 'default'),
        disabled: true,
      });
      expect(menu.length).toBeGreaterThan(0);
      expect(search).toContain('opacity-50');
      expect(menu).not.toContain('opacity-50');
      if (family === 'shadcn') {
        expect(menu).toContain('border-transparent');
        expect(menu).toContain('bg-transparent');
      }
    });
  }
  it('cannot keep old paint when the source prototype changes, and disposes snapshots', async () => {
    let disposed = 0;
    const original = definePrototype({
      name: 'snapshot-control',
      setup(def) {
        def.feedback.style.use(tw('bg-muted border rounded-xl'));
        def.lifecycle.onUnmounted(() => {
          disposed++;
        });
      },
    });
    const changed = definePrototype({ name: 'snapshot-negative', setup() {} });
    const snapshot = createStyleSnapshotter({ original, changed });
    const tokens = await snapshot('original', {});
    const red = await snapshot('changed', {});
    expect(tokens).toContain('bg-muted');
    expect(red).toEqual([]);
    expect(disposed).toBe(1);
    expect(() => snapshot('unregistered' as never, {})).toThrow('Unreviewed startup recipe');
    const css = renderSnapshotSelectorCss(tokens, '[data-code]::before');
    expect(css).toContain(':where([data-code])::before');
    expect(css).toContain('background-color:');
    expect(renderSnapshotSelectorCss(red, '[data-code]::before')).not.toContain(
      'background-color:'
    );
    expect(css).not.toContain(':where([data-code]::before)');
  });
  it('generates frame and toolbar paint without a parallel declaration recipe', async () => {
    const css = await codeStartupPaintCss();
    expect(css).toContain("data-site-code-surface='frame'");
    expect(css).toContain("data-site-code-surface='toolbar'");
    expect(css).toContain('background-color:');
    expect(css).toContain('border-bottom-width:');
    expect(css).not.toContain('[data-pui-style~=');
  });
  it('retains SSR semantics and never treats static search as operational', () => {
    const search = readFileSync('apps/www/src/components/override/Search.astro', 'utf8');
    expect(search).toMatch(/disabled\s+aria-disabled="true"/);
    expect(search).toContain('aria-label={loadingLabel}');
    expect(search).toContain('<StaticLucideIcon name="search" size="16px" />');
    const header = readFileSync('apps/www/src/components/override/Header.astro', 'utf8');
    expect(header).toContain("data-pui-style={menuTokens.join(' ')}");
    const startup = readFileSync('apps/www/src/styles/site-startup.css', 'utf8');
    const shell = startup.slice(0, startup.indexOf('background: var(--color-background)'));
    expect(shell).not.toContain('[data-site-header-fallback-summary]');
  });
});
