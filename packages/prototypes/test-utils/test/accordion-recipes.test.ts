import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { collectProtoStyleTokensFromFiles } from '../../../cli/src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import * as shadcn from '../../shadcn/src/accordion';
import * as brutalist from '../../brutalist/src/accordion';
import * as bootstrap from '../../bootstrap-2-3-2/src/accordion';
import * as glass from '../../liquid-glass/src/accordion';

const families = { shadcn, brutalist, 'bootstrap-2-3-2': bootstrap, 'liquid-glass': glass };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

const recipes = [
  [
    'shadcn',
    'trigger',
    [
      'py-2.5',
      'rounded-lg',
      'border-transparent',
      'data-[focus-visible]:ring-3',
      'data-[focus-visible]:ring-ring/50',
    ],
    ['py-4', 'data-[focus-visible]:ring-offset-2'],
  ],
  ['shadcn', 'content', ['pb-2.5'], ['pb-4']],
  [
    'brutalist',
    'trigger',
    ['bg-main', 'text-main-foreground', 'font-heading', 'data-[expanded]:border-b-2'],
    ['data-[hovered]:bg-secondary', 'data-[expanded]:bg-secondary'],
  ],
  ['brutalist', 'item', ['rounded-base', 'overflow-hidden'], []],
  [
    'brutalist',
    'content',
    ['text-sm', 'bg-secondary-background', 'font-medium'],
    ['text-base', 'border-t-2'],
  ],
] as const;

describe('Accordion component-specific recipe source closure', () => {
  for (const [family, part, required, forbidden] of recipes) {
    it(`${family} ${part} keeps the reviewed recipe and rejects its superseded shell`, async () => {
      const tokens = await collectProtoStyleTokensFromFiles([
        path.resolve(`packages/prototypes/${family}/src/accordion/${part}.proto.ts`),
      ]);
      for (const token of required) expect(tokens, token).toContain(token);
      for (const token of forbidden) expect(tokens, token).not.toContain(token);
      expect(renderProtoStyleTokenCss(tokens as string[])).not.toContain(
        'Unsupported Proto UI style tokens'
      );
    });
  }
  for (const [family, entries] of Object.entries(families)) {
    it(`${family} protects the decorative chevron without changing the disclosure owner`, async () => {
      for (const proto of Object.values(entries))
        if (typeof proto === 'object' && 'name' in proto && !customElements.get(proto.name))
          AdaptToWebComponent(proto);
      const root = document.createElement(`${family}-accordion-root`) as any;
      const item = document.createElement(`${family}-accordion-item`);
      const heading = document.createElement(`${family}-accordion-heading`);
      const trigger = document.createElement(`${family}-accordion-trigger`) as any;
      const content = document.createElement(`${family}-accordion-content`) as any;
      setElementProps(item, { value: 'one' });
      setElementProps(content, { keepMounted: true });
      const label = document.createElement('span');
      label.textContent = 'AnAuthorOwnedVeryLongWord'.repeat(12);
      trigger.append(label);
      heading.append(trigger);
      item.append(heading, content);
      root.append(item);
      document.body.append(root);
      await flush();
      const glyph = trigger.querySelector('svg')!;
      expect(glyph.getAttribute('width')).toBe(family === 'brutalist' ? '20' : '16');
      expect(glyph.getAttribute('aria-hidden')).toBe('true');
      const frame = glyph.parentElement!;
      expect(frame).not.toBe(trigger);
      const tokens = (frame.getAttribute('data-pui-style') ?? '').split(/\s+/);
      expect(tokens).toEqual(expect.arrayContaining(['shrink-0', 'pointer-events-none']));
      expect(frame.hasAttribute('tabindex')).toBe(false);
      expect(trigger.contains(label)).toBe(true);
      const requests: unknown[] = [];
      root.addEventListener('openChange', (event: CustomEvent) => requests.push(event.detail));
      trigger.click();
      await flush();
      expect(root.getExposes().getOpenItems()).toEqual(['one']);
      expect(requests).toHaveLength(1);
      setElementProps(item, { value: 'one', disabled: true });
      await flush();
      trigger.click();
      await flush();
      expect(requests).toHaveLength(1);
      const collected = await collectProtoStyleTokensFromFiles([
        path.resolve(`packages/prototypes/${family}/src/accordion/trigger.proto.ts`),
      ]);
      expect(collected).toContain('shrink-0');
      expect(collected).toContain('data-[disabled]:opacity-50');
      expect(renderProtoStyleTokenCss(collected as string[])).not.toContain(
        'Unsupported Proto UI style tokens'
      );
    });
  }
});
