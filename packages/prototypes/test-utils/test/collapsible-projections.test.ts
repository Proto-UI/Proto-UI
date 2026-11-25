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
  // bootstrap-2-3-2's pinned collapsible trigger is a link-styled toggle with
  // no chrome; its historical link color is the family visual marker.
  ['bootstrap-2-3-2', bootstrap, 'text-[#08c]'],
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
              ? // Pinned Bootstrap 2.3.2 link ink on the bare collapsible
                // toggle; there is no theme-primary token in this family.
                'text-[#08c]'
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
        // Historical padding belongs to the inner body. The height-animation
        // owner must have no padding that would keep a closed frame nonzero.
        expect(styleContains(trigger, 'px-[15px]')).toBe(true);
        expect(styleContains(content, 'py-[9px]')).toBe(false);
        const body = content.querySelector('div');
        expect(body).not.toBeNull();
        expect(styleContains(body!, 'px-[15px]')).toBe(true);
        expect(styleContains(body!, 'py-[9px]')).toBe(true);
        expect(body!.textContent).toBe('A very long content word '.repeat(30));
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
          family === 'liquid-glass'
            ? // Disabled withdraws optical elevation rather than dimming the
              // control (COMMAND_DISABLED keeps an opaque quiet surface). Its
              // compound material rules evaluate at runtime, so the quiet
              // paint materializes unprefixed while disabled is true.
              'shadow-none'
            : family === 'bootstrap-2-3-2'
              ? // Pinned Bootstrap link/button disabled opacity is 65%.
                'data-[disabled]:opacity-65'
              : 'data-[disabled]:opacity-50'
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

it.each(['bootstrap-2-3-2', 'brutalist'])(
  '%s keeps the disclosure open while its painted parts follow the live theme',
  async (family) => {
    const html = document.documentElement;
    const previousTheme = html.getAttribute('data-theme');
    try {
      html.dataset.theme = 'light';
      const root = document.createElement(`${family}-collapsible-root`);
      const trigger = document.createElement(`${family}-collapsible-trigger`);
      const content = document.createElement(`${family}-collapsible-content`);
      setElementProps(root, { defaultOpen: true });
      content.textContent = 'Disclosure body';
      root.append(trigger, content);
      document.body.append(root);
      await flush();
      expect(trigger.getAttribute('aria-expanded')).toBe('true');

      if (family === 'bootstrap-2-3-2') {
        const body = content.querySelector('div')!;
        expect(body).not.toBeNull();
        expect(styleContains(root, 'border-[#e5e5e5]')).toBe(true);
        expect(styleContains(body, 'border-[#e5e5e5]')).toBe(true);
        expect(styleContains(body, 'dark:border-border')).toBe(true);
        expect(styleContains(trigger, 'text-[#08c]')).toBe(true);
        html.dataset.theme = 'dark';
        expect(styleContains(root, 'dark:border-border')).toBe(true);
        trigger.dispatchEvent(new Event('pointerenter'));
        await expect.poll(() => styleContains(trigger, 'text-foreground')).toBe(true);
        expect(styleContains(trigger, 'text-[#005580]')).toBe(false);
      } else {
        expect(styleContains(content, 'border-border')).toBe(true);
        expect(styleContains(trigger, 'shadow-[4px_4px_0_0_#000]')).toBe(true);
        html.dataset.theme = 'dark';
        expect(styleContains(content, 'dark:border-foreground')).toBe(true);
        expect(styleContains(trigger, 'dark:border-foreground')).toBe(true);
        await expect
          .poll(() => styleContains(trigger, 'shadow-[4px_4px_0_0_var(--pui-foreground)]'))
          .toBe(true);
        trigger.dispatchEvent(new Event('pointerdown'));
        await flush();
        expect(styleContains(trigger, 'shadow-none')).toBe(true);
        trigger.dispatchEvent(new Event('pointercancel'));
        await flush();
        expect(styleContains(trigger, 'shadow-[4px_4px_0_0_var(--pui-foreground)]')).toBe(true);
        setElementProps(trigger, { variant: 'noShadow' });
        await flush();
        expect(styleContains(trigger, 'shadow-none')).toBe(true);
        expect(styleContains(trigger, 'shadow-[4px_4px_0_0_var(--pui-foreground)]')).toBe(false);
      }
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(content.textContent).toBe('Disclosure body');
    } finally {
      if (previousTheme === null) html.removeAttribute('data-theme');
      else html.setAttribute('data-theme', previousTheme);
    }
  }
);
