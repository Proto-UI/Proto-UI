// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitGpuiSource } from '../src/gpui-source';
import { gpuiNativeSdkFiles, GPUI_NATIVE_SDK_VERSION } from '../src/gpui-native-sdk';

function emit(body: string) {
  const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';
    import {asFocusable,asFocusEntry,asFocusScope,asFocusRoving} from '@proto.ui/hooks';
    export default definePrototype({name:'native-capability-boundary',setup(def){${body};return r=>r.el('div');}});`);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  return emitGpuiSource(parsed.value);
}

describe('published native SDK capabilities', () => {
  it.each([
    'const unused=()=>asFocusEntry()',
    "const unused=()=>{const scope=asFocusScope();scope.configure({entryFallback:'entry'})}",
    "let count=0;const ignore=(callback:()=>void)=>{count++;};ignore(()=>{asFocusEntry();});def.expose.value('count',count)",
    "const box={tag:1,unused:()=>asFocusEntry()};def.expose.value('tag',box.tag)",
    "const first=()=>asFocusEntry();const second=()=>asFocusEntry();def.expose.value('same',first===first);def.expose.value('different',first!==second)",
  ])('excludes uninvoked host demand while retaining observed values: %s', (body) => {
    const result = emit(body);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.value.code).not.toContain('focus_setup_config(');
    expect(result.value.code).not.toContain('focus_setup(&owner');
    expect(result.value.code).toContain('configure_native_atoms(&owner_ref, false, false)');
  });

  it.each([
    'asFocusEntry()',
    'const install=()=>asFocusEntry();install()',
    'const install=()=>asFocusEntry();const alias=install;alias()',
    "const entry=asFocusEntry();entry.configure({mode:'auto'})",
    "const scope=asFocusScope();scope.configure({entryFallback:'entry'})",
    "const scope=asFocusScope();const config={entryFallback:'entry' as const};scope.configure(config)",
  ])('rejects unavailable physical focus without a fallback: %s', (body) => {
    const result = emit(body);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0]).toMatchObject({
      code: 'PUI_GPUI_SDK_CAPABILITY',
      category: 'unsupported-input',
    });
    expect(result.diagnostics[0].message).toContain('62e5991dd0f0c8a3af8d5e7e9c4652490d468db8');
    expect(result.diagnostics[0].message).toContain('resolve_focus_entry');
  });

  it('keeps logical scope, known focus handles and roving on the default SDK', () => {
    const result = emit(
      "asFocusable();const scope=asFocusScope();scope.configure({entry:'manual',emptyPolicy:'none'});const roving=asFocusRoving();roving.configure({loop:true})"
    );
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.ok).toBe(true);
  });

  it('ships an explicit ABI revision and no authored Transition machine in native support', () => {
    expect(GPUI_NATIVE_SDK_VERSION).toBe('0.2.0');
    const files = gpuiNativeSdkFiles();
    const manifest = files.find((file) => file.path.endsWith('/Cargo.toml'))!.contents;
    expect(manifest).toContain('experimental-focus-tree = []');
    expect(manifest).not.toMatch(/default\s*=.*experimental-focus-tree/);
    const owner = files.find((file) => file.path.endsWith('/gpui-native-owner.rs'))!.contents;
    expect(owner).not.toContain('TransitionModule');
    expect(owner).not.toContain('transition_complete');
    expect(owner).toContain('native_context_key');
    expect(owner).toContain('attempt_native_cleanup');
  });

  it('shares only the declared package Table family and checks its immutable ABI', () => {
    const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';
      import {TABLE_STRUCTURE_FAMILY} from '@proto.ui/module-table-structure';
      export default definePrototype({name:'table-family-abi',setup(def){
        def.anatomy.claim(TABLE_STRUCTURE_FAMILY,{role:'root'});return r=>r.el('div');
      }});`);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const emitted = emitGpuiSource(parsed.value);
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    const declaration = emitted.value.supportingFiles?.find((file) =>
      file.path.startsWith('.proto-ui/declaration/')
    );
    expect(declaration?.contents).toContain(
      'pub use crate::native::gpui_native_owner::TABLE_STRUCTURE_FAMILY as DECLARATION'
    );
    const forged = structuredClone(parsed.value);
    forged.staticDeclarations[0].config = { roles: { root: { cardinality: { min: 1, max: 2 } } } };
    const rejected = emitGpuiSource(forged);
    expect(rejected).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI_GPUI_STATIC_ABI' }] });
  });
});
