import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { dialogRoot, dialogMask, dialogContent } from '../src/dialog';

const Root = AdaptToWebComponent(dialogRoot, { registerAs: 'test-material-dialog-root' });
const Mask = AdaptToWebComponent(dialogMask, { registerAs: 'test-material-dialog-mask' });
const Content = AdaptToWebComponent(dialogContent, { registerAs: 'test-material-dialog-content' });
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await settle();
  vi.restoreAllMocks();
});
function preferences(support: boolean | 'unknown' = true) {
  const state: Record<string, string> = {
    'prefers-reduced-motion': 'no-preference',
    'prefers-reduced-transparency': 'no-preference',
    'prefers-contrast': 'no-preference',
    'forced-colors': 'none',
  };
  const queries = new Map<string, MediaQueryList>();
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
    if (!queries.has(query)) {
      const match = /^\(([^:]+): ([^)]+)\)$/.exec(query);
      const result = new EventTarget();
      Object.defineProperties(result, {
        media: { value: query },
        matches: { get: () => !!match && state[match[1]!] === match[2] },
      });
      queries.set(query, result as MediaQueryList);
    }
    return queries.get(query)!;
  });
  vi.spyOn(Object.getPrototypeOf(window.CSS), 'supports').mockImplementation(() => {
    if (support === 'unknown') throw new Error('Host support is unavailable');
    return support;
  });
  return (key: string, value: string) => {
    state[key] = value;
    for (const media of queries.values()) media.dispatchEvent(new Event('change'));
  };
}
async function fixture(support: boolean | 'unknown' = true) {
  const change = preferences(support);
  const root = new Root();
  setElementProps(root, { open: true });
  const mask = new Mask();
  const content = new Content();
  const button = document.createElement('button');
  button.textContent = 'Keep focus';
  content.append(button);
  root.append(mask, content);
  document.body.append(root);
  await settle();
  return {
    root,
    mask,
    content,
    button,
    change,
    tokens: () => mask.getAttribute('data-pui-style')?.split(' ') ?? [],
  };
}
describe('Shadcn DialogMask accessibility material policy', () => {
  it.each([
    ['prefers-reduced-transparency', 'reduce', 'no-preference'],
    ['forced-colors', 'active', 'none'],
    ['forced-colors', 'unknown', 'none'],
    ['prefers-reduced-transparency', 'unknown', 'no-preference'],
  ])(
    'withdraws blur/alpha for %s=%s and restores the same open mask',
    async (key, reduced, ordinary) => {
      const f = await fixture();
      expect(f.tokens()).toContain('backdrop-blur-xs');
      expect(f.tokens()).toContain('bg-black/50');
      f.button.focus();
      f.change(key, reduced);
      await settle();
      expect(f.tokens()).not.toContain('backdrop-blur-xs');
      expect(f.tokens()).not.toContain('bg-black/50');
      expect(f.tokens()).toContain('bg-background');
      expect(f.content.contains(f.button)).toBe(true);
      expect(document.activeElement).toBe(f.button);
      f.change(key, ordinary);
      await settle();
      expect(f.tokens()).toContain('backdrop-blur-xs');
      expect(f.tokens()).toContain('bg-black/50');
      expect(document.activeElement).toBe(f.button);
    }
  );
});

it.each([false, 'unknown'] as const)(
  'starts opaque when backdrop support is %s despite ordinary preferences',
  async (support) => {
    const f = await fixture(support);
    expect(f.tokens()).toContain('bg-background');
    expect(f.tokens()).not.toContain('backdrop-blur-xs');
    expect(f.tokens()).not.toContain('bg-black/50');
    expect(f.content.contains(f.button)).toBe(true);
  }
);
