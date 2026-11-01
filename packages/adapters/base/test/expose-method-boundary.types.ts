// Compile-only declaration/instance boundaries; never executed.
import type { DefHandle, ExposeEvent, ExposeMethod, Prototype } from '@proto.ui/core';
import type { ProtoAdapterExposes } from '../src/public-types';
import type { ReactAdapterHandle } from '../../react/src/types';
import type { VueAdapterHandle } from '../../vue/src/types';
import type { Vue2AdapterHandle } from '../../vue2/src/types';
import type { WebComponentAdapterHandle } from '../../web-component/src/types';

type Convert = (value: number, options?: { label: string }) => string;
type Declaration = {
  convert: ExposeMethod<Convert>;
  changed: ExposeEvent<number>;
};
type Demo = Prototype<Record<string, never>, Declaration>;
type Assert<T extends true> = T;
type Exact<T, U> =
  (<V>() => V extends T ? 1 : 2) extends <V>() => V extends U ? 1 : 2 ? true : false;

// Each real Web adapter alias reaches the same precise projection, not the marker.
type ReactMethod = Assert<
  Exact<ReturnType<ReactAdapterHandle<Demo>['getExposes']>['convert'], Convert>
>;
type VueMethod = Assert<
  Exact<ReturnType<VueAdapterHandle<Demo>['getExposes']>['convert'], Convert>
>;
type Vue2Method = Assert<
  Exact<ReturnType<Vue2AdapterHandle<Demo>['getExposes']>['convert'], Convert>
>;
type WebComponentMethod = Assert<
  Exact<ReturnType<WebComponentAdapterHandle<Demo>['getExposes']>['convert'], Convert>
>;

// A portable method declaration is a descriptor, not a mandatory JS callable.
const marker: ExposeMethod<Convert> = {
  kind: 'method',
  fn: (value, options) => `${options?.label ?? ''}${value}`,
};
const authoredFunction: Convert = marker.fn;
const authoredResult: string = marker.fn(1, { label: 'value:' });
// @ts-expect-error The descriptor itself is not an adapter calling surface.
marker(1);
// @ts-expect-error The descriptor is not structurally a JS callable.
const callableMarker: Convert = marker;
// @ts-expect-error The carried function preserves its number input.
marker.fn('invalid');
// @ts-expect-error The carried function requires its first argument.
marker.fn();
// @ts-expect-error The carried function does not accept additional arguments.
marker.fn(1, undefined, true);
// @ts-expect-error The carried function's result is not any or number.
const wrongAuthoredResult: number = marker.fn(1);

function authorBoundary(def: DefHandle<Record<string, never>, Declaration>) {
  def.expose.method('convert', (value, options) => `${options?.label ?? ''}${value}`);
  // @ts-expect-error The author function must preserve the declared argument domain.
  def.expose.method('convert', (value: string) => value);
  // @ts-expect-error The author function must preserve the declared return domain.
  def.expose.method('convert', (value: number) => value);
  // @ts-expect-error A method cannot be contributed under an undeclared key.
  def.expose.method('missing', (value: number) => String(value));
}

declare const instance: ProtoAdapterExposes<Demo>;
const projectedFunction: Convert = instance.convert;
const projectedResult: string = instance.convert(1, { label: 'value:' });
// @ts-expect-error Adapter projection keeps the declared argument domain.
instance.convert('invalid');
// @ts-expect-error Adapter projection keeps required arity.
instance.convert();
// @ts-expect-error Adapter projection does not add an unrestricted call signature.
instance.convert(1, undefined, true);
// @ts-expect-error Adapter projection keeps the return domain rather than any.
const wrongProjectedResult: number = instance.convert(1);
// @ts-expect-error Event declarations are not instance method entries.
instance.changed;
// @ts-expect-error The adapter surface is not the original declaration descriptor.
instance.convert.fn;

void marker;
void authoredFunction;
void authoredResult;
void callableMarker;
void wrongAuthoredResult;
void authorBoundary;
void projectedFunction;
void projectedResult;
void wrongProjectedResult;
