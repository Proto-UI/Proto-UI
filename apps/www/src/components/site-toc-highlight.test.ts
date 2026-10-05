import { afterEach, expect, it, vi } from 'vitest';
import { initSiteNativeControls } from './site-native-controls';
const theme = vi.hoisted(() => ({
  read: vi.fn((..._args: unknown[]) => ({ '--pui-foreground': '#123456' })),
}));
vi.mock('./PrototypePreviewer/projection-theme', () => ({
  resolveProjectionThemeSurfaceStyle: (...args: unknown[]) => theme.read(...args),
}));
let release = () => {};
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(() => {
  release();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-site-library-family');
  document.documentElement.removeAttribute('data-theme');
  theme.read.mockClear();
});
it('uses one real passive family Surface and the existing shared theme lifetime', async () => {
  document.body.innerHTML =
    '<sl-toc><a href="#a" data-site-native-link>A</a><a href="#b" data-site-native-link>B</a><div data-site-toc-highlight aria-hidden="true"></div></sl-toc>';
  const range = document.querySelector<HTMLElement>('[data-site-toc-highlight]')!;
  release = initSiteNativeControls();
  await settle();
  const original = range.firstElementChild as HTMLElement;
  expect(original.localName).toBe('wc-site-shadcn-surface');
  expect(original.getAttribute('data-pui-style')?.split(' ')).toContain('bg-muted');
  expect(original.getAttribute('data-pui-style')?.split(' ')).toContain('rounded-md');
  expect(typeof (original as HTMLElement & { setProps?: unknown }).setProps).toBe('function');
  expect(range.children).toHaveLength(1);
  expect(range.getAttribute('aria-hidden')).toBe('true');
  expect(range.querySelector('[role],[tabindex]')).toBeNull();
  expect(theme.read).toHaveBeenCalledTimes(1);
  const duplicate = initSiteNativeControls();
  duplicate();
  expect(range.children).toHaveLength(1);
  expect(theme.read).toHaveBeenCalledTimes(1);
  document.documentElement.dataset.siteLibraryFamily = 'brutalist';
  await settle();
  expect(original.isConnected).toBe(false);
  expect(range.children).toHaveLength(1);
  expect(range.firstElementChild!.localName).toBe('wc-site-brutalist-surface');
  expect(range.firstElementChild!.getAttribute('data-pui-style')?.split(' ')).toContain('border-0');
  expect(range.querySelector('[role],[tabindex]')).toBeNull();
  release();
  expect(range.children).toHaveLength(0);
  expect(range.hasAttribute('data-toc-range-ready')).toBe(false);
  document.documentElement.dataset.theme = 'dark';
  await settle();
  expect(range.children).toHaveLength(0);
  expect(document.querySelectorAll('a[href]')).toHaveLength(2);
});
