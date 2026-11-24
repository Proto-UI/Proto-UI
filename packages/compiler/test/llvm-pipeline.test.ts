import { describe, expect, it } from 'vitest';
import {
  assembleLlvmBitcode,
  compileLlvmToAssembly,
  compileLlvmToObject,
  compileLlvmToWasm,
  createCompiler,
  detectLlvmToolchain,
  optimizeLlvmIr,
  verifyLlvmIr,
} from '../src';
import { instantiateWasmKernel } from '../src/runtime';

const toolchain = detectLlvmToolchain();

describe.skipIf(!toolchain.available)('LLVM IR emission and LLVM toolchain pipeline', () => {
  const compiler = createCompiler({ rootDir: process.cwd() });

  it('emits valid LLVM IR, verifies with opt, optimizes with O2, and produces bitcode + native asm/obj', () => {
    const res = compiler.compilePrototype(
      `
      import { definePrototype, tw } from '@proto.ui/core';

      function clampBonus(score: number, active: boolean): number {
        const extra = 10 + 5;
        if (!active) {
          return 0;
        }
        return score > 100 ? 100 : score + extra;
      }

      export default definePrototype({
        name: 'score-badge',
        setup(def) {
          def.props.define({
            variant: { type: 'enum', options: ['primary', 'danger'], default: 'primary' },
            threshold: { type: 'number', default: 50 },
          });
          const hovered = def.state.bool('hovered', false);
          const count = def.state.numberDiscrete('count', 10);

          def.rule({
            when: (w) => w.all(w.prop('variant').eq('danger'), w.state(hovered).eq(true)),
            intent: (i) => i.feedback.style.use(tw('bg-red-600 text-white')),
          });
          def.rule({
            when: (w) => w.any(w.state(count).gte(10), w.prop('threshold').gte(100)),
            intent: (i) => i.feedback.style.use(tw('font-bold')),
          });

          def.event.on('press.commit', () => {
            count.set(count.get() + 5);
          });
          return (r) => r.el('span', [count.get()]);
        },
      });
      `,
      { target: 'kernel', llvm: { verify: true, optimize: 'O2' } }
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const ll = res.value.llvm.ir;
    expect(ll).toContain('define i64 @score_badge_capabilities()');
    expect(ll).toContain('define i1 @score_badge_rule_0(ptr %props, ptr %states)');
    expect(ll).toContain('define i32 @score_badge_eval_rules(ptr %props, ptr %states)');
    expect(ll).toContain('define double @helper_clampBonus(double %score, i1 %active)');

    expect(res.value.llvm.verified).toBe(true);
    expect(res.value.llvm.optimizedIr).toBeTruthy();

    // Real LLVM opt -O2 constant-folds 10 + 5 = 15 (0x402e000000000000 -> 1.500000e+01)
    const optRes = optimizeLlvmIr(ll, { level: 'O2' });
    expect(optRes.ok).toBe(true);
    if (optRes.ok) {
      expect(optRes.value.ir).toContain('1.500000e+01');
    }

    // Real LLVM bitcode assembly (magic bytes: 'B', 'C', 0xC0, 0xDE)
    const bc = assembleLlvmBitcode(ll);
    expect(bc.ok).toBe(true);
    if (bc.ok) {
      expect(Array.from(bc.value.slice(0, 4))).toEqual([0x42, 0x43, 0xc0, 0xde]);
    }

    // Real x86_64 native assembly & object emission via llc
    const asm = compileLlvmToAssembly(ll, { targetTriple: 'x86_64-unknown-linux-gnu' });
    expect(asm.ok).toBe(true);
    if (asm.ok) {
      expect(asm.value).toContain('score_badge_eval_rules:');
      expect(asm.value).toContain('helper_clampBonus:');
    }

    const obj = compileLlvmToObject(ll, { targetTriple: 'x86_64-unknown-linux-gnu' });
    expect(obj.ok).toBe(true);
    if (obj.ok) {
      // ELF magic: 0x7F 'E' 'L' 'F'
      expect(Array.from(obj.value.slice(0, 4))).toEqual([0x7f, 0x45, 0x4c, 0x46]);
    }
  });

  it.skipIf(!toolchain.opt || !toolchain.llc || !toolchain.wasmLd)(
    'compiles SSA rule/state/helper kernels via LLVM 22 -> wasm32 and executes them natively in WebAssembly',
    async () => {
      const res = compiler.compilePrototype(
        `
      import { definePrototype, tw } from '@proto.ui/core';

      function clampBonus(score: number, active: boolean): number {
        const extra = 10 + 5;
        if (!active) {
          return 0;
        }
        return score > 100 ? 100 : score + extra;
      }

      export default definePrototype({
        name: 'wasm-kernel-proto',
        setup(def) {
          def.props.define({
            variant: { type: 'enum', options: ['primary', 'danger'], default: 'primary' },
            threshold: { type: 'number', default: 50 },
          });
          const hovered = def.state.bool('hovered', false);
          const count = def.state.numberDiscrete('count', 5);

          def.rule({
            when: (w) => w.all(w.prop('variant').eq('danger'), w.state(hovered).eq(true)),
            intent: (i) => i.feedback.style.use(tw('bg-red-600')),
          });
          def.rule({
            when: (w) => w.state(count).gte(10),
            intent: (i) => i.feedback.style.use(tw('font-bold')),
          });

          def.event.on('press.commit', () => {
            count.set(count.get() + 5);
          });
          return (r) => r.el('button', [count.get()]);
        },
      });
      `,
        { target: 'kernel', llvm: { emitWasm: true, optimize: 'O2' } }
      );

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const wasmBytes = res.value.llvm.wasm!;
      // WebAssembly magic: \0asm
      expect(Array.from(wasmBytes.slice(0, 4))).toEqual([0x00, 0x61, 0x73, 0x6d]);

      const kernel = await instantiateWasmKernel(wasmBytes);
      const exports = kernel.exports as Record<string, (...args: number[]) => number | bigint>;

      // 1. Execute lowered pure helper compiled through LLVM O2 -> WASM!
      expect(exports.helper_clampBonus(40, 0)).toBe(0);
      expect(exports.helper_clampBonus(40, 1)).toBe(55);
      expect(exports.helper_clampBonus(150, 1)).toBe(100);

      // 2. Execute state initializer + event state transitions in WASM!
      exports.wasm_kernel_proto_init_state(kernel.statesPtr);
      expect(kernel.getStateBool(0)).toBe(false);
      expect(kernel.getStateF64(1)).toBe(5);

      // 3. Evaluate compiled rule bitmask in WASM!
      // Resolve the interned value; its numeric ID is an internal representation detail.
      const dangerId = res.value.ir.prototypes[0].stringTable.indexOf('danger');
      expect(dangerId).toBeGreaterThanOrEqual(0);

      // Initially variant != danger (-1), hovered=false, count=5 (<10) -> bitmask = 0b00 = 0
      kernel.setPropI32(0, 99);
      expect(exports.wasm_kernel_proto_eval_rules(kernel.propsPtr, kernel.statesPtr)).toBe(0);

      // Set variant='danger' AND hovered=true -> rule 0 matches -> bitmask = 0b01 = 1
      kernel.setPropI32(0, dangerId);
      kernel.setStateBool(0, true);
      expect(exports.wasm_kernel_proto_eval_rules(kernel.propsPtr, kernel.statesPtr)).toBe(1);

      // Trigger press.commit once: count goes 5 -> 10 -> rule 1 ALSO matches -> bitmask = 0b11 = 3!
      exports.wasm_kernel_proto_on_press_commit_0(kernel.statesPtr);
      expect(kernel.getStateF64(1)).toBe(10);
      expect(exports.wasm_kernel_proto_eval_rules(kernel.propsPtr, kernel.statesPtr)).toBe(3);

      // Also test standalone compileLlvmToWasm helper directly
      const direct = compileLlvmToWasm(res.value.llvm.ir);
      expect(direct.ok).toBe(true);
    }
  );

  it('rejects intentionally malformed LLVM IR with PUI_LLVM002', () => {
    const bad = verifyLlvmIr('define i32 @broken() { entry: ret i1 1 }');
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.diagnostics[0].code).toBe('PUI_LLVM002');
    }
  });
});
