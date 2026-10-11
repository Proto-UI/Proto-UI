import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import * as Card from '../src/card';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';

const parts = ['Root', 'Header', 'Content', 'Footer'] as const;
const constructors = parts.map((part) => AdaptToWebComponent(Card[`ShadcnCard${part}`]));
const recipes = [
  [
    'flex',
    'flex-col',
    'gap-6',
    'rounded-xl',
    'border',
    'border-border',
    'bg-card',
    'py-6',
    'text-card-foreground',
    'shadow-sm',
  ],
  ['grid', 'auto-rows-min', 'grid-rows-[auto_auto]', 'items-start', 'gap-2', 'px-6'],
  ['px-6'],
  ['flex', 'items-center', 'px-6'],
];
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('draft Shadcn Card', () => {
  // T-SHADCN-CARD-0001-CASE-1
  it('exports exactly four direct parts with matching facade aliases', () => {
    expect(Object.keys(Card).sort()).toEqual(
      parts.flatMap((p) => [`ShadcnCard${p}`, `shadcnCard${p}`]).sort()
    );
    for (const part of parts) {
      expect(Card[`shadcnCard${part}`]).toBe(Card[`ShadcnCard${part}`]);
      const source = readFileSync(
        `packages/prototypes/shadcn/src/card/${part.toLowerCase()}.proto.ts`,
        'utf8'
      );
      expect(source).not.toMatch(/prototypes-base|asCard|\.event\.|\.state\.|\.a11y\./);
    }
  });
  // T-SHADCN-CARD-0001-CASE-2
  it('preserves slotted headings, text and native anchors without absorbing activation', async () => {
    const [root, header, content, footer] = constructors.map((C) => new C());
    const heading = document.createElement('h2');
    heading.textContent = 'Project';
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Details';
    const anchor = document.createElement('a');
    anchor.href = '#native-card-target';
    anchor.textContent = 'Read';
    let clicks = 0;
    anchor.addEventListener('click', (event) => {
      event.preventDefault();
      clicks++;
    });
    header.append(heading);
    content.append(paragraph);
    footer.append(anchor);
    root.append(header, content, footer);
    document.body.append(root);
    await settle();
    try {
      for (const element of [root, header, content, footer]) {
        expect(element.hasAttribute('role')).toBe(false);
        expect(element.hasAttribute('tabindex')).toBe(false);
        expect(element.tabIndex).toBe(-1);
        expect(element.getExposes()).toEqual({});
      }
      setElementProps(root, { interactive: true, clickable: true, selectable: true });
      root.update();
      await settle();
      expect(root.hasAttribute('role')).toBe(false);
      expect(root.tabIndex).toBe(-1);
      expect(header.contains(heading)).toBe(true);
      expect(content.contains(paragraph)).toBe(true);
      expect(footer.contains(anchor)).toBe(true);
      anchor.click();
      expect(clicks).toBe(1);
      expect(anchor.getAttribute('href')).toBe('#native-card-target');
    } finally {
      root.remove();
    }
  });
  // T-SHADCN-CARD-0001-CASE-3
  it('projects exact source recipes and closes them through the public token compiler', async () => {
    for (const [i, C] of constructors.entries()) {
      const element = new C();
      document.body.append(element);
      await settle();
      try {
        expect(
          (element.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean).sort()
        ).toEqual([...recipes[i]].sort());
        for (const token of recipes[i]) expect(styleContains(element, token)).toBe(true);
      } finally {
        element.remove();
      }
    }
    const css = renderProtoStyleTokenCss(recipes.flat());
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('background-color: var(--pui-card)');
    expect(css).toContain('color: var(--pui-card-foreground)');
    expect(css).toContain('border-color: var(--pui-border)');
    expect(css).not.toContain('background-color: var(--pui-background)');
    expect(css).not.toContain('color: var(--pui-foreground)');
    expect(css).toContain('grid-auto-rows: min-content');
    expect(css).toContain('grid-template-rows: auto auto');
  });
});
