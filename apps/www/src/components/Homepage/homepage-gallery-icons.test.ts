import { describe, expect, it } from 'vitest';
import type { DemoNode } from '../PrototypePreviewer/demo-types';
import {
  appendHomepageGalleryGlyph,
  appendHomepageGallerySampleBars,
  HOMEPAGE_GALLERY_ICONS,
  homepageGalleryIcon,
  type HomepageGalleryIcon,
} from './homepage-gallery-icons';

describe('homepage gallery decorative artwork', () => {
  it('allocates one unique ref slot per card icon', () => {
    const names = Object.keys(HOMEPAGE_GALLERY_ICONS) as HomepageGalleryIcon[];
    expect(names).toHaveLength(10);
    const slots = names.map((name) => homepageGalleryIcon(name));
    const refs: string[] = [];
    const visit = (node: DemoNode) => {
      if (node.kind === 'text') return;
      if (node.ref) refs.push(node.ref);
      for (const child of node.children ?? []) if (typeof child !== 'string') visit(child);
    };
    for (const slot of slots) visit(slot);
    expect(new Set(refs).size).toBe(names.length);
    expect(refs).toEqual(names.map((name) => `gallery-icon-${name}`));
  });

  it('renders real Lucide paths as decorative SVG without accessible names', () => {
    const host = document.createElement('div');
    document.body.append(host);
    try {
      for (const name of Object.keys(HOMEPAGE_GALLERY_ICONS) as HomepageGalleryIcon[]) {
        const slot = document.createElement('span');
        host.append(slot);
        appendHomepageGalleryGlyph(slot, name);
        const svg = slot.querySelector('svg')!;
        expect(svg).not.toBeNull();
        expect(svg.getAttribute('aria-hidden')).toBe('true');
        expect(svg.getAttribute('focusable')).toBe('false');
        expect(svg.getAttribute('stroke')).toBe('currentColor');
        expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
        for (const path of svg.querySelectorAll('path'))
          expect(path.getAttribute('d')?.length).toBeGreaterThan(0);
      }
    } finally {
      host.remove();
    }
  });

  it('renders six sample bars whose heights can be observed without fabricating metrics', () => {
    const host = document.createElement('div');
    document.body.append(host);
    try {
      appendHomepageGallerySampleBars(host);
      const svg = host.querySelector('svg')!;
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      const bars = [...host.querySelectorAll('rect[data-gallery-bar]')];
      expect(bars).toHaveLength(6);
      expect(bars.map((bar) => bar.getAttribute('height'))).toEqual([
        '13',
        '19',
        '22',
        '30',
        '27',
        '37',
      ]);
      for (const bar of bars) expect(bar.getAttribute('fill')).toBe('currentColor');
    } finally {
      host.remove();
    }
  });
});
