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
      const parsed = parsePrototype(source(`def.expose.method('sync',()=>scroll.sync(${patch}));`));
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
  it.each([
    'react-dom-source-v1',
    'vue-source-v1',
    'vue2-source-v1',
    'web-component-source-v1',
  ] as const)('keeps scroll.sync outside the %s source profile', (profile) => {
    const compiled = compilePrototype(
      source("def.expose.method('sync',()=>scroll.sync({axes:'horizontal'}));"),
      { profile }
    );
    expect(compiled.ok, JSON.stringify(compiled)).toBe(false);
    if (compiled.ok) return;
    const diagnostic = compiled.diagnostics.find(
      (entry) =>
        entry.code === 'PUI4003' &&
        entry.category === 'unsupported-input' &&
        entry.message.includes('scroll.sync')
    );
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.message).toContain(profile);
  });
  it.each(["{axes:'diagonal'}", '{axes:1}'])(
    'rejects values outside the bounded runtime axis contract: %s',
    (patch) => {
      expect(
        parsePrototype(source(`def.expose.method('sync',()=>scroll.sync(${patch}));`)).ok
      ).toBe(false);
    }
  );
  it('admits structural records without granting their extra fields policy authority', () => {
    // TypeScript permits a structurally assignable variable with extra fields;
    // the native consumer below verifies those fields do not change policy.
    const parsed = parsePrototype(
      source(`const patch:{axes:'horizontal';projection:'composed'}={axes:'horizontal',projection:'composed'};
      def.expose.method('sync',()=>scroll.sync(patch));`)
    );
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
  });
  it('keeps configure in setup and sync in callbacks', () => {
    expect(parsePrototype(source("scroll.sync({axes:'horizontal'});")).ok).toBe(false);
    expect(
      parsePrototype(source("def.expose.method('bad',()=>scroll.configure({axes:'horizontal'}));"))
        .ok
    ).toBe(false);
  });
});
