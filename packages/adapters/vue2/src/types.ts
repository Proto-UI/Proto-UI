import type { AsHookCaller, ExposeEvent, ExposeOf, Prototype } from '@proto.ui/core';
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import type { PropsBaseType } from '@proto.ui/types';

type ProtoLike = Prototype<any, any> | AsHookCaller<any, any, any>;

type PropsOf<T> =
  T extends Prototype<infer P, any> ? P : T extends AsHookCaller<infer P, any, any> ? P : never;

type Voidish = void | undefined;

type Vue2EventHandler<Payload> = [Payload] extends [Voidish]
  ? () => void
  : (payload: Payload, options?: Record<string, unknown>) => void;

type ProtoEventProps<TExposes> = {
  [K in keyof TExposes & string as TExposes[K] extends ExposeEvent<any>
    ? `on${Capitalize<K>}`
    : never]?: TExposes[K] extends ExposeEvent<infer Payload> ? Vue2EventHandler<Payload> : never;
};

export type Vue2HostClass = string | string[] | Record<string, boolean>;

export type Vue2HostStyle = Record<string, string> | string | Array<Record<string, string>>;

export type ProtoVue2EventProps<TProto extends ProtoLike> = ProtoEventProps<ExposeOf<TProto>>;

export type ProtoVue2Props<TProto extends ProtoLike> = (PropsOf<TProto> extends PropsBaseType
  ? PropsOf<TProto>
  : never) & {
  class?: Vue2HostClass;
  hostClass?: Vue2HostClass;
  surfaceClass?: Vue2HostClass;
  hostStyle?: Vue2HostStyle;
  surfaceStyle?: Vue2HostStyle;
} & ProtoVue2EventProps<TProto>;

export type Vue2AdapterHandle<
  TProto extends Prototype<any, any> = Prototype<any, Record<string, unknown>>,
> = {
  update(): void;
  getExposes(): ProtoAdapterExposes<TProto>;
  invokeInCallbackScope?(fn: () => void): void;
};

export type Vue2CreateElement = (type: any, props?: any, children?: any) => any;

export type Vue2Runtime = {
  h?: Vue2CreateElement;
  extend?: (options: Vue2ComponentOptions<any>) => ProtoVue2Component<any>;
  nextTick: (fn?: () => void) => Promise<void> | void;
  set?: (target: object, key: string, value: unknown) => void;
  delete?: (target: object, key: string) => void;
};

export type Vue2ComponentOptions<TProto extends Prototype<any, any>> = {
  name?: string;
  inheritAttrs?: boolean;
  props?: Record<string, unknown>;
  inject?: Record<string, unknown>;
  beforeCreate?: (this: Vue2AdapterInstance<TProto>) => void;
  data?: (this: Vue2AdapterInstance<TProto>) => Record<string, unknown>;
  provide?: (this: Vue2AdapterInstance<TProto>) => Record<PropertyKey, unknown>;
  created?: (this: Vue2AdapterInstance<TProto>) => void;
  methods?: Record<string, (this: Vue2AdapterInstance<TProto>, ...args: any[]) => any>;
  watch?: Record<string, unknown>;
  render?: (this: Vue2AdapterInstance<TProto>, h: Vue2CreateElement) => any;
  mounted?: (this: Vue2AdapterInstance<TProto>) => void;
  updated?: (this: Vue2AdapterInstance<TProto>) => void;
  activated?: (this: Vue2AdapterInstance<TProto>) => void;
  deactivated?: (this: Vue2AdapterInstance<TProto>) => void;
  beforeDestroy?: (this: Vue2AdapterInstance<TProto>) => void;
  destroyed?: (this: Vue2AdapterInstance<TProto>) => void;
  [key: string]: unknown;
};

export type Vue2AdapterInstance<TProto extends Prototype<any, any>> = Vue2AdapterHandle<TProto> & {
  $attrs?: Record<string, unknown>;
  $slots?: Record<string, unknown>;
  $props: ProtoVue2Props<TProto>;
  $el?: Element;
  $forceUpdate?: () => void;
  $watch?: (
    source: string | (() => unknown),
    cb: (...args: any[]) => void,
    options?: Record<string, unknown>
  ) => () => void;
  $nextTick?: (fn?: () => void) => Promise<void> | void;
};

export type ProtoVue2Component<TProto extends Prototype<any, any>> =
  Vue2ComponentOptions<TProto> & {
    new (): Vue2AdapterInstance<TProto>;
  };
