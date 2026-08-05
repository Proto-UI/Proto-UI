import { describe, expectTypeOf, it } from 'vitest';
import { definePrototype, type ExposeEvent, type ExposeState } from '@proto.ui/core';
import type { ExposeStateExternalHandle } from '@proto.ui/module-expose-state';
import * as Vue from 'vue';

import { createVueAdapter } from '../src/adapt';
import type { ProtoVueEmits, ProtoVueEventProps, ProtoVueProps } from '../src/types';

type DemoProps = {
  label?: string;
  disabled?: boolean;
};

type DemoExposes = {
  checked: ExposeState<boolean>;
  click: ExposeEvent<void>;
  checkedChange: ExposeEvent<{ checked: boolean }>;
};

const proto = definePrototype<DemoProps, DemoExposes>({
  name: 'vue-type-demo',
  setup() {
    return (r) => [r.el('div', 'ok')];
  },
});

const Component = createVueAdapter(Vue)(proto);

describe('adapter-vue: type helpers', () => {
  it('maps exposed events to onX listener props', () => {
    expectTypeOf<ProtoVueEventProps<typeof proto>>().toEqualTypeOf<{
      onClick?: () => void;
      onCheckedChange?: (payload: { checked: boolean }, options?: Record<string, unknown>) => void;
    }>();
  });

  it('combines proto props with host props and listener props', () => {
    expectTypeOf<ProtoVueProps<typeof proto>>().toEqualTypeOf<{
      label?: string;
      disabled?: boolean;
      class?: string | string[] | Record<string, boolean>;
      hostClass?: string | string[] | Record<string, boolean>;
      surfaceClass?: string | string[] | Record<string, boolean>;
      hostStyle?: Record<string, string> | string | Array<Record<string, string>>;
      surfaceStyle?: Record<string, string> | string | Array<Record<string, string>>;
      onClick?: () => void;
      onCheckedChange?: (payload: { checked: boolean }, options?: Record<string, unknown>) => void;
    }>({} as any);
  });

  it('derives Vue emits tuples from exposed events', () => {
    expectTypeOf<ProtoVueEmits<typeof proto>>().toEqualTypeOf<{
      click: [];
      checkedChange: [payload: { checked: boolean }, options?: Record<string, unknown>];
    }>({} as any);
  });

  it('preserves the Prototype types on the adapted component', () => {
    type ComponentInstance = InstanceType<typeof Component>;
    type ComponentProps = ComponentInstance['$props'];

    expectTypeOf(Component).not.toBeAny();
    expectTypeOf<
      Pick<ComponentProps, 'label' | 'disabled' | 'onClick' | 'onCheckedChange'>
    >().toEqualTypeOf<{
      label?: string;
      disabled?: boolean;
      onClick?: () => void;
      onCheckedChange?: (payload: { checked: boolean }, options?: Record<string, unknown>) => void;
    }>();
    expectTypeOf<ReturnType<ComponentInstance['getExposes']>>().toEqualTypeOf<{
      checked: ExposeStateExternalHandle<boolean>;
    }>();

    const valid: ComponentProps = { label: 'Save', onClick: () => undefined };
    // @ts-expect-error Unknown props must not be accepted through an `any` component boundary.
    const invalid: ComponentProps = { unknownProtoProp: true };
    void valid;
    void invalid;
  });
});
