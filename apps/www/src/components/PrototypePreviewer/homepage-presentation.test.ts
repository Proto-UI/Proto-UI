// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Homepage presentation source boundaries', () => {
  it('preserves the maintainer-selected Chinese Demo CTA and its existing destination', () => {
    const home = read('apps/www/src/content/docs/zh-cn/index.mdx');
    expect(home).toContain("    - text: 试试 Demo\n      link: '#home-demo-previewer'");
    expect(home).not.toContain('试试交互');
  });

  it('preserves the approved bilingual slogan and supporting line exactly', () => {
    for (const [locale, title, tagline] of [
      ['zh-cn', '组件可以独立于框架或设计体系', '而不是在不同框架中被反复实现'],
      [
        'en',
        'Components should not depend on frameworks or designs.',
        'Defined once — not rebuilt per framework.',
      ],
    ]) {
      const home = read(`apps/www/src/content/docs/${locale}/index.mdx`);
      expect(home.split('\n')).toContain(`title: ${title}`);
      expect(home.split('\n')).toContain(`  tagline: ${tagline}`);
    }
  });

  it('shows the task without conceptual headings, metadata or styled wrapper surfaces', () => {
    const preview = read('apps/www/src/components/PrototypePreviewer/HomeDemoPreviewer.astro');
    expect(preview).toContain('data-home-showcase="website-component-gallery"');
    expect(preview).toContain('data-home-demo-host');
    expect(preview).toContain('aria-live="polite"');
    for (const removed of [
      'home-demo-previewer__intro-title',
      'data-home-demo-source',
      'home-demo-previewer__scope',
      'home-demo-previewer__research',
      'background:',
      'border:',
      'border-radius:',
      'box-shadow:',
    ]) {
      expect(preview).not.toContain(removed);
    }
    expect(preview).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
    expect(preview).toContain('grid-template-columns: minmax(0, 1fr);');
  });
  it('uses one defined bilingual sans-serif stack instead of an unresolved color token', () => {
    const style = read('apps/www/src/styles/tailwindcss.css');
    expect(style).toContain('--font-sans:');
    expect(style).toContain("'PingFang SC'");
    expect(style).toContain("'Microsoft YaHei'");
    expect(style).toContain("'Noto Sans CJK SC'");
    expect(style).toContain('font-family: var(--font-sans)');
    expect(style).not.toContain('--color-font-geist-sans');
    expect(style).not.toContain('GeistVF.woff2');
  });

  it('keeps technical scope and research qualifications in secondary docs', () => {
    for (const locale of ['en', 'zh-cn']) {
      const doc = read(`apps/www/src/content/docs/${locale}/build/runtime-architecture.md`);
      expect(doc).toContain('website-component-gallery');
      expect(doc).toContain('Flutter');
      expect(doc).toContain('GPUI');
    }
  });

  it('keeps the native-link journey bound to the actual global family picker', () => {
    const journey = read('apps/www/src/content/docs/zh-cn/site-native-links.browser.test.ts');
    expect(journey).toContain(
      '[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="family"]'
    );
    expect(journey).not.toContain('[data-home-demo-options]');
  });

  it('retains docs, live example and whitepaper paths while dogfooding actions', () => {
    const hero = read('apps/www/src/components/override/Hero.astro');
    expect(hero).toContain('HomeActions');
    expect(hero).toContain('/whitepaper/0-preface/');
    for (const locale of ['en', 'zh-cn']) {
      const home = read(`apps/www/src/content/docs/${locale}/index.mdx`);
      expect(home).toContain(`/${locale}/start-here/quick-start/`);
      expect(read(`apps/www/src/content/docs/${locale}/start-here/quick-start.mdx`)).toContain(
        'npx @proto.ui/cli@latest'
      );
      expect(home).toContain("'#home-demo-previewer'");
    }
  });
});
