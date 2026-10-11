import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { renderProtoStyleTokenCss } from '../src/services/proto-style-css';
import * as shadcn from '../../prototypes/shadcn/src/accordion';
import * as brutalist from '../../prototypes/brutalist/src/accordion';
import * as bootstrap from '../../prototypes/bootstrap-2-3-2/src/accordion';
import * as liquid from '../../prototypes/liquid-glass/src/accordion';
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 5));
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
describe('Accordion source to Web compiler closure', () => {
  for (const [name, family] of Object.entries({ shadcn, brutalist, bootstrap, liquid }))
    it(`${name} compiles every observed atom/state token and retains caller content`, async () => {
      const construct = (role: string) => {
        const proto = (family as any)[`accordion${role}`];
        if (!customElements.get(proto.name)) AdaptToWebComponent(proto);
        return document.createElement(proto.name) as any;
      };
      const root = construct('Root'),
        item = construct('Item'),
        heading = construct('Heading'),
        trigger = construct('Trigger'),
        content = construct('Content');
      setElementProps(item, { value: 'long-label' });
      setElementProps(content, { keepMounted: true });
      const label = document.createElement('span');
      label.textContent =
        'A long author-owned label that wraps rather than clips at larger text sizes';
      trigger.append(label);
      content.textContent = 'Overflow-contained content';
      heading.append(trigger);
      item.append(heading, content);
      root.append(item);
      document.body.append(root);
      await flush();
      const verify = () => {
        for (const node of [root, item, heading, trigger, content])
          for (const token of (node.getAttribute('data-pui-style') ?? '')
            .split(/\s+/)
            .filter(Boolean)) {
            expect(renderProtoStyleTokenCss([token]), `${name}: ${token}`).not.toContain(
              'Unsupported Proto UI style tokens'
            );
          }
      };
      verify();
      trigger.focus();
      trigger.dispatchEvent(new MouseEvent('pointerenter'));
      trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      await flush();
      verify();
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
      verify();
      expect(trigger.contains(label)).toBe(true);
      expect(trigger.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(trigger.querySelector('path')?.getAttribute('d')).toBe('m6 15 6-6 6 6');
      expect(content.getExposes().open.get()).toBe(true);
      setElementProps(item, { value: 'long-label', disabled: true });
      await flush();
      verify();
      expect(trigger.tabIndex).toBe(-1);
      expect(trigger.getAttribute('data-pui-style')).toContain('whitespace-normal');
      expect(trigger.getAttribute('data-pui-style')).toContain('min-w-0');
    });
});

import { renderHostIndex } from '../src/services/codegen';
import { listComponentChoices } from '../src/registry/components';
import { collectProtoStyleTokens } from '../src/services/prototype-style-tokens';
import path from 'node:path';
describe('Accordion facade and complete source-token closure', () => {
  for (const family of ['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass']) {
    it(`${family} generates five-atom facades and respects source-only admission`, async () => {
      const privateSource = family === 'bootstrap-2-3-2' || family === 'liquid-glass';
      for (const host of ['react', 'vue', 'vue2', 'wc']) {
        if (privateSource)
          expect(() => renderHostIndex(host, [`${family}-accordion`])).toThrow(
            /workspace-source-only/
          );
        const code = renderHostIndex(
          host,
          [`${family}-accordion`],
          privateSource ? { sourceMode: 'workspace' } : {}
        );
        expect(code).toContain(`from '@proto.ui/prototypes-${family}/accordion'`);
        for (const role of ['Root', 'Item', 'Heading', 'Trigger', 'Content'])
          expect(code).toContain(`accordion${role}`);
      }
      if (privateSource)
        expect(listComponentChoices().some((i) => i.value === `${family}-accordion`)).toBe(false);
      const tokens = await collectProtoStyleTokens(
        path.resolve(`packages/prototypes/${family}/src/accordion`)
      );
      expect(renderProtoStyleTokenCss(tokens as string[])).not.toContain(
        'Unsupported Proto UI style tokens'
      );
    });
  }
});
