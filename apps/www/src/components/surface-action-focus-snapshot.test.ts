import { describe, expect, it } from 'vitest';
import { snapshotStartupStyle, codeStartupPaintCss } from './site-startup-paint';

// Real Surface setup and Rule compilation, not a mocked tw/feedback collector.
// These snapshots are style-only evidence, not native focus or browser acceptance.
describe('Surface action focus map consumer regression', () => {
  it('mounts the default passive Surface even when action rules are inactive', async () => {
    const tokens = await snapshotStartupStyle('shadcn-surface', {});
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens).not.toContain('[object');
    expect(tokens).not.toContain('Object]');
    expect(tokens).not.toContain('ring-3');
  });

  for (const actionProfile of ['rhea', 'luma'] as const) {
    it(`${actionProfile} uses the named focus recipe only for observed focus`, async () => {
      const rest = await snapshotStartupStyle('shadcn-surface', {
        actionProfile,
        focusVisible: false,
      });
      const focused = await snapshotStartupStyle('shadcn-surface', {
        actionProfile,
        focusVisible: true,
      });
      for (const token of [
        'forced-colors-focus-outline',
        'border-ring',
        'ring-3',
        'ring-ring/30',
      ]) {
        expect(focused).toContain(token);
        expect(rest).not.toContain(token);
      }
      expect(focused).not.toContain('ring-ring/50');
      expect(focused).not.toContain('[object');
      expect(focused).not.toContain('Object]');
    });
  }

  it('preserves the ordinary non-action focus recipe', async () => {
    const focused = await snapshotStartupStyle('shadcn-surface', {
      actionProfile: 'none',
      focusVisible: true,
    });
    for (const token of ['forced-colors-focus-outline', 'ring-2', 'ring-ring', 'ring-offset-2']) {
      expect(focused).toContain(token);
    }
    expect(focused).not.toContain('ring-3');
    expect(focused).not.toContain('ring-ring/50');
  });

  it('generates the shared documentation startup stylesheet through actual Surface setup', async () => {
    const css = await codeStartupPaintCss();
    expect(css).toContain("data-site-code-surface='frame'");
    expect(css).toContain("data-site-code-surface='toolbar'");
    expect(css).not.toContain('[object');
  });
});
