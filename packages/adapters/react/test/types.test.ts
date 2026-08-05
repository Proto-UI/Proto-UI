import { describe, expectTypeOf, it } from 'vitest';
import { definePrototype, type ExposeEvent, type ExposeState } from '@proto.ui/core';
import type { ExposeStateExternalHandle } from '@proto.ui/module-expose-state';
import type { ComponentProps, ComponentRef } from 'react';

import { createReactAdapter } from '../src/adapt';
import type { ProtoReactEventProps, ProtoReactProps } from '../src/types';
import { createFakeReactRuntime } from './utils/fake-react';

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
  name: 'react-type-demo',
  setup() {
    return (r) => [r.el('div', 'ok')];
  },
});

const Component = createReactAdapter(createFakeReactRuntime().runtime)(proto);

describe('adapter-react: type helpers', () => {
  it('maps exposed events to onX handler props', () => {
    expectTypeOf<ProtoReactEventProps<typeof proto>>().toEqualTypeOf<{
      onClick?: () => void;
      onCheckedChange?: (payload: { checked: boolean }) => void;
    }>();
  });

  it('combines proto props with host props and event props', () => {
    expectTypeOf<ProtoReactProps<typeof proto>>().toEqualTypeOf<{
      label?: string;
      disabled?: boolean;
      children?: any;
      className?: string;
      hostClassName?: string;
      surfaceClassName?: string;
      style?: any;
      hostStyle?: any;
      surfaceStyle?: any;
      onClick?: () => void;
      onCheckedChange?: (payload: { checked: boolean }) => void;
    }>({} as any);
  });

  it('preserves the Prototype types on the adapted component', () => {
    type AdaptedProps = ComponentProps<typeof Component>;
    type ComponentHandle = ComponentRef<typeof Component>;

    expectTypeOf(Component).not.toBeAny();
    expectTypeOf<
      Pick<AdaptedProps, 'label' | 'disabled' | 'onClick' | 'onCheckedChange'>
    >().toEqualTypeOf<{
      label?: string;
      disabled?: boolean;
      onClick?: () => void;
      onCheckedChange?: (payload: { checked: boolean }) => void;
    }>();
    expectTypeOf<ReturnType<ComponentHandle['getExposes']>>().toEqualTypeOf<{
      checked: ExposeStateExternalHandle<boolean>;
    }>();

    const valid: AdaptedProps = { label: 'Save', onClick: () => undefined };
    // @ts-expect-error Unknown props must not be accepted through an `any` component boundary.
    const invalid: AdaptedProps = { unknownProtoProp: true };
    void valid;
    void invalid;
  });
});
