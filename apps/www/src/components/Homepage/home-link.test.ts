import { describe, expect, it } from 'vitest';
import { assertDemoSpec, type DemoSpec } from '../PrototypePreviewer/demo-types';
import { renderDemo } from '../PrototypePreviewer/demo-renderer';
import { getDemoSourcePath } from '../PrototypePreviewer/demo-modules';
import { loadPrototypes } from '../PrototypePreviewer/prototype-modules';
import { createHomepageContent } from './homepage-runtime-client';

const demo = {
  type: 'demo',
  root: {
    kind: 'box',
    tag: 'a',
    attrs: { href: '/docs/', target: '_blank', rel: 'noopener', 'aria-label': 'Documentation' },
    children: ['Docs'],
  },
} satisfies DemoSpec;

describe('Website native-link host composition', () => {
  it('keeps a real Website-owned anchor in the selected runtime renderer', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const rendered = await renderDemo({ runtime: 'wc', demo, host });
    try {
      const link = host.querySelector('a');
      expect(link?.getAttribute('href')).toBe('/docs/');
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('noopener');
      expect(link?.getAttribute('aria-label')).toBe('Documentation');
      expect(link?.textContent).toBe('Docs');
      expect(link?.getAttribute('role')).not.toBe('button');
      expect(host.querySelector('[data-pui-root]')).toBeNull();
    } finally {
      await rendered.destroy();
      host.remove();
    }
  });
  it('rejects arbitrary tags, event attributes, and script URLs', () => {
    const box = (tag: string, attrs: Record<string, string>) =>
      ({ type: 'demo', root: { kind: 'box', tag, attrs } }) as unknown as DemoSpec;
    expect(() => assertDemoSpec(box('script', {}))).toThrow('tag');
    expect(() => assertDemoSpec(box('a', { href: '/docs/', onclick: 'bad()' }))).toThrow(
      'attribute'
    );
    for (const href of ['javascript:alert(1)', ' java\nscript:alert(1)', 'data:text/html,bad'])
      expect(() => assertDemoSpec(box('a', { href }))).toThrow('safe href');
    expect(() => assertDemoSpec(demo)).not.toThrow();
  });
  it('derives nested and top-level source links from the actual executable module registry', () => {
    expect(getDemoSourcePath('demo-shadcn-button')).toBe(
      'apps/www/src/content/docs/zh-cn/demo-shadcn-button.demo.ts'
    );
    expect(getDemoSourcePath('demo-shadcn-tabs')).toBe(
      'apps/www/src/content/docs/demo_components/tabs/demo-shadcn-tabs.demo.ts'
    );
    expect(() => getDemoSourcePath('invented-demo')).toThrow('missing source path');
  });
  it('annotates the real icon Button DOM with its name and title instead of relying on undeclared props', async () => {
    await loadPrototypes(['shadcn-button']);
    const host = document.createElement('div');
    host.dataset.homepageThemeIcon = 'true';
    host.dataset.homepageThemeLabel = 'Toggle color theme';
    document.body.append(host);
    document.documentElement.dataset.theme = 'light';
    const content = createHomepageContent(
      {
        root: host,
        mount: host,
        fallback: host,
        ownerId: 'theme-name',
        links: [],
        theme: true,
        runtime: true,
      },
      'wc',
      () => true
    );
    const rendered = await renderDemo({ runtime: 'wc', demo: content, host });
    try {
      const button = host.querySelector<HTMLElement>('[data-demo-ref="home-theme"]')!;
      expect(button.getAttribute('role')).toBe('button');
      expect(button.querySelector('.site-header-theme-icon')?.getAttribute('aria-hidden')).toBe(
        'true'
      );
      expect(button.querySelector('.home-theme-accessible-label')?.textContent).toBe(
        'Toggle color theme'
      );
      expect(button.getAttribute('title')).toBe('Toggle color theme');
      expect(button.getAttribute('aria-pressed')).toBe('false');
      document.documentElement.dataset.theme = 'dark';
      document.dispatchEvent(
        new CustomEvent('starlight-theme:change', { detail: { theme: 'dark' } })
      );
      expect(button.querySelector('.home-theme-accessible-label')?.textContent).toBe(
        'Toggle color theme'
      );
      expect(button.getAttribute('title')).toBe('Toggle color theme');
      expect(button.getAttribute('aria-pressed')).toBe('true');
    } finally {
      await rendered.destroy();
      host.remove();
      document.documentElement.removeAttribute('data-theme');
    }
  });
});
