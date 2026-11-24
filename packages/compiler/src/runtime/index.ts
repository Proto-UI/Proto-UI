import * as React from 'react';
import {
  createReactAdapter,
  type ReactAdapterOptions,
  type ReactAdapterProps,
  type ReactRuntime,
} from '@proto.ui/adapter-react';
import type { Prototype } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import type { CapabilityName, CompilationTier } from '../ir/types';

export interface CompiledComponentMeta {
  readonly name: string;
  readonly tier: CompilationTier;
  readonly capabilities: readonly CapabilityName[];
  readonly capabilityMask: string;
  readonly props: readonly string[];
  readonly states: readonly string[];
  readonly exposes: readonly string[];
  readonly staticStyleTokens: readonly string[];
}

export type PrototypeProps<T> = T extends Prototype<infer P, any> ? P : PropsBaseType;
export type PrototypeExposes<T> = T extends Prototype<any, infer E> ? E : Record<string, any>;

export function mergeClassNames(
  ...parts: readonly (string | undefined | null | false)[]
): string | undefined {
  const joined = parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ');
  return joined.length > 0 ? joined : undefined;
}

/**
 * Thin shared runtime bridge for Tier-2 (full protocol) compiled React components.
 * Delegates directly to canonical `@proto.ui/adapter-react` + `@proto.ui/runtime`
 * instead of duplicating thousands of lines of DOM modules into every component.
 */
export function createCompiledReactComponent<TProto extends Prototype<any, any>>(
  prototype: TProto,
  meta: CompiledComponentMeta,
  options?: ReactAdapterOptions<PrototypeProps<TProto>>,
  reactRuntime: ReactRuntime = React as unknown as ReactRuntime
) {
  const adapt = createReactAdapter(reactRuntime);
  const Component = adapt(prototype, options as ReactAdapterOptions<any> | undefined);
  Object.defineProperty(Component, '__protoMeta', {
    value: Object.freeze({ ...meta }),
    enumerable: false,
    configurable: false,
  });
  return Component as typeof Component & {
    readonly __protoMeta: CompiledComponentMeta;
  };
}

export type { ReactAdapterOptions, ReactAdapterProps, ReactRuntime };

/**
 * Runtime host wrapper around an LLVM-compiled WebAssembly kernel produced by
 * `compileLlvmToWasm`. Uses uniform 8-byte aligned slots for props and states.
 */
export interface WasmKernelInstance {
  readonly exports: WebAssembly.Exports;
  readonly memory: WebAssembly.Memory;
  setPropBool(slot: number, value: boolean): void;
  setPropF64(slot: number, value: number): void;
  setPropI32(slot: number, value: number): void;
  setStateBool(slot: number, value: boolean): void;
  setStateF64(slot: number, value: number): void;
  setStateI32(slot: number, value: number): void;
  getStateBool(slot: number): boolean;
  getStateF64(slot: number): number;
  getStateI32(slot: number): number;
  readonly propsPtr: number;
  readonly statesPtr: number;
}

export async function instantiateWasmKernel(
  wasmBytes: Uint8Array,
  options: { imports?: WebAssembly.Imports; propsOffset?: number; statesOffset?: number } = {}
): Promise<WasmKernelInstance> {
  const { instance } = await WebAssembly.instantiate(
    wasmBytes as unknown as BufferSource,
    options.imports ?? {}
  );
  const memory =
    (instance.exports.memory as WebAssembly.Memory | undefined) ??
    new WebAssembly.Memory({ initial: 1 });
  const propsPtr = options.propsOffset ?? 1024;
  const statesPtr = options.statesOffset ?? 2048;
  const view = () => new DataView(memory.buffer);

  return {
    exports: instance.exports,
    memory,
    propsPtr,
    statesPtr,
    setPropBool(slot, value) {
      view().setUint8(propsPtr + slot * 8, value ? 1 : 0);
    },
    setPropF64(slot, value) {
      view().setFloat64(propsPtr + slot * 8, value, true);
    },
    setPropI32(slot, value) {
      view().setInt32(propsPtr + slot * 8, value | 0, true);
    },
    setStateBool(slot, value) {
      view().setUint8(statesPtr + slot * 8, value ? 1 : 0);
    },
    setStateF64(slot, value) {
      view().setFloat64(statesPtr + slot * 8, value, true);
    },
    setStateI32(slot, value) {
      view().setInt32(statesPtr + slot * 8, value | 0, true);
    },
    getStateBool(slot) {
      return view().getUint8(statesPtr + slot * 8) !== 0;
    },
    getStateF64(slot) {
      return view().getFloat64(statesPtr + slot * 8, true);
    },
    getStateI32(slot) {
      return view().getInt32(statesPtr + slot * 8, true);
    },
  };
}
