import { describe, expect, it } from 'vitest';
import { instantiateWasmKernel } from '../src/kernel-host';

// Minimal standard Wasm module exporting one page of memory, with no compiler metadata.
const memoryModule = Uint8Array.from([
  0, 97, 115, 109, 1, 0, 0, 0, 5, 3, 1, 0, 1, 7, 10, 1, 6, 109, 101, 109, 111, 114, 121, 2, 0,
]);

describe('WASM kernel memory ownership and bounds', () => {
  it('allocates disjoint storage for more than 128 props and grows actual module memory', async () => {
    const kernel = await instantiateWasmKernel(memoryModule, {
      heapBase: 1024,
      propsSlots: 9000,
      statesSlots: 1,
    });
    kernel.setStateF64(0, 7);
    kernel.setPropF64(128, 42);
    kernel.setPropF64(8999, -0);
    expect(kernel.getStateF64(0)).toBe(7);
    expect(kernel.statesPtr).toBe(kernel.propsPtr + 9000 * 8);
    expect(kernel.memory.buffer.byteLength).toBeGreaterThan(65536);
    expect(() => kernel.setPropF64(9000, 9)).toThrow(RangeError);
    expect(() => kernel.setStateBool(-1, true)).toThrow(RangeError);
    expect(() => kernel.getStateF64(0.5)).toThrow(RangeError);
  });

  it('preserves instance isolation and exact floating-point values', async () => {
    const options = { heapBase: 0, propsSlots: 0, statesSlots: 1 };
    const left = await instantiateWasmKernel(memoryModule, options);
    const right = await instantiateWasmKernel(memoryModule, options);
    expect(left.memory).not.toBe(right.memory);
    left.setStateF64(0, -0);
    expect(Object.is(left.getStateF64(0), -0)).toBe(true);
    expect(Object.is(right.getStateF64(0), 0)).toBe(true);
    left.setStateF64(0, NaN);
    expect(Number.isNaN(left.getStateF64(0))).toBe(true);
    left.setStateF64(0, Infinity);
    expect(left.getStateF64(0)).toBe(Infinity);
    expect(() => left.setStateI32(0, 2 ** 31)).toThrow(RangeError);
  });

  it('rejects absent memory, missing layout, unaligned or overlapping explicit ranges', async () => {
    const emptyModule = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
    await expect(
      instantiateWasmKernel(emptyModule, { heapBase: 0, propsSlots: 0, statesSlots: 0 })
    ).rejects.toThrow('must export the memory');
    await expect(instantiateWasmKernel(memoryModule)).rejects.toThrow('Missing propsSlots');
    await expect(
      instantiateWasmKernel(memoryModule, {
        heapBase: 0,
        propsSlots: 129,
        statesSlots: 1,
        propsOffset: 1024,
        statesOffset: 2048,
      })
    ).rejects.toThrow('overlap');
    await expect(
      instantiateWasmKernel(memoryModule, {
        heapBase: 0,
        propsSlots: 1,
        statesSlots: 1,
        propsOffset: 3,
      })
    ).rejects.toThrow('8-byte aligned');
  });
});
