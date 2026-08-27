import { describe, expectTypeOf, it } from 'vitest';
import {
  definePrototype,
  type ExposeEvent,
  type ExposeMethod,
  type ExposeState,
  type ExposeValue,
} from '@proto.ui/core';
import type { ExposeStateExternalHandle } from '@proto.ui/module-expose-state';

import { createVue2Adapter } from '../src/adapt';
import type { ProtoVue2EventProps, ProtoVue2Props, Vue2Runtime } from '../src/types';

type DemoProps = {
  label?: string;
  disabled?: boolean;
};

type DemoExposes = {
  checked: ExposeState<boolean>;
  click: ExposeEvent<void>;
  checkedChange: ExposeEvent<{ checked: boolean }>;
  focusSelf: ExposeMethod<(options?: { preventScroll?: boolean }) => void>;
  version: ExposeValue<number>;
};

const proto = definePrototype<DemoProps, DemoExposes>({
  name: 'vue2-type-demo',
  setup() {
    return (r) => [r.el('div', 'ok')];
  },
});

const runtime: Vue2Runtime = {
  extend(options) {
    return options as any;
  },
  nextTick(fn) {
    fn?.();
  },
};

const Component = createVue2Adapter(runtime)(proto);

describe('adapter-vue2: type helpers', () => {
  it('maps exposed events to Vue 2 listener props without exposing event markers as values', () => {
    expectTypeOf<ProtoVue2EventProps<typeof proto>>().toEqualTypeOf<{
      onClick?: () => void;
      onCheckedChange?: (payload: { checked: boolean }, options?: Record<string, unknown>) => void;
    }>();
  });

  it('combines proto props with only the explicitly supported Vue 2 host props', () => {
    expectTypeOf<ProtoVue2Props<typeof proto>>().toEqualTypeOf<{
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

  it('preserves the Prototype types on the adapted Vue 2 component instance', () => {
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
      focusSelf: (options?: { preventScroll?: boolean }) => void;
      version: number;
    }>();

    const valid: ComponentProps = { label: 'Save', onClick: () => undefined };
    // @ts-expect-error Unknown props must not be accepted through an `any` component boundary.
    const invalidUnknown: ComponentProps = { unknownProtoProp: true };
    // @ts-expect-error Host-native attrs are not claimed as supported Vue 2 adapter props.
    const invalidNative: ComponentProps = { id: 'native-id' };
    void valid;
    void invalidUnknown;
    void invalidNative;
  });
});
