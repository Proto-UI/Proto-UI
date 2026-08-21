import { describe, expect, it } from 'vitest';
import { radioGroupIndicator, radioGroupItem, radioGroupRoot } from '../../../prototypes/base/src/radio-group';
import type { ProtoAdapterExposes } from '../../base/src';

import { VueAny, flushVue } from './utils/vue';
import { createVueAdapter } from '../src/adapt';

type VueProtoRef<Proto extends typeof radioGroupRoot | typeof radioGroupItem | typeof radioGroupIndicator> = {
  $el: HTMLElement;
  getExposes(): ProtoAdapterExposes<Proto>;
};

type RootRef = VueProtoRef<typeof radioGroupRoot>;
type ItemRef = VueProtoRef<typeof radioGroupItem>;
type IndicatorRef = VueProtoRef<typeof radioGroupIndicator>;

type RadioRefs = {
  root?: RootRef;
  itemA?: ItemRef;
  itemB?: ItemRef;
  itemC?: ItemRef;
  indicatorA?: IndicatorRef;
  indicatorC?: IndicatorRef;
  secondRoot?: RootRef;
  secondItemA?: ItemRef;
  secondItemB?: ItemRef;
  secondItemC?: ItemRef;
};

async function dispatchKey(key: string): Promise<void> {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
  await flushVue();
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
  await flushVue();
}

describe('adapter-vue: base radio group compound protocol', () => {
  it('projects independent radio groups, keyboard selection, controlled updates, disabled state, and indicators', async () => {
    const adapter = createVueAdapter(VueAny);
    const Root = adapter(radioGroupRoot);
    const Item = adapter(radioGroupItem);
    const Indicator = adapter(radioGroupIndicator);
    const refs: RadioRefs = {};
    const state: { controlledValue: string | null; disabled: boolean } = VueAny.reactive({
      controlledValue: null,
      disabled: false,
    });

    const host = document.createElement('div');
    document.body.appendChild(host);

    const app = VueAny.createApp({
      setup() {
        return () => [
          VueAny.h(
            Root,
            state.controlledValue === null
              ? {
                  defaultValue: 'a',
                  a11yLabel: 'Vue delivery methods',
                  disabled: state.disabled,
                  ref: (el: RootRef | null) => {
                    refs.root = el ?? undefined;
                  },
                }
              : {
                  value: state.controlledValue,
                  a11yLabel: 'Vue delivery methods',
                  disabled: state.disabled,
                  ref: (el: RootRef | null) => {
                    refs.root = el ?? undefined;
                  },
                },
            () => [
              VueAny.h(
                Item,
                {
                  value: 'a',
                  ref: (el: ItemRef | null) => {
                    refs.itemA = el ?? undefined;
                  },
                },
                () => [
                  'A',
                  VueAny.h(Indicator, {
                    ref: (el: IndicatorRef | null) => {
                      refs.indicatorA = el ?? undefined;
                    },
                  }),
                ]
              ),
              VueAny.h(
                Item,
                {
                  value: 'b',
                  disabled: true,
                  ref: (el: ItemRef | null) => {
                    refs.itemB = el ?? undefined;
                  },
                },
                () => 'B'
              ),
              VueAny.h(
                Item,
                {
                  value: 'c',
                  ref: (el: ItemRef | null) => {
                    refs.itemC = el ?? undefined;
                  },
                },
                () => [
                  'C',
                  VueAny.h(Indicator, {
                    ref: (el: IndicatorRef | null) => {
                      refs.indicatorC = el ?? undefined;
                    },
                  }),
                ]
              ),
            ]
          ),
          VueAny.h(
            Root,
            { defaultValue: 'x', a11yLabel: 'Vue independent methods', ref: (el: RootRef | null) => {
              refs.secondRoot = el ?? undefined;
            } },
            () => [
              VueAny.h(Item, { value: 'x', ref: (el: ItemRef | null) => {
                refs.secondItemA = el ?? undefined;
              } }, () => 'X'),
              VueAny.h(Item, { value: 'y', disabled: true, ref: (el: ItemRef | null) => {
                refs.secondItemB = el ?? undefined;
              } }, () => 'Y'),
              VueAny.h(Item, { value: 'z', ref: (el: ItemRef | null) => {
                refs.secondItemC = el ?? undefined;
              } }, () => 'Z'),
            ]
          ),
        ];
      },
    });

    app.mount(host);
    await flushVue();
    await flushVue();

    try {
      const root = refs.root;
      const itemA = refs.itemA;
      const itemB = refs.itemB;
      const itemC = refs.itemC;
      const indicatorA = refs.indicatorA;
      const indicatorC = refs.indicatorC;
      const secondRoot = refs.secondRoot;
      const secondItemA = refs.secondItemA;
      const secondItemB = refs.secondItemB;
      const secondItemC = refs.secondItemC;

      expect(root?.$el.getAttribute('role')).toBe('radiogroup');
      expect(root?.$el.getAttribute('aria-label')).toBe('Vue delivery methods');
      expect(root?.$el.getAttribute('aria-disabled')).toBe('false');
      expect(root?.getExposes().disabled.get()).toBe(false);
      expect(itemA?.$el.getAttribute('role')).toBe('radio');
      expect(itemB?.$el.getAttribute('role')).toBe('radio');
      expect(itemC?.$el.getAttribute('role')).toBe('radio');
      expect(itemA?.$el.getAttribute('aria-checked')).toBe('true');
      expect(itemB?.$el.getAttribute('aria-checked')).toBe('false');
      expect(itemC?.$el.getAttribute('aria-checked')).toBe('false');
      expect(itemA?.$el.getAttribute('aria-disabled')).toBe('false');
      expect(itemB?.$el.getAttribute('aria-disabled')).toBe('true');
      expect(itemC?.$el.getAttribute('aria-disabled')).toBe('false');
      expect(itemA?.getExposes().disabled.get()).toBe(false);
      expect(itemB?.getExposes().disabled.get()).toBe(true);
      expect(itemC?.getExposes().disabled.get()).toBe(false);
      expect(itemA?.$el.tabIndex).toBe(0);
      expect(itemB?.$el.tabIndex).toBe(-1);
      expect(itemC?.$el.tabIndex).toBe(-1);
      expect(secondRoot?.$el.getAttribute('role')).toBe('radiogroup');
      expect(secondRoot?.$el.getAttribute('aria-label')).toBe('Vue independent methods');
      expect(secondItemA?.$el.getAttribute('aria-checked')).toBe('true');
      expect(secondItemB?.$el.getAttribute('aria-disabled')).toBe('true');
      expect(secondItemC?.$el.getAttribute('aria-checked')).toBe('false');

      itemC?.getExposes().focusSelf();
      await flushVue();
      await dispatchKey(' ');
      expect(root?.getExposes().value.get()).toBe('c');
      expect(itemA?.$el.getAttribute('aria-checked')).toBe('false');
      expect(itemC?.$el.getAttribute('aria-checked')).toBe('true');

      itemA?.getExposes().focusSelf();
      await flushVue();
      await dispatchKey('Enter');
      expect(root?.getExposes().value.get()).toBe('c');
      expect(itemC?.$el.getAttribute('aria-checked')).toBe('true');

      itemA?.getExposes().focusSelf();
      await flushVue();
      await dispatchKey('ArrowRight');
      expect(document.activeElement).toBe(itemC?.$el);
      expect(root?.getExposes().value.get()).toBe('c');
      await dispatchKey('ArrowDown');
      expect(document.activeElement).toBe(itemA?.$el);
      expect(root?.getExposes().value.get()).toBe('a');
      await dispatchKey('ArrowLeft');
      expect(document.activeElement).toBe(itemC?.$el);
      expect(root?.getExposes().value.get()).toBe('c');
      await dispatchKey('ArrowUp');
      expect(document.activeElement).toBe(itemA?.$el);
      expect(root?.getExposes().value.get()).toBe('a');
      await dispatchKey('End');
      expect(document.activeElement).toBe(itemC?.$el);
      expect(root?.getExposes().value.get()).toBe('c');
      await dispatchKey('Home');
      expect(document.activeElement).toBe(itemA?.$el);
      expect(root?.getExposes().value.get()).toBe('a');

      state.controlledValue = 'c';
      await flushVue();
      await flushVue();
      expect(root?.getExposes().value.get()).toBe('c');
      expect(itemA?.$el.getAttribute('aria-checked')).toBe('false');
      expect(itemC?.$el.getAttribute('aria-checked')).toBe('true');

      state.disabled = true;
      await flushVue();
      await flushVue();
      expect(root?.$el.getAttribute('aria-disabled')).toBe('true');
      expect(root?.getExposes().disabled.get()).toBe(true);
      for (const item of [itemA, itemB, itemC]) {
        expect(item?.$el.getAttribute('aria-disabled')).toBe('true');
        expect(item?.getExposes().disabled.get()).toBe(true);
        expect(item?.$el.tabIndex).toBe(-1);
      }
      secondItemA?.getExposes().focusSelf();
      await flushVue();
      itemA?.getExposes().focusSelf();
      await flushVue();
      expect(document.activeElement).toBe(secondItemA?.$el);
      itemA?.$el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushVue();
      expect(root?.getExposes().value.get()).toBe('c');
      expect(itemC?.$el.getAttribute('aria-checked')).toBe('true');
 
      secondItemC?.getExposes().focusSelf();
      await flushVue();
      await dispatchKey(' ');
      expect(secondRoot?.getExposes().value.get()).toBe('z');
      expect(secondItemA?.$el.getAttribute('aria-checked')).toBe('false');
      expect(secondItemB?.$el.getAttribute('aria-checked')).toBe('false');
      expect(secondItemC?.$el.getAttribute('aria-checked')).toBe('true');
      expect(root?.getExposes().value.get()).toBe('c');

      for (const indicator of [indicatorA, indicatorC]) {
        expect(indicator?.$el.getAttribute('role')).toBeNull();
        expect(indicator?.$el.getAttribute('tabindex')).toBeNull();
        expect(indicator?.$el.getAttribute('aria-controls')).toBeNull();
        expect(indicator?.$el.getAttribute('aria-checked')).toBeNull();
        expect(indicator?.$el.getAttribute('aria-disabled')).toBeNull();
        expect(
          [...(indicator?.$el.attributes ?? [])].filter((attribute) =>
            attribute.name.startsWith('aria-')
          )
        ).toHaveLength(0);
        expect(indicator?.$el.getAttribute('data-pui-a11y-actions')).toBeNull();
        expect(indicator?.$el.querySelector('[role="radio"]')).toBeNull();
        expect(indicator?.$el.querySelector('input')).toBeNull();
      }
    } finally {
      app.unmount();
      host.remove();
    }
  });
});
