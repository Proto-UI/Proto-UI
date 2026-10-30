import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitVue2Source } from '../src/vue2-source';
import type { GeneratedModule } from '../src/ir';

const vue2 = createRequire(fileURLToPath(new NodeURL('../../adapters/vue2/package.json', import.meta.url)));
const positioning = createRequire(fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url)));
function compile(setup: string): GeneratedModule {
  const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';
    import {asFocusable} from '@proto.ui/hooks';
    export default definePrototype({name:'ordinary-native-owner',setup(def){${setup}}});`);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitVue2Source(parsed.value);
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  return emitted.value;
}
function check(module: GeneratedModule, extra = '') {
  const root = mkdtempSync(path.join(tmpdir(), 'vue2-native-instance-'));
  try {
    mkdirSync(path.join(root, 'node_modules', '@floating-ui'), { recursive: true });
    symlinkSync(path.dirname(vue2.resolve('vue/package.json')), path.join(root, 'node_modules/vue'), 'dir');
    symlinkSync(path.dirname(positioning.resolve('@floating-ui/dom/package.json')), path.join(root, 'node_modules/@floating-ui/dom'), 'dir');
    const files = [{path:'Component.js', contents:module.code + '\n' + extra}, ...(module.supportingFiles ?? [])];
    for (const file of files) {
      const target = path.join(root, file.path); mkdirSync(path.dirname(target), {recursive:true});
      writeFileSync(target, file.contents);
    }
    const program = ts.createProgram(files.map(f => path.join(root, f.path)), {
      allowJs:true, checkJs:true, strict:true, noEmit:true, skipLibCheck:false,
      target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext,
      moduleResolution:ts.ModuleResolutionKind.Bundler, types:[],
      lib:['lib.es2022.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts'],
    });
    // A checker crash is a test failure, never evidence of valid generated JS.
    const syntax = program.getSyntacticDiagnostics();
    // Syntax failures cannot be substituted for the original checker crash.
    expect(syntax.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
    return ts.getPreEmitDiagnostics(program).map(d => ({code:d.code,
      file:d.file?.fileName, start:d.start,
      message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
  } finally { rmSync(root, {recursive:true, force:true}); }
}

describe('Vue2 native instance checker stability (not full strict-consumer acceptance)', () => {
  it.each([
    ['empty', `return r=>r.el('span','native');`],
    ['focus', `const focus=asFocusable();focus.configure({disabled:false});return r=>r.el('button','native');`],
    ['state-and-slots', `const count=def.state.numberDiscrete('count',0);def.expose.state('count',count);return r=>r.el('output',[count.get(),r.slot()]);`],
    ['renamed-prefix', `const __puiValue='native';return r=>r.el('span',__puiValue);`],
  ])('returns real diagnostics without crashing for %s', (_name, setup) => {
    // No catch/facade: RangeError from TypeScript fails this regression.
    // Other generated-helper errors remain real diagnostics. Complete strict
    // consumer acceptance is separate and still red until all are corrected.
    const output = compile(setup);
    const diagnostics = check(output);
    const nativeAnnotations = [...output.code.matchAll(/\/\*\*[\s\S]*?\*\//g)]
      .filter(match => /NativeInstance|CreateElement/.test(match[0]));
    expect(nativeAnnotations.length).toBeGreaterThan(1);
    // Check the exact new annotation ranges, including the typedef declaration
    // and every native @this use. Unknown types/names and invalid JSDoc here
    // remain failures; unrelated full-helper diagnostics are not discarded.
    expect(diagnostics.filter(d => d.file?.endsWith('/Component.js') && d.start !== undefined
      && nativeAnnotations.some(match => d.start! >= match.index!
        && d.start! < match.index! + match[0].length))).toEqual([]);
  });

  it('rejects a nonexistent native-owner property rather than turning the instance into any', () => {
    const bad = check(compile(`return r=>r.el('span','native');`),
      `/** @param {__puiNativeInstance} vm */\nfunction wrongOwner(vm) { return vm.__puiMissingOwner; }`);
    expect(bad.some(d => d.code === 2339 && d.message.includes('__puiMissingOwner'))).toBe(true);
  });
});
