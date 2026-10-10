import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../style';
import * as shadcn from '../../shadcn/src/collapsible';
import * as brutalist from '../../brutalist/src/collapsible';
import * as bootstrap from '../../bootstrap-2-3-2/src/collapsible';
import * as glass from '../../liquid-glass/src/collapsible';

const families = [
  ['shadcn', shadcn, 'rounded-md'],
  ['brutalist', brutalist, 'border-2'],
  ['bootstrap-2-3-2', bootstrap, 'rounded-[4px]'],
  ['liquid-glass', glass, 'rounded-xl'],
] as const;
async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
for (const [family, entries, visualToken] of families) {
  for (const part of ['Root', 'Trigger', 'Content'] as const)
    AdaptToWebComponent(entries[`collapsible${part}`]);
  describe(`${family}: direct Collapsible presentation`, () => {
    it('exports three independently named Base consumers and retains hidden content truth', async () => {
      for (const part of ['Root', 'Trigger', 'Content'] as const)
        expect(entries[`collapsible${part}`].name).toBe(
          `${family}-collapsible-${part.toLowerCase()}`
        );
      const root = document.createElement(`${family}-collapsible-root`) as any;
      const trigger = document.createElement(`${family}-collapsible-trigger`) as any;
      const content = document.createElement(`${family}-collapsible-content`) as any;
      const authoredLabel = '  A very long disclosure label  \n'.repeat(10);
      trigger.textContent = authoredLabel;
      content.textContent = 'A very long content word '.repeat(30);
      setElementProps(content, { keepMounted: true });
      root.append(trigger, content);
      document.body.append(root);
      await flush();
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(content.getExposes().hidden.get()).toBe(true);
      expect(styleContains(content, 'data-[hidden]:hidden')).toBe(true);
      expect(styleContains(trigger, visualToken)).toBe(true);
      for (const host of [root, trigger, content]) {
        expect(styleContains(host, 'min-w-0')).toBe(true);
        expect(styleContains(host, 'max-w-full')).toBe(true);
      }
      expect(styleContains(trigger, 'whitespace-break-spaces')).toBe(true);
      expect(trigger.textContent).toBe(authoredLabel);
      expect(styleContains(trigger, 'text-left')).toBe(true);
      expect(
        styleContains(
          trigger,
          family === 'brutalist'
            ? 'text-main-foreground'
            : family === 'bootstrap-2-3-2'
              ? 'text-primary'
              : 'text-foreground'
        )
      ).toBe(true);
      expect(styleContains(trigger, 'wrap-anywhere')).toBe(true);
      expect(styleContains(content, 'wrap-anywhere')).toBe(true);
      if (family === 'brutalist') {
        expect(styleContains(root, 'pr-1')).toBe(true);
        expect(styleContains(root, 'pb-1')).toBe(true);
        expect(styleContains(content, 'font-sans')).toBe(true);
        expect(styleContains(content, 'font-medium')).toBe(true);
      }
      if (family === 'bootstrap-2-3-2') {
        expect(styleContains(trigger, 'px-[0.9375rem]')).toBe(true);
        expect(styleContains(content, 'py-[0.5625rem]')).toBe(true);
      }
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
      expect(root.getExposes().open.get()).toBe(true);
      expect(content.getExposes().hidden.get()).toBe(false);
      expect(content.hasAttribute('data-hidden')).toBe(false);
      expect(content.hasAttribute('role')).toBe(false);
      expect(content.hasAttribute('tabindex')).toBe(false);
      setElementProps(root, { disabled: true });
      await flush();
      expect(trigger.getExposes().disabled.get()).toBe(true);
      expect(trigger.tabIndex).toBe(-1);
      expect(root.getExposes().open.get()).toBe(true);
      expect(
        styleContains(
          trigger,
          family === 'liquid-glass' ? 'opacity-50' : 'data-[disabled]:opacity-50'
        )
      ).toBe(true);
    });
    it('styles Base hover, pressed and keyboard focus without another control owner', async () => {
      const root = document.createElement(`${family}-collapsible-root`) as any;
      const trigger = document.createElement(`${family}-collapsible-trigger`) as any;
      const content = document.createElement(`${family}-collapsible-content`) as any;
      root.append(trigger, content);
      document.body.append(root);
      await flush();
      trigger.dispatchEvent(new Event('pointerenter'));
      await flush();
      expect(trigger.getExposes().hovered.get()).toBe(true);
      trigger.dispatchEvent(new Event('pointerdown'));
      await flush();
      expect(trigger.getExposes().pressed.get()).toBe(true);
      trigger.dispatchEvent(new Event('pointercancel'));
      await flush();
      expect(trigger.getExposes().pressed.get()).toBe(false);
      trigger.getExposes().focusSelf();
      await flush();
      expect(trigger.getExposes().focused.get()).toBe(true);
      setElementProps(trigger, { disabled: true });
      await flush();
      expect(trigger.getExposes().hovered.get()).toBe(false);
      expect(trigger.getExposes().pressed.get()).toBe(false);
    });
  });
}
