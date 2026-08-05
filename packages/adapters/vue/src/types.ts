import type { AsHookCaller, ExposeEvent, ExposeOf, Prototype } from '@proto.ui/core';
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import type { PropsBaseType } from '@proto.ui/types';
import type { DefineComponent } from 'vue';

type ProtoLike = Prototype<any, any> | AsHookCaller<any, any, any>;

type PropsOf<T> =
  T extends Prototype<infer P, any> ? P : T extends AsHookCaller<infer P, any, any> ? P : never;

type Voidish = void | undefined;

type VueEventHandler<Payload> = [Payload] extends [Voidish]
  ? () => void
  : (payload: Payload, options?: Record<string, unknown>) => void;

type ProtoEventProps<TExposes> = {
  [K in keyof TExposes & string as TExposes[K] extends ExposeEvent<any>
    ? `on${Capitalize<K>}`
    : never]?: TExposes[K] extends ExposeEvent<infer Payload> ? VueEventHandler<Payload> : never;
};

type EmitEntry<K extends string, Payload> = [Payload] extends [Voidish]
  ? { [P in K]: [] }
  : { [P in K]: [payload: Payload, options?: Record<string, unknown>] };

type UnionToIntersection<U> = (U extends any ? (arg: U) => void : never) extends (
  arg: infer I
) => void
  ? I
  : never;

type ProtoEmitTuples<TExposes> = UnionToIntersection<
  {
    [K in keyof TExposes & string]: TExposes[K] extends ExposeEvent<infer Payload>
      ? EmitEntry<K, Payload>
      : never;
  }[keyof TExposes & string]
>;

export type ProtoVueEventProps<TProto extends ProtoLike> = ProtoEventProps<ExposeOf<TProto>>;

export type ProtoVueProps<TProto extends ProtoLike> = (PropsOf<TProto> extends PropsBaseType
  ? PropsOf<TProto>
  : never) & {
  class?: string | string[] | Record<string, boolean>;
  hostClass?: string | string[] | Record<string, boolean>;
  surfaceClass?: string | string[] | Record<string, boolean>;
  hostStyle?: Record<string, string> | string | Array<Record<string, string>>;
  surfaceStyle?: Record<string, string> | string | Array<Record<string, string>>;
} & ProtoVueEventProps<TProto>;

export type ProtoVueEmits<TProto extends ProtoLike> = ProtoEmitTuples<ExposeOf<TProto>>;

export type VueAdapterHandle<
  TProto extends Prototype<any, any> = Prototype<any, Record<string, unknown>>,
> = {
  update(): void;
  getExposes(): ProtoAdapterExposes<TProto>;
  invokeInCallbackScope?(fn: () => void): void;
};

export type ProtoVueComponent<TProto extends Prototype<any, any>> = DefineComponent<
  ProtoVueProps<TProto>
> & {
  new (): VueAdapterHandle<TProto> & {
    $props: ProtoVueProps<TProto>;
  };
};
