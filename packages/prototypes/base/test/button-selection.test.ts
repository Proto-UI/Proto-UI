import { afterEach, describe, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import button, { asButton } from '../src/button';
import shadcn from '../../shadcn/src/button';
import brutalist from '../../brutalist/src/button';
import liquidGlass from '../../liquid-glass/src/button';
import bootstrap from '../../bootstrap-2-3-2/src/button';

const hook = definePrototype({
  name: 'test-button-selection-hook',
  setup() {
    asButton();
  },
});
const selectable = definePrototype({
  name: 'test-button-selection-restored',
  setup(def) {
    asButton();
    def.feedback.style.use(tw('select-text'));
  },
});
const entries = [button, hook, shadcn, brutalist, liquidGlass, bootstrap, selectable];
for (const entry of entries) if (!customElements.get(entry.name)) AdaptToWebComponent(entry);
const owned: HTMLElement[] = [];
const settle = async () => {
  for (let n = 0; n < 20; n++) await Promise.resolve();
};
afterEach(async () => {
  owned.splice(0).forEach((node) => node.remove());
  await settle();
});
const selection = (node: HTMLElement) =>
  (node.getAttribute('data-pui-style') ?? '')
    .split(/\s+/)
    .filter((token) => /^select-(none|auto|text)$/.test(token));

describe('Base Button subject-local selection affordance', () => {
  for (const entry of entries.filter((entry) => entry !== selectable)) {
    it(`${entry.name} inherits one no-accidental-selection policy, including disabled`, async () => {
      const node = document.createElement(entry.name);
      owned.push(node);
      node.textContent = 'Run command';
      document.body.append(node);
      await settle();
      for (const disabled of [false, true, false]) {
        setElementProps(node, { disabled });
        await settle();
        expect(selection(node)).toEqual(['select-none']);
        expect(node.textContent).toBe('Run command');
        expect(node.getAttribute('role')).toBe('button');
      }
      expect(document.body.getAttribute('data-pui-style')).toBeNull();
    });
  }
  it('allows an explicit later subject-level select-text restoration without a second state machine', async () => {
    const node = document.createElement(selectable.name);
    owned.push(node);
    node.textContent = 'Explicitly copyable command';
    document.body.append(node);
    await settle();
    expect(selection(node)).toEqual(['select-text']);
    expect(node.getAttribute('role')).toBe('button');
  });
});
