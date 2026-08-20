import type { AsHookCaller, ExposeEvent, ExposeOf, Prototype } from '@proto.ui/core';
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import type { PropsBaseType } from '@proto.ui/types';
import type { ForwardRefExoticComponent, PropsWithoutRef, RefAttributes } from 'react';

type ProtoLike = Prototype<any, any> | AsHookCaller<any, any, any>;

type PropsOf<T> =
  T extends Prototype<infer P, any> ? P : T extends AsHookCaller<infer P, any, any> ? P : never;

type Voidish = void | undefined;

type ReactEventHandler<Payload> = [Payload] extends [Voidish]
  ? () => void
  : (payload: Payload) => void;

type ProtoEventProps<TExposes> = {
  [K in keyof TExposes & string as TExposes[K] extends ExposeEvent<any>
    ? `on${Capitalize<K>}`
    : never]?: TExposes[K] extends ExposeEvent<infer Payload> ? ReactEventHandler<Payload> : never;
};

export type ProtoReactEventProps<TProto extends ProtoLike> = ProtoEventProps<ExposeOf<TProto>>;

export type ProtoReactProps<TProto extends ProtoLike> = (PropsOf<TProto> extends PropsBaseType
  ? PropsOf<TProto>
  : never) & {
  children?: any;
  className?: string;
  hostClassName?: string;
  surfaceClassName?: string;
  style?: any;
  hostStyle?: any;
  surfaceStyle?: any;
} & ProtoReactEventProps<TProto>;

export type ReactAdapterHandle<
  TProto extends Prototype<any, any> = Prototype<any, Record<string, unknown>>,
> = {
  update(): void;
  getExposes(): ProtoAdapterExposes<TProto>;
  invokeInCallbackScope?(fn: () => void): void;
};

export type ProtoReactComponent<TProto extends Prototype<any, any>> = ForwardRefExoticComponent<
  PropsWithoutRef<ProtoReactProps<TProto>> & RefAttributes<ReactAdapterHandle<TProto>>
>;
