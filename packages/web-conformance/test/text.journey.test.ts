import * as React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import { describe, expect, it } from 'vitest';
import { createReactAdapter } from '../../adapters/react/src';
import { createVueAdapter } from '../../adapters/vue/src';
import { createVue2Adapter } from '../../adapters/vue2/src';
import { Vue2Any, Vue2RuntimeAny } from '../../adapters/vue2/test/utils/vue2';
import { AdaptToWebComponent, setElementProps } from '../../adapters/web-component/src';
import baseText from '../../prototypes/base/src/text';
import shadcnText from '../../prototypes/shadcn/src/text';
import brutalistText from '../../prototypes/brutalist/src/text';
import bootstrapText from '../../prototypes/bootstrap-2-3-2/src/text';
import liquidText from '../../prototypes/liquid-glass/src/text';
import type { TextRootProps } from '../../prototypes/base/src/text';
import type { Prototype } from '../../core/src';

const TEXT = 'Preserved 文本, emphasis & link';
const families = {
  base: baseText,
  shadcn: shadcnText,
  brutalist: brutalistText,
  'bootstrap-2-3-2': bootstrapText,
  'liquid-glass': liquidText,
};
const wcClasses = new Map(
  Object.values(families).map((proto) => [proto, AdaptToWebComponent(proto)])
);
const runtimes = ['wc', 'react', 'vue', 'vue2'] as const;
async function settle() {
  await Promise.resolve();
  await Vue.nextTick();
  await Vue2Any.nextTick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function mount(
  runtime: (typeof runtimes)[number],
  proto: Prototype<TextRootProps, {}>,
  owner: HTMLElement
) {
  let update: (props: TextRootProps) => void;
  let unmount: () => void;
  if (runtime === 'wc') {
    const Constructor = wcClasses.get(proto)!;
    const element = new Constructor();
    element.textContent = TEXT;
    owner.append(element);
    update = (props) => {
      setElementProps(element, props);
      element.update();
    };
    unmount = () => element.remove();
  } else if (runtime === 'react') {
    const Text = createReactAdapter(React)(proto, { rootTag: 'span' });
    const root = createRoot(owner);
    update = (props) => flushSync(() => root.render(React.createElement(Text, props, TEXT)));
    unmount = () => flushSync(() => root.unmount());
  } else if (runtime === 'vue') {
    const Text = createVueAdapter(Vue)(proto, { rootTag: 'span' });
    const props = Vue.shallowRef<TextRootProps>({});
    const app = Vue.createApp({ render: () => Vue.h(Text, props.value, { default: () => TEXT }) });
    app.mount(owner);
    update = (next) => {
      props.value = next;
    };
    unmount = () => app.unmount();
  } else {
    const Text = createVue2Adapter(Vue2RuntimeAny)(proto, { rootTag: 'span' });
    const vm = new Vue2Any({
      data: () => ({ textProps: {} }),
      render(this: { textProps: TextRootProps }, h: any) {
        return h(Text, { attrs: this.textProps }, [TEXT]);
      },
    }).$mount();
    owner.append(vm.$el);
    update = (next) => {
      vm.textProps = next;
    };
    unmount = () => {
      vm.$destroy();
      vm.$el.remove();
    };
  }
  update({});
  await settle();
  const element = owner.firstElementChild as HTMLElement;
  return {
    element,
    update: async (props: TextRootProps) => {
      update(props);
      await settle();
    },
    unmount,
  };
}

const options = {
  size: {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
    '4xl': 'text-4xl',
    '5xl': 'text-5xl',
  },
  tone: { default: 'text-foreground', muted: 'text-muted-foreground', inherit: 'text-inherit' },
  weight: {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  },
  font: { body: 'font-sans', heading: 'font-heading', mono: 'font-mono' },
  leading: {
    tight: 'leading-tight',
    snug: 'leading-snug',
    normal: 'leading-normal',
    relaxed: 'leading-relaxed',
  },
  tracking: { normal: 'tracking-normal', tight: 'tracking-tight' },
  emphasis: { normal: 'not-italic', italic: 'italic' },
  decoration: { none: 'no-underline', underline: 'underline', 'line-through': 'line-through' },
};
const defaults = [
  'text-base',
  'text-foreground',
  'font-normal',
  'font-sans',
  'leading-normal',
  'tracking-normal',
  'not-italic',
  'no-underline',
];

describe.each(runtimes)('real %s Adapter Text', (runtime) => {
  describe.each(Object.entries(families))('%s projection', (family, proto) => {
    // T-TEXT-0001-CASE-CONTENT, T-TEXT-0001-CASE-PASSIVE, T-TEXT-0001-CASE-PROJECTION
    it.each(['h1', 'p', 'label', 'a', 'button'])(
      'preserves native %s ownership and updates one canonical presentation subject',
      async (tag) => {
        const owner = document.createElement(tag);
        if (tag === 'label') owner.setAttribute('for', 'text-owned-input');
        if (tag === 'a') owner.setAttribute('href', '/native-destination');
        document.body.append(owner);
        const mounted = await mount(runtime, proto, owner);
        const element = mounted.element;
        try {
          expect(element).toBeTruthy();
          expect(owner.textContent).toBe(TEXT);
          expect(element.querySelector('[data-pui-root]')).toBeNull();
          expect(element.getAttribute('role')).toBeNull();
          expect(element.getAttribute('tabindex')).toBeNull();
          expect(element.getAttribute('aria-live')).toBeNull();
          expect(element.getAttribute('data-pui-style') ?? '').not.toMatch(
            /select-(none|text|all|auto)/
          );
          if (tag === 'button') {
            owner.style.userSelect = 'none';
            expect(element.style.userSelect).toBe('');
          }
          if (tag === 'label') expect(owner.getAttribute('for')).toBe('text-owned-input');
          if (tag === 'a') expect(owner.getAttribute('href')).toBe('/native-destination');
          for (const [prop, values] of Object.entries(options)) {
            for (const [value, token] of Object.entries(values)) {
              await mounted.update({ [prop]: value });
              expect(owner.firstElementChild).toBe(element);
              expect(owner.textContent).toBe(TEXT);
              const tokens = (element.getAttribute('data-pui-style') ?? '').split(/\s+/);
              if (family === 'base') expect(tokens.filter(Boolean)).toEqual([]);
              else {
                expect(tokens).toContain(token);
                expect(
                  tokens.filter((candidate) => Object.values(values).includes(candidate))
                ).toEqual([token]);
              }
            }
          }
          await mounted.update({});
          if (family !== 'base')
            expect((element.getAttribute('data-pui-style') ?? '').split(/\s+/).sort()).toEqual(
              [...defaults].sort()
            );
          expect(owner.textContent).toBe(TEXT);
        } finally {
          mounted.unmount();
          owner.remove();
        }
      }
    );
  });
});
