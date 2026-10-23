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
const bootstrapFamilyTokens: Record<string, string> = {
  'text-2xl': 'text-[1.53125rem]',
  'leading-normal': 'leading-[1.4285714285714286]',
};
const familyToken = (family: string, token: string) =>
  family === 'bootstrap-2-3-2' ? (bootstrapFamilyTokens[token] ?? token) : token;
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
                expect(tokens).toContain(familyToken(family, token));
                expect(
                  tokens.filter((candidate) =>
                    Object.values(values)
                      .map((value) => familyToken(family, value))
                      .includes(candidate)
                  )
                ).toEqual([familyToken(family, token)]);
              }
            }
          }
          await mounted.update({});
          if (family !== 'base')
            expect((element.getAttribute('data-pui-style') ?? '').split(/\s+/).sort()).toEqual(
              defaults.map((token) => familyToken(family, token)).sort()
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

// T-TEXT-0001-CASE-DENSITY: public props, not an internal rule evaluator or page CSS.
describe.each(runtimes)('real %s Adapter Text density', (runtime) => {
  it.each(Object.entries({ base: baseText, shadcn: shadcnText, brutalist: brutalistText }))(
    '%s transports size/tighter inputs, defaults and prop removal on the same passive subject',
    async (family, proto) => {
      const owner = document.createElement('h1');
      document.body.append(owner);
      const mounted = await mount(runtime, proto, owner);
      const tokens = () =>
        (mounted.element.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
      try {
        await mounted.update({ size: 'not-a-size', leading: 'size' } as unknown as TextRootProps);
        if (family !== 'base') {
          expect(tokens()).toContain('text-base');
          expect(tokens().filter((value) => value.startsWith('leading-'))).toEqual([]);
        }
        for (const [size, token] of Object.entries(options.size)) {
          await mounted.update({
            size: size as TextRootProps['size'],
            leading: 'size',
            tracking: 'tighter',
          });
          expect(owner.firstElementChild).toBe(mounted.element);
          expect(owner.textContent).toBe(TEXT);
          if (family === 'base') expect(tokens()).toEqual([]);
          else {
            expect(tokens()).toContain(token);
            expect(tokens().filter((value) => value.startsWith('leading-'))).toEqual([]);
            expect(tokens().filter((value) => value.startsWith('tracking-'))).toEqual([
              'tracking-tighter',
            ]);
          }
        }
        for (const size of [undefined, 'not-a-size']) {
          await mounted.update({ size, leading: 'size' } as TextRootProps);
          if (family !== 'base') {
            expect(tokens()).toContain('text-5xl');
            expect(tokens().filter((value) => value.startsWith('leading-'))).toEqual([]);
          }
        }
        await mounted.update({ leading: 'size' });
        if (family !== 'base') expect(tokens()).toContain('text-base');
        await mounted.update({ size: '5xl', leading: 'tighter', tracking: 'tighter' });
        if (family !== 'base') {
          expect(tokens()).toContain('text-5xl');
          expect(tokens().filter((value) => value.startsWith('leading-'))).toEqual([
            'leading-[1.1]',
          ]);
          expect(tokens().filter((value) => value.startsWith('tracking-'))).toEqual([
            'tracking-tighter',
          ]);
        }
        await mounted.update({ size: 'lg', leading: 'size' });
        if (family !== 'base') {
          expect(tokens()).toContain('text-lg');
          expect(tokens().filter((value) => value.startsWith('leading-'))).toEqual([]);
          expect(tokens()).toContain('tracking-normal');
        }
        await mounted.update({ size: 'lg', leading: 'normal', tracking: 'normal' });
        if (family !== 'base')
          expect(tokens().filter((value) => value.startsWith('leading-'))).toEqual([
            'leading-normal',
          ]);
        for (const invalid of ['1.1', 'font', 'calc(1 + .1)', 'var(--private-leading)']) {
          await mounted.update({ leading: invalid, tracking: invalid } as TextRootProps);
          expect(tokens().sort()).toEqual(family === 'base' ? [] : [...defaults].sort());
        }
        await mounted.update({});
        expect(tokens().sort()).toEqual(family === 'base' ? [] : [...defaults].sort());
        expect(owner.firstElementChild).toBe(mounted.element);
        expect(owner.textContent).toBe(TEXT);
        expect(mounted.element.getAttribute('role')).toBeNull();
        expect(mounted.element.getAttribute('tabindex')).toBeNull();
        expect(mounted.element.getAttribute('aria-live')).toBeNull();
      } finally {
        mounted.unmount();
        owner.remove();
      }
    }
  );

  it.each(['rhea', 'luma'] as const)(
    'preserves Shadcn %s action leading precedence',
    async (actionProfile) => {
      const owner = document.createElement('button');
      document.body.append(owner);
      const mounted = await mount(runtime, shadcnText, owner);
      try {
        for (const leading of ['size', 'tighter', 'normal'] as const) {
          await mounted.update({ actionProfile, leading } as TextRootProps);
          const tokens = (mounted.element.getAttribute('data-pui-style') ?? '').split(/\s+/);
          expect(tokens.filter((value) => value.startsWith('leading-'))).toEqual(['leading-5']);
          expect(owner.firstElementChild).toBe(mounted.element);
          expect(owner.textContent).toBe(TEXT);
        }
        await mounted.update({ leading: 'tighter' });
        expect((mounted.element.getAttribute('data-pui-style') ?? '').split(/\s+/)).toContain(
          'leading-[1.1]'
        );
        await mounted.update({});
        expect((mounted.element.getAttribute('data-pui-style') ?? '').split(/\s+/).sort()).toEqual(
          [...defaults].sort()
        );
      } finally {
        mounted.unmount();
        owner.remove();
      }
    }
  );
});

// The existing Props fallback distinction stays observable through every public transport.
describe.each(runtimes)('real %s Adapter Text size fallback', (runtime) => {
  describe.each(Object.entries({ shadcn: shadcnText, brutalist: brutalistText }))(
    '%s',
    (_family, proto) => {
      it.each([
        {
          name: 'initial invalid uses base',
          previous: undefined,
          next: { size: 'invalid', leading: 'size' },
          token: 'text-base',
        },
        {
          name: 'missing releases a previously valid size to base',
          previous: 'lg',
          next: { leading: 'size' },
          token: 'text-base',
        },
        {
          name: 'invalid retains the previous valid size',
          previous: 'lg',
          next: { size: 'invalid', leading: 'size' },
          token: 'text-lg',
        },
        {
          name: 'provided undefined retains the previous valid size',
          previous: 'lg',
          next: { size: undefined, leading: 'size' },
          token: 'text-lg',
        },
      ])('$name', async ({ previous, next, token }) => {
        const owner = document.createElement('p');
        document.body.append(owner);
        const mounted = await mount(runtime, proto, owner);
        try {
          if (previous) await mounted.update({ size: previous, leading: 'size' } as TextRootProps);
          await mounted.update(next as TextRootProps);
          const tokens = (mounted.element.getAttribute('data-pui-style') ?? '').split(/\s+/);
          expect(tokens.filter((value) => Object.values(options.size).includes(value))).toEqual([
            token,
          ]);
          expect(tokens.filter((value) => value.startsWith('leading-'))).toEqual([]);
          expect(owner.firstElementChild).toBe(mounted.element);
          expect(owner.textContent).toBe(TEXT);
        } finally {
          mounted.unmount();
          owner.remove();
        }
      });
    }
  );
});
