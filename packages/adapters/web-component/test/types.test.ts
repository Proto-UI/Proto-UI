import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  definePrototype,
  type ExposeEvent,
  type ExposeMethod,
  type ExposeState,
} from '@proto.ui/core';
import type { ExposeStateExternalHandle } from '@proto.ui/module-expose-state';

import * as WebComponentAdapterPublic from '../src/index';
import { AdaptToWebComponent, type WebComponentAdapterOptions } from '../src/adapt';
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
    expectTypeOf<WebComponentAdapterOptions['shadow']>().toEqualTypeOf<
      boolean | WebComponentAdapterPublic.WebComponentShadowSplitOptions | undefined
    >();
    const artifact: WebComponentAdapterPublic.ShadowStyleArtifactV1 = {
      kind: 'proto-ui.shadow-style',
      version: 1,
      environment: 'host-color-scheme-v1',
      cssText: '',
    };
    const source: WebComponentAdapterPublic.ShadowColorSchemeSource = {
      get: () => 'light',
      subscribe: () => () => {},
    };
    const profile: WebComponentAdapterOptions['shadow'] = {
      mode: 'open',
      presentation: 'split',
      styleArtifact: artifact,
      colorSchemeSource: source,
    };
    // @ts-expect-error Split never accepts an incomplete object.
    const incomplete: WebComponentAdapterOptions['shadow'] = {
      mode: 'open',
      presentation: 'split',
    };
    void profile;
    void incomplete;
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

  it('keeps B1 and C1 owner foundations outside the package-root export surface', () => {
    expect(WebComponentAdapterPublic).not.toHaveProperty('createShadowColorSchemeEnvironmentOwner');
    expect(WebComponentAdapterPublic).not.toHaveProperty('createShadowStyleArtifactOwner');
    expect(WebComponentAdapterPublic).not.toHaveProperty('validateShadowStyleArtifact');
    expect(WebComponentAdapterPublic).not.toHaveProperty('createShadowSplitMetaGetter');
    expect(WebComponentAdapterPublic).not.toHaveProperty('createShadowSplitResources');
  });
});
