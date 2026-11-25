/**
 * Host access to explicitly compiled WASM kernels.
 * This module contains no Prototype interpreter, Adapter bridge or UI execution.
 */
export interface WasmKernelInstance {
  readonly exports: WebAssembly.Exports;
  readonly memory: WebAssembly.Memory;
  readonly propsPtr: number;
  readonly statesPtr: number;
  readonly propsSlots: number;
  readonly statesSlots: number;
  setPropBool(slot: number, value: boolean): void;
  setPropF64(slot: number, value: number): void;
  setPropI32(slot: number, value: number): void;
  setStateBool(slot: number, value: boolean): void;
  setStateF64(slot: number, value: number): void;
  setStateI32(slot: number, value: number): void;
  getStateBool(slot: number): boolean;
  getStateF64(slot: number): number;
  getStateI32(slot: number): number;
}

export interface WasmKernelOptions {
  readonly imports?: WebAssembly.Imports;
  /** Optional explicit capacities for a module without compiler ABI metadata. */
  readonly propsSlots?: number;
  readonly statesSlots?: number;
  /** Explicit locations must be aligned, disjoint and above the module heap base. */
  readonly propsOffset?: number;
  readonly statesOffset?: number;
  /** Required for a foreign module that does not export __heap_base. */
  readonly heapBase?: number;
}

const SLOT_BYTES = 8;
const PAGE_BYTES = 65536;
const MAX_WASM32_BYTES = 2 ** 32;

function nonnegativeInteger(value: unknown, label: string, maximum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new RangeError(
      label + ' must be a non-negative integer no greater than ' + maximum + '.'
    );
  }
  return value;
}

function metadata(exports: WebAssembly.Exports, name: string): number | undefined {
  const getter = exports[name];
  if (getter === undefined) return undefined;
  if (typeof getter !== 'function') throw new TypeError(name + ' must be an exported function.');
  return nonnegativeInteger(getter(), name, MAX_WASM32_BYTES / SLOT_BYTES);
}

function capacity(
  explicit: number | undefined,
  declared: number | undefined,
  label: string
): number {
  if (explicit === undefined && declared === undefined) {
    throw new TypeError(
      'Missing ' + label + ': supply an explicit capacity or compiler ABI metadata.'
    );
  }
  const result = nonnegativeInteger(explicit ?? declared, label, MAX_WASM32_BYTES / SLOT_BYTES);
  if (declared !== undefined && result < declared) {
    throw new RangeError(label + ' is smaller than the capacity required by the compiled module.');
  }
  return result;
}

export async function instantiateWasmKernel(
  wasmBytes: Uint8Array,
  options: WasmKernelOptions = {}
): Promise<WasmKernelInstance> {
  const { instance } = await WebAssembly.instantiate(
    wasmBytes as unknown as BufferSource,
    options.imports ?? {}
  );
  const memory = instance.exports.memory;
  if (!(memory instanceof WebAssembly.Memory)) {
    throw new TypeError('The compiled module must export the memory used by its kernels.');
  }
  const abiVersion = metadata(instance.exports, '__pui_abi_version');
  const slotBytes = metadata(instance.exports, '__pui_slot_bytes');
  if (abiVersion !== undefined && (abiVersion !== 1 || slotBytes !== SLOT_BYTES)) {
    throw new TypeError('Unsupported compiler kernel ABI version or slot size.');
  }
  const propsSlots = capacity(
    options.propsSlots,
    metadata(instance.exports, '__pui_props_slots'),
    'propsSlots'
  );
  const statesSlots = capacity(
    options.statesSlots,
    metadata(instance.exports, '__pui_states_slots'),
    'statesSlots'
  );
  const exportedHeapBase = instance.exports.__heap_base;
  const moduleHeapBase =
    exportedHeapBase instanceof WebAssembly.Global ? Number(exportedHeapBase.value) : undefined;
  if (moduleHeapBase === undefined && options.heapBase === undefined) {
    throw new TypeError(
      'The module must export __heap_base or the caller must supply its verified heap base.'
    );
  }
  const heapBase = nonnegativeInteger(
    options.heapBase ?? moduleHeapBase,
    'heapBase',
    MAX_WASM32_BYTES
  );
  if (moduleHeapBase !== undefined && heapBase < moduleHeapBase) {
    throw new RangeError('The requested heap base overlaps module-owned stack or data.');
  }
  const alignedHeapBase = Math.ceil(heapBase / SLOT_BYTES) * SLOT_BYTES;
  const propsPtr = nonnegativeInteger(
    options.propsOffset ?? alignedHeapBase,
    'propsOffset',
    MAX_WASM32_BYTES - 1
  );
  const propsEnd = propsPtr + propsSlots * SLOT_BYTES;
  const statesPtr = nonnegativeInteger(
    options.statesOffset ?? propsEnd,
    'statesOffset',
    MAX_WASM32_BYTES - 1
  );
  const statesEnd = statesPtr + statesSlots * SLOT_BYTES;
  for (const [label, start] of [
    ['propsOffset', propsPtr],
    ['statesOffset', statesPtr],
  ] as const) {
    if (start % SLOT_BYTES !== 0 || start < alignedHeapBase) {
      throw new RangeError(label + ' must be 8-byte aligned and above the module heap base.');
    }
  }
  if (propsSlots > 0 && statesSlots > 0 && propsPtr < statesEnd && statesPtr < propsEnd) {
    throw new RangeError('Props and state memory ranges overlap.');
  }
  const neededBytes = Math.max(propsEnd, statesEnd);
  if (neededBytes > MAX_WASM32_BYTES) throw new RangeError('Kernel storage exceeds wasm32 memory.');
  const neededPages = Math.ceil(neededBytes / PAGE_BYTES);
  const availablePages = memory.buffer.byteLength / PAGE_BYTES;
  if (neededPages > availablePages) memory.grow(neededPages - availablePages);
  // A new instance owns its state by default. Explicitly imported shared memory
  // requires caller-managed instances and disjoint offsets.
  new Uint8Array(memory.buffer, propsPtr, propsSlots * SLOT_BYTES).fill(0);
  new Uint8Array(memory.buffer, statesPtr, statesSlots * SLOT_BYTES).fill(0);

  const address = (base: number, count: number, slot: number): number => {
    nonnegativeInteger(slot, 'slot', Math.max(0, count - 1));
    if (slot >= count) throw new RangeError('Slot index exceeds the declared kernel capacity.');
    return base + slot * SLOT_BYTES;
  };
  const view = () => new DataView(memory.buffer);
  const boolean = (value: boolean): number => {
    if (typeof value !== 'boolean') throw new TypeError('Boolean slots require boolean values.');
    return value ? 1 : 0;
  };
  const f64 = (value: number): number => {
    if (typeof value !== 'number') throw new TypeError('Numeric slots require number values.');
    return value;
  };
  const i32 = (value: number): number => {
    if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
      throw new RangeError('Integer slots require a signed 32-bit integer.');
    }
    return value;
  };
  return {
    exports: instance.exports,
    memory,
    propsPtr,
    statesPtr,
    propsSlots,
    statesSlots,
    setPropBool(slot, value) {
      view().setUint8(address(propsPtr, propsSlots, slot), boolean(value));
    },
    setPropF64(slot, value) {
      view().setFloat64(address(propsPtr, propsSlots, slot), f64(value), true);
    },
    setPropI32(slot, value) {
      view().setInt32(address(propsPtr, propsSlots, slot), i32(value), true);
    },
    setStateBool(slot, value) {
      view().setUint8(address(statesPtr, statesSlots, slot), boolean(value));
    },
    setStateF64(slot, value) {
      view().setFloat64(address(statesPtr, statesSlots, slot), f64(value), true);
    },
    setStateI32(slot, value) {
      view().setInt32(address(statesPtr, statesSlots, slot), i32(value), true);
    },
    getStateBool(slot) {
      return view().getUint8(address(statesPtr, statesSlots, slot)) !== 0;
    },
    getStateF64(slot) {
      return view().getFloat64(address(statesPtr, statesSlots, slot), true);
    },
    getStateI32(slot) {
      return view().getInt32(address(statesPtr, statesSlots, slot), true);
    },
  };
}
