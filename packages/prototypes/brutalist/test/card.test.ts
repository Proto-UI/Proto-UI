import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import * as CardModule from '../src/card';
import {
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardContent,
  BrutalistCardFooter,
} from '../src/card';

const BrutalistCardRootElement = AdaptToWebComponent(BrutalistCardRoot);
const BrutalistCardHeaderElement = AdaptToWebComponent(BrutalistCardHeader);
const BrutalistCardContentElement = AdaptToWebComponent(BrutalistCardContent);
const BrutalistCardFooterElement = AdaptToWebComponent(BrutalistCardFooter);

const CARD_EXPORT_NAMES = [
  'BrutalistCardRoot',
  'brutalistCardRoot',
  'BrutalistCardHeader',
  'brutalistCardHeader',
  'BrutalistCardContent',
  'brutalistCardContent',
  'BrutalistCardFooter',
  'brutalistCardFooter',
];

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function updateProps(element: HTMLElement, next: Record<string, unknown>): void {
  setElementProps(element, next);
  (element as HTMLElement & { update?: () => void }).update?.();
}

describe('prototypes/brutalist: card', () => {
  // T-BRUTALIST-CARD-0001-CASE-1
  it('exports only Root, Header, Content, and Footer with public facade aliases', () => {
    expect(CARD_EXPORT_NAMES.sort()).toEqual(Object.keys(CardModule).sort());
  });

  // T-BRUTALIST-CARD-0001-CASE-1
  it('owns every retained part directly without Base Card imports or hooks', () => {
    for (const file of [
      'root.proto.ts',
      'header.proto.ts',
      'content.proto.ts',
      'footer.proto.ts',
    ]) {
      const source = readFileSync(
        resolve(process.cwd(), 'packages/prototypes/brutalist/src/card', file),
        'utf8'
      );
      expect(source).not.toContain('@proto.ui/prototypes-base/card');
      expect(source).not.toMatch(/\basCard(?:Root|Header|Content|Footer)\b/);
    }
  });

  // T-BRUTALIST-CARD-0001-CASE-2
  it('is a passive roleless non-focusable grouping surface', async () => {
    const root = new BrutalistCardRootElement();
    const header = new BrutalistCardHeaderElement();
    const content = new BrutalistCardContentElement();
    const footer = new BrutalistCardFooterElement();
    root.append(header, content, footer);
    document.body.appendChild(root);
    await flush();

    for (const el of [root, header, content, footer]) {
      expect(el.hasAttribute('role')).toBe(false);
      expect(el.tabIndex).toBe(-1);
      expect(el.getExposes()).toEqual({});
    }

    updateProps(root, { interactive: true, clickable: true, selectable: true });
    await flush();
    expect(root.hasAttribute('role')).toBe(false);
    expect(root.tabIndex).toBe(-1);

    root.remove();
  });

  // T-BRUTALIST-CARD-0001-CASE-2
  // T-BRUTALIST-CARD-0001-CASE-3
  it('projects paper grouping and directional separators as direct parts', async () => {
    const root = new BrutalistCardRootElement();
    const header = new BrutalistCardHeaderElement();
    const content = new BrutalistCardContentElement();
    const footer = new BrutalistCardFooterElement();
    root.append(header, content, footer);
    document.body.appendChild(root);
    await flush();

    expect(styleContains(root, 'rounded-none')).toBe(true);
    expect(styleContains(root, 'border-2')).toBe(true);
    expect(styleContains(root, 'border-foreground')).toBe(true);
    expect(styleContains(header, 'border-b-2')).toBe(true);
    expect(styleContains(header, 'border-foreground')).toBe(true);
    expect(styleContains(content, 'px-6')).toBe(true);
    expect(styleContains(footer, 'border-t-2')).toBe(true);
    expect(styleContains(footer, 'border-foreground')).toBe(true);

    // Section separators resolve the same ink as the Root frame, so a theme
    // change repaints them with the Card instead of leaving fixed black.
    expect(styleContains(header, 'brutalist-border-bottom-black')).toBe(false);
    expect(styleContains(footer, 'brutalist-border-top-black')).toBe(false);

    root.remove();
  });

  // T-BRUTALIST-CARD-0001-CASE-2
  it('composes an ordinary Button child as content without absorbing its activation', async () => {
    const root = new BrutalistCardRootElement();
    const content = new BrutalistCardContentElement();
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Confirm';
    content.appendChild(button);
    root.appendChild(content);
    document.body.appendChild(root);
    await flush();

    expect(content.contains(button)).toBe(true);
    expect(button.type).toBe('button');
    expect(root.hasAttribute('role')).toBe(false);
    button.click();
    await flush();
    expect(root.tabIndex).toBe(-1);

    root.remove();
  });
});
