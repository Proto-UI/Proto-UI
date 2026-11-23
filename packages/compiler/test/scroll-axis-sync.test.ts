// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { emitGpuiSource } from '../src/gpui-source';
import { compilePrototype } from '../src/compile';

const source = (body: string) => `import {definePrototype} from '@proto.ui/core';
import {asScrollSurface} from '@proto.ui/hooks';
export default definePrototype({name:'axis-session',setup(def){
const scroll=asScrollSurface();scroll.configure({axes:'vertical',projection:'system'});
${body}
return r=>r.slot();}});`;

describe('C-SCROLL-AXIS-SYNC-0001 callback-only axis updates', () => {
  it.each(['{}', "{axes:'horizontal'}", "{axes:'vertical'}", "{axes:'both'}"])(
    'retains the checked callback and lowers its atomic native operation: %s',
    (patch) => {
      const text = source(`def.expose.method('sync',()=>scroll.sync(${patch}));`);
      const compiled = compilePrototype(text, { profile: 'gpui-source-v1' });
      expect(compiled.ok, JSON.stringify(compiled.ok ? {} : compiled.diagnostics)).toBe(true);
      if (compiled.ok) expect(compiled.value.output.code).toContain('scroll_sync(');
      const parsed = parsePrototype(text);
      expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
      if (!parsed.ok) return;
      const restored = validateIR(JSON.parse(JSON.stringify(parsed.value)));
      expect(restored.ok, JSON.stringify(restored)).toBe(true);
      if (!restored.ok) return;
      const emitted = emitGpuiSource(restored.value);
      expect(emitted.ok, JSON.stringify(emitted.ok ? {} : emitted)).toBe(true);
      if (emitted.ok) expect(emitted.value.code).toContain('scroll_sync(');
    }
  );
  it.each(["{axes:'diagonal'}", '{axes:1}'])(
    'rejects values outside the bounded runtime axis contract: %s',
    (patch) => {
      const text = source(`def.expose.method('sync',()=>scroll.sync(${patch}));`);
      expect(parsePrototype(text).ok).toBe(false);
      expect(compilePrototype(text, { profile: 'gpui-source-v1' }).ok).toBe(false);
    }
  );
  it('admits structural records without granting their extra fields policy authority', () => {
    // TypeScript permits a structurally assignable variable with extra fields;
    // the native consumer below verifies those fields do not change policy.
    const text =
      source(`const patch:{axes:'horizontal';projection:'composed'}={axes:'horizontal',projection:'composed'};
      def.expose.method('sync',()=>scroll.sync(patch));`);
    const parsed = parsePrototype(text);
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    const compiled = compilePrototype(text, { profile: 'gpui-source-v1' });
    expect(compiled.ok, JSON.stringify(compiled.ok ? {} : compiled.diagnostics)).toBe(true);
  });
  it('keeps configure in setup and sync in callbacks', () => {
    for (const body of [
      "scroll.sync({axes:'horizontal'});",
      "def.expose.method('bad',()=>scroll.configure({axes:'horizontal'}));",
    ]) {
      expect(parsePrototype(source(body)).ok).toBe(false);
      expect(compilePrototype(source(body), { profile: 'gpui-source-v1' }).ok).toBe(false);
    }
  });
  it('does not admit an unknown Scroll operation through the public GPUI entry', () => {
    const compiled = compilePrototype(source("def.expose.method('bad',()=>scroll.unknown());"), {
      profile: 'gpui-source-v1',
    });
    expect(compiled.ok).toBe(false);
  });
  it.each([
    'react-dom-source-v1',
    'vue-source-v1',
    'vue2-source-v1',
    'web-component-source-v1',
    'qt-source-v1',
    'flutter-source-v1',
  ] as const)('does not widen %s admission in this GPUI repair', (profile) => {
    const compiled = compilePrototype(
      source("def.expose.method('sync',()=>scroll.sync({axes:'horizontal'}));"),
      { profile }
    );
    expect(compiled.ok).toBe(false);
    if (!compiled.ok) {
      const unimplemented = profile === 'qt-source-v1' || profile === 'flutter-source-v1';
      expect(
        compiled.diagnostics.some(
          (entry) =>
            entry.code === (unimplemented ? 'PUI4001' : 'PUI4003') &&
            entry.message.includes(unimplemented ? profile : 'scroll.sync')
        )
      ).toBe(true);
    }
  });
});
