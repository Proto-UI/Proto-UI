import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as shadcn from '../../shadcn/src/alert-dialog';
import * as brutalist from '../../brutalist/src/alert-dialog';
import * as bootstrap from '../../bootstrap-2-3-2/src/alert-dialog';
import * as glass from '../../liquid-glass/src/alert-dialog';

const families = { shadcn, brutalist, 'bootstrap-2-3-2': bootstrap, 'liquid-glass': glass };
const owned = new Set<HTMLElement>();
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const node of owned) node.remove();
  owned.clear();
  document.body.replaceChildren();
  await flush();
});
const tokensOf = (el: HTMLElement) => (el.getAttribute('data-pui-style') ?? '').split(/\s+/);
const hasIntent = (el: HTMLElement, token: string) =>
  tokensOf(el).some((value) => value === token || value.endsWith(`:${token}`));

for (const [family, entries] of Object.entries(families)) {
  for (const proto of Object.values(entries))
    if (typeof proto === 'object' && 'name' in proto && !customElements.get(proto.name))
      AdaptToWebComponent(proto);
  const fixture = (disabled = false) => {
    const parts: Record<string, any> = {};
    for (const name of ['Root', 'Trigger', 'Content', 'Title', 'Description', 'Action', 'Cancel']) {
      const element = document.createElement(`${family}-alert-dialog-${name.toLowerCase()}`) as any;
      parts[name.toLowerCase()] = element;
      owned.add(element);
    }
    setElementProps(parts.root, { open: true, disabled });
    parts.title.textContent = 'Review changes';
    parts.description.textContent = 'Confirm or keep editing.';
    parts.action.textContent = 'ConfirmAVeryLongAuthorOwnedOperation'.repeat(4);
    parts.cancel.textContent = 'ContinueEditingAVeryLongAuthorOwnedOperation'.repeat(4);
    parts.content.append(parts.title, parts.description, parts.cancel, parts.action);
    parts.root.append(parts.trigger, parts.content);
    document.body.append(parts.root);
    return parts;
  };
  describe(`${family} AlertDialog passive command paint`, () => {
    it('has a primary action and distinct neutral cancel, wrap-safe geometry and no second button owner', async () => {
      const p = fixture();
      await flush();
      const primary =
        family === 'brutalist'
          ? 'bg-main'
          : family === 'bootstrap-2-3-2'
            ? 'bg-[linear-gradient(#08c,#04c)]'
            : 'bg-primary';
      const neutral =
        family === 'brutalist'
          ? 'bg-secondary-background'
          : family === 'bootstrap-2-3-2'
            ? 'bg-[linear-gradient(#fff,#e6e6e6)]'
            : family === 'liquid-glass'
              ? 'bg-secondary'
              : 'bg-background';
      expect(hasIntent(p.action, primary)).toBe(true);
      expect(hasIntent(p.cancel, neutral)).toBe(true);
      expect(tokensOf(p.cancel)).not.toContain(primary);
      for (const role of ['action', 'cancel']) {
        expect(tokensOf(p[role])).toEqual(
          expect.arrayContaining(['min-w-0', 'max-w-full', 'whitespace-normal', 'wrap-anywhere'])
        );
        expect(tokensOf(p[role]).some((value) => /^h-(?:8|9|10)$/.test(value))).toBe(false);
        const source = await readFile(
          path.resolve(`packages/prototypes/${family}/src/alert-dialog/${role}.proto.ts`),
          'utf8'
        );
        expect(source).not.toContain('asButton');
        expect(source).not.toContain('def.event.on');
      }
    });
    it('borrows hover/press states, cancels press, and emits only the original controlled commands', async () => {
      const p = fixture();
      await flush();
      const actions: unknown[] = [],
        requests: unknown[] = [];
      p.action.addEventListener('action', (event: CustomEvent) => actions.push(event.detail));
      p.root.addEventListener('openChange', (event: CustomEvent) => requests.push(event.detail));
      for (const role of ['action', 'cancel']) {
        p[role].dispatchEvent(new Event('pointerenter'));
        await flush();
        expect(p[role].getExposes().hovered.get()).toBe(true);
        const hovered =
          family === 'brutalist'
            ? 'translate-x-1'
            : family === 'bootstrap-2-3-2'
              ? role === 'action'
                ? 'bg-[#04c]'
                : 'bg-[#e6e6e6]'
              : family === 'liquid-glass'
                ? 'shadow-md'
                : role === 'action'
                  ? 'bg-primary/80'
                  : 'bg-muted';
        expect(hasIntent(p[role], hovered)).toBe(true);
        p[role].dispatchEvent(new Event('pointerdown'));
        await flush();
        expect(p[role].getExposes().pressed.get()).toBe(true);
        const pressed =
          family === 'brutalist'
            ? 'translate-x-1'
            : family === 'bootstrap-2-3-2'
              ? 'shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]'
              : family === 'liquid-glass'
                ? 'shadow-xs'
                : 'translate-y-px';
        expect(hasIntent(p[role], pressed)).toBe(true);
        p[role].dispatchEvent(new Event('pointercancel'));
        await flush();
        expect(p[role].getExposes().pressed.get()).toBe(false);
      }
      expect(actions).toHaveLength(0);
      expect(requests).toHaveLength(0);
      p.action.click();
      await flush();
      expect(actions).toHaveLength(1);
      expect(requests).toHaveLength(1);
      expect(p.root.getExposes().open.get()).toBe(true);
      p.cancel.click();
      await flush();
      expect(actions).toHaveLength(1);
      expect(requests).toHaveLength(2);
      p.action.click();
      await flush();
      expect(actions).toHaveLength(2);
      expect(requests).toHaveLength(3);
      setElementProps(p.root, { open: true, disabled: true });
      await flush();
      p.action.click();
      p.cancel.click();
      await flush();
      expect(actions).toHaveLength(2);
      expect(requests).toHaveLength(3);
      for (const role of ['action', 'cancel']) {
        expect(p[role].getExposes().disabled.get()).toBe(true);
        expect(p[role].getExposes().pressed.get()).toBe(false);
      }
    });
  });
}
