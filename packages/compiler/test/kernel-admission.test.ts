import { describe, expect, it } from 'vitest';
import { createCompiler, detectLlvmToolchain } from '../src';
import { instantiateWasmKernel } from '../src/runtime';

const compiler = createCompiler({ rootDir: process.cwd() });
function source(body: string) {
  return `import {definePrototype,tw} from '@proto.ui/core'; export default definePrototype({name:'kernel-admission',setup(def){${body}}});`;
}

describe('Independent scalar kernel admission', () => {
  it('rejects dropped control flow and domain validation before requesting LLVM', () => {
    for (const body of [
      "const n=def.state.numberDiscrete('n',0);def.event.on('key.down',()=>{if(n.get()>2){n.set(0);return;}n.set(n.get()+1);});return r=>r.el('div',n.get());",
      "const n=def.state.numberDiscrete('n',2,{min:0,max:3});def.event.on('key.down',()=>n.set(n.get()+2));return r=>r.el('div',n.get());",
    ]) {
      const result = compiler.compilePrototype(source(body), { target: 'kernel' });
      expect(result.ok).toBe(false);
      expect(result.diagnostics.some((issue) => issue.code === 'PUI_KERNEL_UNSUPPORTED')).toBe(
        true
      );
    }
  });

  it.skipIf(!detectLlvmToolchain().available)(
    'preserves finite-number gte semantics in actual WASM',
    async () => {
      const result = compiler.compilePrototype(
        source(
          "const n=def.state.numberDiscrete('n',0);def.rule({when:w=>w.state(n).gte(0),intent:i=>i.feedback.style.use(tw('p-1'))});return r=>r.el('div',n.get());"
        ),
        { target: 'kernel', llvm: { emitWasm: true } }
      );
      expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
      if (!result.ok) return;
      const kernel = await instantiateWasmKernel(result.value.llvm.wasm!);
      const evaluate = kernel.exports.kernel_admission_rule_0 as (
        props: number,
        states: number
      ) => number;
      kernel.setStateF64(0, Infinity);
      expect(evaluate(kernel.propsPtr, kernel.statesPtr)).toBe(0);
      kernel.setStateF64(0, 1);
      expect(evaluate(kernel.propsPtr, kernel.statesPtr)).toBe(1);
      kernel.setStateF64(0, -1);
      expect(evaluate(kernel.propsPtr, kernel.statesPtr)).toBe(0);
    }
  );
});
