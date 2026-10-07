import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRuntimeLoadingMask } from './runtime-loading-mask';
import { WEBSITE_SHADCN_THEME_TOKENS } from './projection-theme';
import { BRUTALIST_THEME } from '../../../../../packages/prototypes/brutalist/src/theme';

afterEach(() => document.body.replaceChildren());
function fixture(family: 'shadcn' | 'brutalist' = 'shadcn') {
  const root = document.createElement('section');
  root.dataset.locale = 'en';
  for (const key of WEBSITE_SHADCN_THEME_TOKENS)
    root.style.setProperty(`--pui-${key}`, key.includes('radius') ? '0.5rem' : '#ffffff');
  const content = document.createElement('div');
  const status = document.createElement('output');
  status.setAttribute('aria-live', 'polite');
  root.append(content, status);
  document.body.append(root);
  const retry = vi.fn(),
    cancel = vi.fn(),
    restoreFocus = vi.fn();
  const mask = createRuntimeLoadingMask({
    root,
    content,
    status,
    family: () => family,
    retry,
    cancel,
    restoreFocus,
  });
  return { root, content, status, mask, retry, cancel, restoreFocus };
}
for (const family of ['shadcn', 'brutalist'] as const) {
  describe(`${family} stable public-atom loading mask`, () => {
    it('uses real WC Surface/Text/Button atoms across target runtimes and does not lock the page', async () => {
      const f = fixture(family);
      await f.mask.ready;
      const original = f.root.querySelector('[data-runtime-loading-mask]')!;
      for (const runtime of ['react', 'vue', 'vue2', 'wc'] as const) {
        f.mask.setState('loading', runtime, true);
        expect(f.content.getAttribute('aria-busy')).toBe('true');
        expect(document.body.inert).not.toBe(true);
        expect(f.root.querySelector('[data-runtime-loading-mask]')).toBe(original);
        expect((original as HTMLElement).hidden).toBe(false);
        const protos = Array.from(original.querySelectorAll('[data-pui-root]'));
        expect(protos).toHaveLength(6);
        expect(protos.every((p) => p.tagName.startsWith('WC-'))).toBe(true);
        expect(
          original.querySelector('[data-demo-ref="panel"]')?.getAttribute('data-pui-root')
        ).not.toBeNull();
        expect(original.querySelector('[data-demo-ref="title"]')?.textContent).toContain(
          runtime === 'vue2'
            ? 'Vue 2'
            : runtime === 'wc'
              ? 'Web Components'
              : runtime === 'react'
                ? 'React'
                : 'Vue'
        );
        f.mask.setState('ready', runtime);
        expect((original as HTMLElement).hidden).toBe(true);
        expect(f.content.getAttribute('aria-busy')).toBe('false');
      }
      await f.mask.destroy();
      expect(f.root.querySelector('[data-runtime-loading-mask]')).toBeNull();
    });
    it('keeps failure actions outside busy content and delivers each public activation once', async () => {
      const f = fixture(family);
      await f.mask.ready;
      f.mask.setState('error', 'react', true);
      const retry = f.root.querySelector<HTMLElement>('[data-demo-ref="retry"]')!;
      const cancel = f.root.querySelector<HTMLElement>('[data-demo-ref="cancel"]')!;
      expect(f.content.contains(retry)).toBe(false);
      expect(f.content.getAttribute('aria-busy')).toBe('false');
      retry.dispatchEvent(new MouseEvent('click'));
      expect(f.retry).toHaveBeenCalledTimes(1);
      retry.dispatchEvent(new MouseEvent('click'));
      expect(f.retry).toHaveBeenCalledTimes(2);
      cancel.dispatchEvent(new CustomEvent('click'));
      expect(f.cancel).toHaveBeenCalledTimes(1);
      f.mask.setState('loading', 'vue', false);
      expect(f.root.querySelector<HTMLElement>('[data-demo-ref="retryBox"]')!.hidden).toBe(true);
      expect(f.root.querySelector<HTMLElement>('[data-demo-ref="cancelBox"]')!.hidden).toBe(true);
      await f.mask.destroy();
    });
    it('restores focus only when the disappearing mask owns it and stays inert after disposal', async () => {
      const f = fixture(family);
      await f.mask.ready;
      f.mask.setState('loading', 'react', true);
      const cancel = f.root.querySelector<HTMLElement>('[data-demo-ref="cancel"]')!;
      cancel.focus();
      f.mask.setState('ready', 'wc');
      expect(f.restoreFocus).toHaveBeenCalledWith(cancel);
      f.restoreFocus.mockClear();
      const outside = document.createElement('button');
      document.body.append(outside);
      outside.focus();
      f.mask.setState('loading', 'vue', true);
      f.mask.setState('ready', 'vue');
      expect(f.restoreFocus).not.toHaveBeenCalled();
      await f.mask.destroy();
      f.mask.setState('loading', 'react', true);
      expect(f.root.querySelector('[data-runtime-loading-mask]')).toBeNull();
    });
  });
}

it('projects the independent Brutalist theme onto the stable lane and follows live color mode', async () => {
  const f = fixture('brutalist');
  await f.mask.ready;
  f.mask.setState('loading', 'react', true);
  const mount = f.root.querySelector<HTMLElement>('[data-runtime-loading-mask]')!;
  expect(mount.style.getPropertyValue('--pui-background')).toBe(BRUTALIST_THEME.light.background);
  expect(mount.style.getPropertyValue('--pui-radius')).toBe(BRUTALIST_THEME.light.radius);
  f.root.dataset.theme = 'dark';
  await vi.waitFor(() =>
    expect(mount.style.getPropertyValue('--pui-background')).toBe(BRUTALIST_THEME.dark.background)
  );
  expect(f.root.style.getPropertyValue('--pui-background')).toBe('#ffffff');
  await f.mask.destroy();
  f.root.dataset.theme = 'light';
  expect(f.root.querySelector('[data-runtime-loading-mask]')).toBeNull();
});

it('moves retry focus to a visible pending action and restores it only after the delayed switch settles', async () => {
  const f = fixture();
  await f.mask.ready;
  f.mask.setState('error', 'react', true);
  const retry = f.root.querySelector<HTMLElement>('[data-demo-ref="retry"]')!;
  const cancel = f.root.querySelector<HTMLElement>('[data-demo-ref="cancel"]')!;
  retry.focus();
  f.mask.setState('loading', 'react', true);
  expect(document.activeElement).toBe(cancel);
  expect(f.restoreFocus).not.toHaveBeenCalled();
  await Promise.resolve();
  f.mask.setState('ready', 'react');
  expect(f.restoreFocus).toHaveBeenCalledWith(cancel);
  await f.mask.destroy();
});
