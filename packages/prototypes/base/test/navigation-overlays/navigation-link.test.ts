import { activationTurn } from '../../../../modules/native-link/test/no-network';
import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../../src/navigation-menu';
import * as shadcn from '../../../shadcn/src/navigation-menu';
import * as brutalist from '../../../brutalist/src/navigation-menu';
import * as bootstrap from '../../../bootstrap-2-3-2/src/navigation-menu';
import * as liquid from '../../../liquid-glass/src/navigation-menu';
const families = [base, shadcn, brutalist, bootstrap, liquid];
const owned = new Set<HTMLElement>();
const lives = { created: 0, disposed: 0 };
for (const family of families)
  for (const proto of [
    family.navigationMenuRoot,
    family.navigationMenuTrigger,
    family.navigationMenuContent,
    family.navigationMenuLink,
  ])
    AdaptToWebComponent(proto as any, {
      diagnostics: {
        onLifecycleEvent(event) {
          if (event.type === 'instance.created') lives.created++;
          if (event.type === 'instance.dispose.done') lives.disposed++;
        },
      },
    });
const flush = async () => {
  await activationTurn();
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const node of owned) node.remove();
  await expect.poll(() => lives.disposed).toBe(lives.created);
  owned.clear();
});
type NavigationParts = Pick<
  typeof base,
  'navigationMenuRoot' | 'navigationMenuTrigger' | 'navigationMenuContent' | 'navigationMenuLink'
>;
function fixture(
  family: NavigationParts = base,
  props: Record<string, unknown> = {},
  rootProps: Record<string, unknown> = {}
) {
  const root = document.createElement(family.navigationMenuRoot.name) as any;
  const trigger = document.createElement(family.navigationMenuTrigger.name) as any;
  const content = document.createElement(family.navigationMenuContent.name) as any;
  const link = document.createElement(family.navigationMenuLink.name) as any;
  const text = document.createElement('span');
  text.textContent = 'Guide';
  for (const node of [root, trigger, content, link]) owned.add(node);
  setElementProps(root, { defaultValue: 'guide', ...rootProps });
  setElementProps(trigger, { value: 'guide' });
  setElementProps(content, { value: 'guide' });
  setElementProps(link, { href: '#guide', ...props });
  trigger.textContent = 'Docs';
  link.append(text);
  content.append(link);
  root.append(trigger, content);
  document.body.append(root);
  const events: unknown[] = [];
  link.addEventListener('navigate', (event: CustomEvent) => events.push(event.detail));
  return { root, trigger, content, link, text, events };
}
function click(anchor: HTMLElement, init: MouseEventInit = {}) {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
    detail: 1,
    ...init,
  });
  anchor.dispatchEvent(event);
  return event;
}
function key(anchor: HTMLElement, value: string) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value });
  anchor.dispatchEvent(event);
  return event;
}
describe.each(families.map((family) => [family.navigationMenuLink.name, family] as const))(
  '%s native projection',
  (_name, family) => {
    it('retains caller content in one real anchor and preserves browser defaults', async () => {
      const p = fixture(family);
      await flush();
      const anchor = p.link.querySelector('a') as HTMLAnchorElement;
      expect(anchor).not.toBeNull();
      expect(p.link.querySelectorAll('a')).toHaveLength(1);
      expect(anchor.getAttribute('href')).toBe('#guide');
      expect(anchor.contains(p.text)).toBe(true);
      p.link.getExposes().focusSelf({ reason: 'keyboard' });
      await flush();
      expect(document.activeElement).toBe(anchor);
      const event = click(anchor);
      expect(p.root.getExposes().value.get()).toBe('guide');
      await flush();
      expect(event.defaultPrevented).toBe(false);
      expect(p.events).toEqual([{ href: '#guide', target: '_self', rel: '', modified: false }]);
      expect(p.root.getExposes().value.get()).toBe('');
    });
  }
);
it('waits for native Enter click, ignores Space, and keeps modified activation open', async () => {
  const p = fixture();
  await flush();
  const anchor = p.link.querySelector('a') as HTMLAnchorElement;
  p.link.getExposes().focusSelf({ reason: 'keyboard' });
  await flush();
  expect(key(anchor, ' ').defaultPrevented).toBe(false);
  expect(key(anchor, 'Enter').defaultPrevented).toBe(false);
  expect(p.events).toEqual([]);
  expect(p.root.getExposes().value.get()).toBe('guide');
  expect(click(anchor, { detail: 0 }).defaultPrevented).toBe(false);
  await flush();
  expect(p.events).toHaveLength(1);
  p.trigger.click();
  await flush();
  expect(click(anchor, { ctrlKey: true }).defaultPrevented).toBe(false);
  await flush();
  expect(p.events.at(-1)).toEqual(expect.objectContaining({ modified: true }));
  expect(p.root.getExposes().value.get()).toBe('guide');
  const auxiliary = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 });
  anchor.dispatchEvent(auxiliary);
  await flush();
  expect(auxiliary.defaultPrevented).toBe(false);
  expect(p.events).toHaveLength(3);
  expect(p.root.getExposes().value.get()).toBe('guide');
});
it('keeps blank-target navigation open and replaces href/rel/disabled snapshots', async () => {
  const p = fixture(base, { target: '_blank', rel: 'noreferrer' });
  await flush();
  const anchor = p.link.querySelector('a') as HTMLAnchorElement;
  expect(anchor.target).toBe('_blank');
  expect(anchor.rel).toContain('noreferrer');
  expect(click(anchor).defaultPrevented).toBe(false);
  await flush();
  expect(p.root.getExposes().value.get()).toBe('guide');
  setElementProps(p.link, { href: '#changed', disabled: true });
  await flush();
  expect(anchor.hasAttribute('href')).toBe(false);
  expect(anchor.getAttribute('aria-disabled')).toBe('true');
  expect(anchor.tabIndex).toBe(-1);
  expect(click(anchor).defaultPrevented).toBe(true);
  expect(p.events).toHaveLength(1);
  setElementProps(p.link, { href: '#changed', closeOnSelect: false });
  await flush();
  expect(anchor.getAttribute('href')).toBe('#changed');
  expect(anchor.getAttribute('target')).toBe('_self');
  expect(anchor.getAttribute('rel') ?? '').toBe('');
  expect(click(anchor).defaultPrevented).toBe(false);
  await flush();
  expect(p.events.at(-1)).toEqual({ href: '#changed', target: '_self', rel: '', modified: false });
  expect(p.root.getExposes().value.get()).toBe('guide');
});
it('projects current-page semantics onto the physical anchor and removes stale current', async () => {
  const p = fixture(base, { current: true });
  await flush();
  const anchor = p.link.querySelector('a') as HTMLAnchorElement;
  expect(anchor.getAttribute('aria-current')).toBe('page');
  setElementProps(p.link, { href: '#guide', current: false });
  await flush();
  expect(anchor.hasAttribute('aria-current')).toBe(false);
});
