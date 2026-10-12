import { afterEach, expect, expectTypeOf, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  dropdownRoot,
  dropdownContent,
  dropdownGroup,
  dropdownLabel,
  dropdownItem,
} from '../src/dropdown';
import type { ShadcnDropdownLabelProps } from '../src/dropdown';
import type { ShadcnDropdownLabelProps as PublicLabelProps } from '../src';
import { styleContains } from '../../test-utils/style';

for (const prototype of [dropdownRoot, dropdownContent, dropdownGroup, dropdownLabel, dropdownItem])
  AdaptToWebComponent(prototype as any);
const owned: HTMLElement[] = [];
const flush = async () => {
  for (let index = 0; index < 15; index++) await Promise.resolve();
};
afterEach(async () => {
  for (const node of owned.splice(0)) node.remove();
  await flush();
});
it('exports a family-only optional inset prop', () => {
  expectTypeOf<ShadcnDropdownLabelProps['inset']>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<PublicLabelProps>().toEqualTypeOf<ShadcnDropdownLabelProps>();
});
it('projects inset dynamically while preserving the live group label relationship and passive collection scope', async () => {
  const make = (name: string, props: Record<string, unknown> = {}) => {
    const node = document.createElement(name) as HTMLElement & {
      getExposes(): Record<string, any>;
    };
    owned.push(node);
    setElementProps(node, props);
    return node;
  };
  const root = make(dropdownRoot.name, { defaultOpen: true });
  const content = make(dropdownContent.name, { enterDuration: 0, leaveDuration: 0 });
  const group = make(dropdownGroup.name, { a11yLabel: 'Fallback actions' });
  const label = make(dropdownLabel.name);
  const item = make(dropdownItem.name, { value: 'paste', textValue: 'Paste', inset: true });
  label.textContent = 'Actions';
  item.textContent = 'Paste';
  group.append(label, item);
  content.append(group);
  root.append(content);
  document.body.append(root);
  await flush();
  const id = label.id;
  expect(id).not.toBe('');
  expect(styleContains(label, 'pl-7')).toBe(false);
  for (const inset of [true, false, true]) {
    setElementProps(label, { inset });
    await flush();
    expect(styleContains(label, 'pl-7')).toBe(inset);
    expect(group.getAttribute('aria-labelledby')).toBe(id);
    expect(label.hasAttribute('tabindex')).toBe(false);
    expect(root.getExposes().getCollectionCount()).toBe(1);
  }
  label.remove();
  await flush();
  expect(group.hasAttribute('aria-labelledby')).toBe(false);
  expect(group.getAttribute('aria-label')).toBe('Fallback actions');
  group.prepend(label);
  await flush();
  expect(label.id).toBe(id);
  expect(group.getAttribute('aria-labelledby')).toBe(id);
  expect(styleContains(label, 'pl-7')).toBe(true);
  expect(root.getExposes().getCollectionCount()).toBe(1);
});
