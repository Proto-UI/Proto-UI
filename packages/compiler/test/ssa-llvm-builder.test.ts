import { describe, expect, it } from 'vitest';
import { SsaBuilder } from '../src/ir/builder';
import { optimizeSsaFunction } from '../src/ir/passes';
import { verifyModuleIR, verifySsaFunction } from '../src/ir/verify';
import type { ModuleIR, PrototypeIR, SsaFunction } from '../src/ir/types';
import { emitLlvmIRResult } from '../src/llvm/emit';
import { compileLlvmToWasm, detectLlvmToolchain } from '../src/llvm/toolchain';
import { instantiateWasmKernel } from '../src/runtime';

const moduleOf = (
  functions: readonly SsaFunction[],
  prototypes: readonly PrototypeIR[] = []
): ModuleIR => ({
  irVersion: 2,
  sourceFile: 'ssa-builder-regression',
  functions,
  prototypes,
  authoredHooks: [],
});

function phiFunction(): SsaFunction {
  return {
    name: 'phi_edge',
    params: [
      { id: '%x', type: 'i32' },
      { id: '%y', type: 'i32' },
    ],
    returnType: 'i32',
    exported: true,
    pure: true,
    blocks: [
      {
        label: 'entry',
        instructions: [{ op: 'const', result: '%condition', type: 'i1', value: true }],
        terminator: { op: 'condbr', cond: '%condition', thenTarget: 'left', elseTarget: 'join' },
      },
      { label: 'left', instructions: [], terminator: { op: 'br', target: 'join' } },
      {
        label: 'join',
        instructions: [
          {
            op: 'phi',
            result: '%answer',
            type: 'i32',
            incoming: [
              { label: 'entry', value: '%x' },
              { label: 'left', value: '%y' },
            ],
          },
        ],
        terminator: { op: 'ret', type: 'i32', value: '%answer' },
      },
    ],
  };
}

describe('SSA invariants that protect compiler transformations', () => {
  it('rejects a use before its definition and a cross-branch non-dominating definition', () => {
    const early: SsaFunction = {
      name: 'early',
      params: [{ id: '%argument', type: 'i32' }],
      returnType: 'i32',
      blocks: [
        {
          label: 'entry',
          instructions: [
            {
              op: 'binop',
              result: '%use',
              operator: 'add',
              type: 'i32',
              lhs: '%later',
              rhs: '%argument',
            },
            {
              op: 'binop',
              result: '%later',
              operator: 'add',
              type: 'i32',
              lhs: '%argument',
              rhs: '%argument',
            },
          ],
          terminator: { op: 'ret', type: 'i32', value: '%use' },
        },
      ],
    };
    expect(
      verifySsaFunction(early).some((entry) => entry.message.includes('does not precede'))
    ).toBe(true);
    const cross: SsaFunction = {
      name: 'cross',
      params: [{ id: '%condition', type: 'i1' }],
      returnType: 'i32',
      blocks: [
        {
          label: 'entry',
          instructions: [],
          terminator: { op: 'condbr', cond: '%condition', thenTarget: 'yes', elseTarget: 'no' },
        },
        {
          label: 'yes',
          instructions: [{ op: 'const', result: '%local', type: 'i32', value: 1 }],
          terminator: { op: 'ret', type: 'i32', value: '%local' },
        },
        { label: 'no', instructions: [], terminator: { op: 'ret', type: 'i32', value: '%local' } },
      ],
    };
    expect(
      verifySsaFunction(cross).some((entry) => entry.message.includes('does not dominate'))
    ).toBe(true);
  });

  it('updates phi incoming edges when a constant branch removes an edge but keeps both blocks', () => {
    const before = phiFunction();
    expect(verifySsaFunction(before)).toEqual([]);
    const after = optimizeSsaFunction(before).fn;
    expect(after.blocks.find((block) => block.label === 'join')?.instructions[0]).toMatchObject({
      op: 'phi',
      incoming: [{ label: 'left', value: '%y' }],
    });
    expect(verifySsaFunction(after)).toEqual([]);
  });

  it('rejects call signature, return-type, slot and phi predecessor drift', () => {
    const callee = new SsaBuilder('callee', [{ id: '%x', type: 'i32' }], 'i32');
    callee.ret('%x');
    const caller = new SsaBuilder('caller', [], 'void');
    caller.call('callee', 'void', []);
    caller.ret();
    expect(
      verifyModuleIR(moduleOf([callee.build(), caller.build()])).some((entry) =>
        entry.message.includes('signature')
      )
    ).toBe(true);
    const invalid = new SsaBuilder('invalid', [{ id: '%states', type: 'ptr' }], 'i32');
    const loaded = invalid.loadState('%states', -1, 'bad', 'i32');
    invalid.terminate({ op: 'ret', type: 'f64', value: loaded });
    const messages = verifySsaFunction(invalid.build())
      .map((entry) => entry.message)
      .join('\n');
    expect(messages).toContain('slot must');
    expect(messages).toContain('Return instruction type');
    const stale = phiFunction();
    stale.blocks[0].terminator = { op: 'br', target: 'left' };
    expect(
      verifySsaFunction(stale).some((entry) => entry.message.includes('CFG predecessors'))
    ).toBe(true);
  });

  it('preserves low i32 multiplication bits and signed zero in constant folding', () => {
    const multiply = new SsaBuilder('multiply', [], 'i32');
    const maximum = multiply.constI32(2147483647);
    multiply.ret(multiply.binop('mul', 'i32', maximum, maximum));
    expect(optimizeSsaFunction(multiply.build()).fn.blocks[0].instructions).toContainEqual(
      expect.objectContaining({ op: 'const', value: 1 })
    );
    const negate = new SsaBuilder('negative_zero', [], 'f64');
    negate.ret(negate.fneg(negate.constF64(0)));
    const constants = optimizeSsaFunction(negate.build()).fn.blocks[0].instructions;
    expect(constants.some((inst) => inst.op === 'const' && Object.is(inst.value, -0))).toBe(true);
  });
});

const toolchain = detectLlvmToolchain();
const hasSdk = Boolean(toolchain.llvmConfig && toolchain.version?.startsWith('22.'));
const hasWasmTools = hasSdk && Boolean(toolchain.opt && toolchain.llc && toolchain.wasmLd);

describe.skipIf(!hasSdk)('real LLVM API construction', () => {
  it('constructs and verifies a CFG repaired by the SSA optimizer', () => {
    const emitted = emitLlvmIRResult(moduleOf([optimizeSsaFunction(phiFunction()).fn]));
    expect(emitted.ok, JSON.stringify(emitted.diagnostics)).toBe(true);
    if (!emitted.ok) return;
    expect(emitted.value).toContain('@phi_edge');
    expect(emitted.value).toContain('phi i32');
  });

  it('rejects an unmapped string initial value instead of mapping it to the first string', () => {
    const prototype: PrototypeIR = {
      name: 'string-state',
      exportName: 'default',
      isDefaultExport: true,
      sourceFile: 'string-state.proto.ts',
      tier: 'reactive',
      props: [],
      states: [{ index: 0, name: 'status', kind: 'string', initialValue: 'idle', ssaType: 'i32' }],
      exposes: [],
      events: [],
      hooks: [],
      contexts: [],
      staticStyleTokens: [],
      rules: [],
      lifecycle: [],
      render: { kind: 'default-slot' },
      capabilities: ['state'],
      capabilityMask: 2n,
      functions: [],
      stringTable: ['busy'],
    };
    const rejected = emitLlvmIRResult(moduleOf([], [prototype]));
    expect(rejected.ok).toBe(false);
    expect(
      rejected.diagnostics.some((entry) => entry.message.includes('missing from the string table'))
    ).toBe(true);
    const accepted = emitLlvmIRResult(
      moduleOf([], [{ ...prototype, stringTable: ['busy', 'idle'] }])
    );
    expect(accepted.ok, JSON.stringify(accepted.diagnostics)).toBe(true);
  });
});

describe.skipIf(!hasWasmTools)('LLVM builder to machine-executed WASM', () => {
  it('initializes mapped strings and sizes host storage from the compiled module metadata', async () => {
    const rule = new SsaBuilder('status_is_busy', [{ id: '%states', type: 'ptr' }], 'i1', {
      exported: true,
      pure: true,
    });
    const status = rule.loadState('%states', 0, 'status', 'i32');
    rule.ret(rule.cmp('eq', 'i32', status, rule.constI32(0)));
    const prototype: PrototypeIR = {
      name: 'capacity-test',
      exportName: 'default',
      isDefaultExport: true,
      sourceFile: 'capacity-test.proto.ts',
      tier: 'reactive',
      props: Array.from({ length: 129 }, (_, index) => ({
        index,
        name: 'prop' + index,
        tsType: 'number',
        kind: 'number' as const,
        ssaType: 'f64' as const,
      })),
      states: [
        { index: 0, name: 'status', kind: 'string', initialValue: 'idle', ssaType: 'i32' },
        { index: 1, name: 'count', kind: 'number.discrete', initialValue: 7, ssaType: 'f64' },
      ],
      exposes: [],
      events: [],
      hooks: [],
      contexts: [],
      staticStyleTokens: [],
      rules: [],
      lifecycle: [],
      render: { kind: 'default-slot' },
      capabilities: ['state', 'props'],
      capabilityMask: 3n,
      functions: [rule.build()],
      stringTable: ['busy', 'idle'],
    };
    const emitted = emitLlvmIRResult(moduleOf([], [prototype]));
    expect(emitted.ok, JSON.stringify(emitted.diagnostics)).toBe(true);
    if (!emitted.ok) return;
    const wasm = compileLlvmToWasm(emitted.value);
    expect(wasm.ok, JSON.stringify(wasm.diagnostics)).toBe(true);
    if (!wasm.ok) return;
    const kernel = await instantiateWasmKernel(wasm.value.wasm);
    const exports = kernel.exports as Record<string, (...args: number[]) => number>;
    expect(kernel.propsSlots).toBe(129);
    expect(kernel.statesSlots).toBe(2);
    expect(kernel.statesPtr).toBe(kernel.propsPtr + 129 * 8);
    exports.capacity_test_init_state(kernel.statesPtr);
    expect(kernel.getStateI32(0)).toBe(1);
    expect(exports.status_is_busy(kernel.statesPtr)).toBe(0);
    expect(kernel.getStateF64(1)).toBe(7);
    kernel.setPropF64(128, 42);
    expect(kernel.getStateI32(0)).toBe(1);
    expect(kernel.getStateF64(1)).toBe(7);
    await expect(instantiateWasmKernel(wasm.value.wasm, { propsSlots: 128 })).rejects.toThrow(
      'smaller than the capacity'
    );
    await expect(instantiateWasmKernel(wasm.value.wasm, { heapBase: 0 })).rejects.toThrow(
      'overlaps module-owned stack or data'
    );
  });

  it('preserves fneg and IEEE constants and executes the repaired phi CFG', async () => {
    const negate = new SsaBuilder('negate', [{ id: '%x', type: 'f64' }], 'f64', {
      exported: true,
      pure: true,
    });
    negate.ret(negate.fneg('%x'));
    const constants = [0, -0, Infinity, -Infinity, NaN].map((literal, index) => {
      const builder = new SsaBuilder('literal_' + index, [], 'f64', { exported: true, pure: true });
      builder.ret(builder.constF64(literal));
      return builder.build();
    });
    const order = new SsaBuilder(
      'bool_order',
      [
        { id: '%a', type: 'i1' },
        { id: '%b', type: 'i1' },
      ],
      'i1',
      { exported: true, pure: true }
    );
    order.ret(order.cmp('gt', 'i1', '%a', '%b'));
    const emitted = emitLlvmIRResult(
      moduleOf([negate.build(), order.build(), optimizeSsaFunction(phiFunction()).fn, ...constants])
    );
    expect(emitted.ok, JSON.stringify(emitted.diagnostics)).toBe(true);
    if (!emitted.ok) return;
    const wasm = compileLlvmToWasm(emitted.value);
    expect(wasm.ok, JSON.stringify(wasm.diagnostics)).toBe(true);
    if (!wasm.ok) return;
    const kernel = await instantiateWasmKernel(wasm.value.wasm);
    const exports = kernel.exports as Record<string, (...args: number[]) => number>;
    expect(Object.is(exports.negate(0), -0)).toBe(true);
    expect(Object.is(exports.negate(-0), 0)).toBe(true);
    expect(exports.negate(Infinity)).toBe(-Infinity);
    expect(Number.isNaN(exports.negate(NaN))).toBe(true);
    [0, -0, Infinity, -Infinity, NaN].forEach((literal, index) => {
      expect(Object.is(exports['literal_' + index](), literal)).toBe(true);
    });
    expect(exports.phi_edge(10, 20)).toBe(20);
    expect(exports.bool_order(1, 0)).toBe(1);
    expect(exports.bool_order(0, 1)).toBe(0);
  });
});
