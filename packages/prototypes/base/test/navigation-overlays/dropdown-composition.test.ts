import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../../src/dropdown';
import * as shadcn from '../../../shadcn/src/dropdown';
import * as brutalist from '../../../brutalist/src/dropdown';
import * as bootstrap from '../../../bootstrap-2-3-2/src/dropdown';
import * as liquid from '../../../liquid-glass/src/dropdown';
const families = [base, shadcn, brutalist, bootstrap, liquid];
type Parts = Pick<
  typeof base,
  | 'dropdownRoot'
  | 'dropdownTrigger'
  | 'dropdownContent'
  | 'dropdownItem'
  | 'dropdownGroup'
  | 'dropdownLabel'
  | 'dropdownSeparator'
  | 'dropdownShortcut'
>;
const owned: HTMLElement[] = [];
const lives = { created: 0, disposed: 0 };
for (const family of families)
  for (const key of [
    'dropdownRoot',
    'dropdownTrigger',
    'dropdownContent',
    'dropdownItem',
    'dropdownGroup',
    'dropdownLabel',
    'dropdownSeparator',
    'dropdownShortcut',
  ] as const) {
    AdaptToWebComponent(family[key], {
      diagnostics: {
        onLifecycleEvent(event) {
          if (event.type === 'instance.created') lives.created++;
          if (event.type === 'instance.dispose.done') lives.disposed++;
        },
      },
    });
  }
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const element of owned.splice(0)) element.remove();
  await expect.poll(() => lives.disposed).toBe(lives.created);
});
function fixture(family: Parts = base) {
  const element = (name: string, props: Record<string, unknown> = {}) => {
    const node = document.createElement(name);
    owned.push(node);
    setElementProps(node, props);
    return node;
  };
  const root = element(family.dropdownRoot.name, { defaultOpen: true });
  const trigger = element(family.dropdownTrigger.name);
  const content = element(family.dropdownContent.name, { enterDuration: 0, leaveDuration: 0 });
  const group = element(family.dropdownGroup.name, { a11yLabel: 'Fallback account' });
  const label = element(family.dropdownLabel.name);
  label.textContent = 'My Account';
  const item = element(family.dropdownItem.name, { value: 'profile', textValue: 'Profile' });
  const disabled = element(family.dropdownItem.name, {
    value: 'api',
    textValue: 'API',
    disabled: true,
  });
  const shortcut = element(family.dropdownShortcut.name);
  shortcut.textContent = '⇧⌘P';
  const separator = element(family.dropdownSeparator.name);
  item.append('Profile', shortcut);
  disabled.textContent = 'API';
  group.append(label, item);
  content.append(group, separator, disabled);
  root.append(trigger, content);
  document.body.append(root);
  return { root, trigger, content, group, label, item, disabled, shortcut, separator };
}
describe.each(families.map((family) => [family.dropdownGroup.name, family] as const))(
  '%s composition',
  (_name, family) => {
    it('associates a live group label without turning passive structure into menu actions', async () => {
      const p = fixture(family);
      await flush();
      expect(p.group.getAttribute('role')).toBe('group');
      expect(p.group.getAttribute('aria-labelledby')).toBe(p.label.id);
      expect(p.label.id).not.toBe('');
      expect(p.separator.getAttribute('role')).toBe('separator');
      expect(p.separator.getAttribute('aria-orientation')).toBe('horizontal');
      for (const part of [p.label, p.shortcut, p.separator, p.group])
        expect(part.hasAttribute('tabindex')).toBe(false);
      const root = p.root as HTMLElement & {
        getExposes(): { getCollectionCount(): number; open: { get(): boolean } };
      };
      expect(root.getExposes().getCollectionCount()).toBe(2);
      const actions: unknown[] = [];
      p.item.addEventListener('select', (event) => actions.push((event as CustomEvent).detail));
      p.shortcut.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'p', metaKey: true, shiftKey: true, bubbles: true })
      );
      p.disabled.click();
      await flush();
      expect(actions).toEqual([]);
      expect(root.getExposes().open.get()).toBe(true);
      p.item.click();
      await flush();
      expect(actions).toEqual([{ value: 'profile', reason: 'pointer' }]);
      expect(root.getExposes().open.get()).toBe(false);
    });
  }
);
it('withdraws stale label relations and mirrors the current item focus into a passive hint', async () => {
  const p = fixture();
  await flush();
  const firstId = p.label.id;
  p.label.remove();
  await flush();
  expect(p.group.hasAttribute('aria-labelledby')).toBe(false);
  expect(p.group.getAttribute('aria-label')).toBe('Fallback account');
  p.group.prepend(p.label);
  await flush();
  expect(p.label.id).toBe(firstId);
  expect(p.group.getAttribute('aria-labelledby')).toBe(firstId);
  p.item.focus();
  await flush();
  const shortcut = p.shortcut as HTMLElement & { getExposes(): { active: { get(): boolean } } };
  expect(shortcut.getExposes().active.get()).toBe(true);
  p.disabled.focus();
  await flush();
  expect(shortcut.getExposes().active.get()).toBe(false);
});

import path from 'node:path';
import { collectProtoStyleTokens } from '../../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../../../../cli/src/services/proto-style-css';
it.each(['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'])(
  'collects and lowers the complete %s composition CSS input',
  async (family) => {
    const collected = await collectProtoStyleTokens(
      path.resolve(process.cwd(), 'packages/prototypes', family, 'src/dropdown')
    );
    const tokens = collected.filter((token): token is string => typeof token === 'string');
    expect(tokens.length).toBe(collected.length);
    expect(tokens).toContain('ml-auto');
    for (const css of [renderProtoStyleTokenCss(tokens), renderProtoShadowStyleTokenCss(tokens)])
      expect(
        css.match(/Unsupported Proto UI style tokens:[\s\S]*?\*\//)?.[0],
        family
      ).toBeUndefined();
  }
);
