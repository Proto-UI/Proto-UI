import { describe, expectTypeOf, it } from 'vitest';
import {
  definePrototype,
  type ExposeEvent,
  type ExposeMethod,
  type ExposeState,
} from '@proto.ui/core';
import type { ExposeStateExternalHandle } from '@proto.ui/module-expose-state';

import { AdaptToWebComponent } from '../src/adapt';
import type { ProtoWebComponentProps } from '../src/types';

type DemoProps = {
  label?: string;
  disabled?: boolean;
};

type DemoExposes = {
  checked: ExposeState<boolean>;
  focusSelf: ExposeMethod<() => void>;
  checkedChange: ExposeEvent<{ checked: boolean }>;
};

const proto = definePrototype<DemoProps, DemoExposes>({
  name: 'web-component-type-demo',
  setup() {
    return (renderer) => [renderer.el('div', 'ok')];
  },
});

const ElementConstructor = AdaptToWebComponent(proto, { register: false });

describe('adapter-web-component: public type projection', () => {
  it('preserves props utilities and typed exposes on the element constructor', () => {
    type Element = InstanceType<typeof ElementConstructor>;

    expectTypeOf(ElementConstructor).not.toBeAny();
    expectTypeOf<ProtoWebComponentProps<typeof proto>>().toEqualTypeOf<{
      label?: string;
      disabled?: boolean;
      class?: string | string[] | Record<string, boolean>;
      className?: string | string[] | Record<string, boolean>;
      surfaceClass?: string | string[] | Record<string, boolean>;
      surfaceClassName?: string | string[] | Record<string, boolean>;
      surfaceStyle?:
        | string
        | Record<string, string | number | null | undefined>
        | Array<Record<string, string | number | null | undefined>>;
    }>({} as any);
    expectTypeOf<ReturnType<Element['getExposes']>>().toEqualTypeOf<{
      checked: ExposeStateExternalHandle<boolean>;
      focusSelf: () => void;
    }>();

    const valid: ProtoWebComponentProps<typeof proto> = { label: 'Save' };
    // @ts-expect-error Unknown props must not be accepted through an `any` boundary.
    const invalid: ProtoWebComponentProps<typeof proto> = { unknownProtoProp: true };
    void valid;
    void invalid;
  });
});
