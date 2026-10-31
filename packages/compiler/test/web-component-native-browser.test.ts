// @vitest-environment happy-dom
// #1061 regression preparation: generated consumers, not authored-source evaluation.
// Happy DOM controls do not replace real browser focus/layout/slot evidence.
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitWebComponentSource } from '../src/web-component-source';
const floatingUi = createRequire(
  fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url))
)('@floating-ui/dom');
interface NativeElement extends HTMLElement {
  logicalOwner: symbol | null;
  update(): void;
  getExposes(): { bump?: (next: number) => void };
  dispose(): void;
}
let nextTag = 0;
const mounted: NativeElement[] = [];
afterEach(() => {
  for (const host of mounted.splice(0)) {
    host.dispose();
    host.remove();
  }
});
function create(source: string, shadow: boolean): NativeElement {
  const parsed = parsePrototype(source, { fileName: 'independent.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitWebComponentSource(parsed.value, { shadow });
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  // Execute the generated consumer, not authored input and not an IR interpreter.
  const sources = new Map(
    (emitted.value.supportingFiles ?? []).map((file) => [file.path, file.contents])
  );
  sources.set('component.ts', emitted.value.code);
  const modules = new Map<string, Record<string, unknown>>();
  function load(file: string): Record<string, unknown> {
    const name = path.posix.normalize(file);
    const existing = modules.get(name);
    if (existing) return existing;
    const source = sources.get(name);
    if (source === undefined) throw new Error(`Missing generated module: ${name}`);
    const exports: Record<string, unknown> = {};
    modules.set(name, exports);
    const program = ts.transpileModule(source, {
      fileName: name,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function('exports', 'require', program)(exports, (specifier: string) => {
      if (specifier === '@floating-ui/dom') return floatingUi;
      if (!specifier.startsWith('.')) throw new Error(`Unexpected native dependency: ${specifier}`);
      const target = path.posix.join(path.posix.dirname(name), specifier);
      return load(target.endsWith('.ts') ? target : `${target}.ts`);
    });
    return exports;
  }
  const register = load('component.ts').register as (name: string) => CustomElementConstructor;
  const tag = `x-native-lowering-1061-${++nextTag}`;
  if (!register) throw new Error('Registration API missing');
  register(tag);
  const element = document.createElement(tag) as NativeElement;
  mounted.push(element);
  return element;
}
const aliasSource = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'native-alias-composition', setup(def){
  const count=def.state.numberDiscrete('native.count', 1);
  def.expose.method('bump',(next:number)=>{count.set(next);});
  return (r)=>{const child=r.el('span',count.get());return r.el('section',[child,child,r.slot()]);};
}});`;
const repeatSource = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'native-helper-composition', setup(def){
  return (r)=>{const make=()=>r.el('span','child');const alias=make;return r.el('section',[alias(),alias(),r.slot()]);};
}});`;

const mixedSource = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'native-mixed-helper',setup(def){
  const count=def.state.numberDiscrete('native.mixed',1);def.expose.method('bump',(next:number)=>{count.set(next);});
  return r=>{const choose=()=>{if(count.get()>0)return r.el('span','positive');return 'negative';};return r.el('section',[choose(),r.slot()]);};
}});`;

// C-TEMPLATE-0001/2/4/5 (draft): structural occurrences vs one singular native slot.
// Thin compiler completion standard: a representation change cannot erase an admitted occurrence.
for (const shadow of [false, true]) {
  describe(`native browser lowering, shadow=${shadow}`, () => {
    it('constructs a legal tag-only empty element', () => {
      const host = create(
        "import {definePrototype} from '@proto.ui/core';export default definePrototype({name:'native-empty-el',setup(){return r=>r.el('div');}});",
        shadow
      );
      document.body.append(host);
      const child = (host.shadowRoot ?? host).querySelector('div');
      expect(child).not.toBeNull();
      expect(child?.childNodes.length).toBe(0);
    });
    it('constructs a legal props-only empty element retaining its style', () => {
      const host = create(
        "import {definePrototype,tw} from '@proto.ui/core';const style=tw('bg-white');export default definePrototype({name:'native-props-only-el',setup(){return r=>r.el('div',{style});}});",
        shadow
      );
      document.body.append(host);
      const child = (host.shadowRoot ?? host).querySelector('div');
      expect(child).not.toBeNull();
      expect(child?.childNodes.length).toBe(0);
      expect(child?.getAttribute('data-pui-style')).toContain('bg-white');
    });
    it('preserves style props through an authored alias', () => {
      // A three-argument aliased props call is still an existing target limitation.
      // Keep that diagnostic explicit rather than claiming its runtime is admitted.
      const unsupported = parsePrototype(
        "import {definePrototype,tw} from '@proto.ui/core';const style=tw('bg-white');export default definePrototype({name:'native-style-alias-unsupported',setup(){return r=>{const p={style};return r.el('div',p,'text');};}});",
        { fileName: 'independent.proto.ts' }
      );
      expect(unsupported.ok).toBe(true);
      if (unsupported.ok) {
        const emitted = emitWebComponentSource(unsupported.value, { shadow });
        expect(emitted.ok).toBe(false);
        if (!emitted.ok) expect(emitted.diagnostics.some((d) => d.code === 'PUI3302')).toBe(true);
      }

      const source =
        "import {definePrototype,tw} from '@proto.ui/core';const style=tw('bg-white');export default definePrototype({name:'native-style-alias',setup(){return r=>{const p={style};return r.el('section',[r.el('div',{style}),r.el('div',p),r.el('div',p)]);};}});";
      const host = create(source, shadow);
      document.body.append(host);
      const children = (host.shadowRoot ?? host).querySelectorAll('section > div');
      expect(children.length).toBe(3);
      expect(Array.from(children, (e) => e.getAttribute('data-pui-style'))).toEqual([
        'bg-white',
        'bg-white',
        'bg-white',
      ]);
      expect(Array.from(children, (e) => e.textContent)).toEqual(['', '', '']);
    });
    it('preserves an aliased empty props record as props rather than a child', () => {
      const host = create(
        "import {definePrototype} from '@proto.ui/core';export default definePrototype({name:'native-empty-props-alias',setup(){return r=>{const p={};return r.el('div',p);};}});",
        shadow
      );
      document.body.append(host);
      const child = (host.shadowRoot ?? host).querySelector('div');
      expect(child).not.toBeNull();
      expect(child?.childNodes.length).toBe(0);
    });
    it('does not reinterpret an explicit undefined capture as an omitted child', () => {
      const parsed = parsePrototype(
        "import {definePrototype} from '@proto.ui/core';export default definePrototype({name:'native-explicit-undefined',setup(){return r=>r.el('div',undefined);}});",
        { fileName: 'independent.proto.ts' }
      );
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.diagnostics.some((d) => d.code === 'PUI1005')).toBe(true);
    });
    it('retains both occurrences of one authored template value', () => {
      const host = create(aliasSource, shadow);
      document.body.append(host);
      const root = host.shadowRoot ?? host;
      const spans = root.querySelectorAll('section > span');
      expect(spans.length).toBe(2);
      expect(spans[0]).not.toBe(spans[1]);
      expect(Array.from(spans, (x) => x.textContent)).toEqual(['1', '1']);
    });
    it('retains two aliased helper calls, not one cached DOM node', () => {
      const host = create(repeatSource, shadow);
      document.body.append(host);
      const spans = (host.shadowRoot ?? host).querySelectorAll('section > span');
      expect(spans.length).toBe(2);
      expect(spans[0]).not.toBe(spans[1]);
    });
    it('preserves external native child identity and listeners through update and disposal', async () => {
      const host = create(aliasSource, shadow);
      const child = document.createElement('button');
      child.textContent = 'native child';
      let clicks = 0;
      child.addEventListener('click', () => clicks++);
      host.append(child);
      document.body.append(host);
      const owner = host.logicalOwner;
      expect(owner).not.toBeNull();
      child.click();
      expect(clicks).toBe(1);
      host.getExposes().bump?.(9);
      expect(
        Array.from(
          (host.shadowRoot ?? host).querySelectorAll('section > span'),
          (x) => x.textContent
        )
      ).toEqual(['1', '1']);
      host.update();
      await Promise.resolve();
      expect(
        Array.from(
          (host.shadowRoot ?? host).querySelectorAll('section > span'),
          (x) => x.textContent
        )
      ).toEqual(['9', '9']);
      expect(host.contains(child)).toBe(true);
      child.click();
      expect(clicks).toBe(2);
      expect(host.logicalOwner).toBe(owner);
      host.dispose();
      expect(child.parentNode).toBe(host);
      child.click();
      expect(clicks).toBe(3);
    });
    it('preserves a helper returning a template or scalar without a generic runtime tree', async () => {
      const host = create(mixedSource, shadow);
      document.body.append(host);
      const root = host.shadowRoot ?? host;
      expect(root.querySelector('section > span')?.textContent).toBe('positive');
      host.getExposes().bump?.(-1);
      host.update();
      await Promise.resolve();
      expect(root.querySelector('section > span')).toBeNull();
      expect(root.querySelector('section')?.textContent).toBe('negative');
    });
    for (const ending of ['return;', ''] as const) {
      it(`preserves parser rejection for helper ${ending ? 'bare return' : 'implicit fall-through'} rather than claiming runtime coverage`, () => {
        const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'native-empty-helper',setup(def){
  const count=def.state.numberDiscrete('native.empty',1);def.expose.method('bump',(next:number)=>{count.set(next);});
  return r=>{const choose=()=>{if(count.get()>0)return r.el('span','positive');${ending}};return r.el('section',[choose(),r.slot()]);};
}});`;
        const parsed = parsePrototype(source, { fileName: 'independent.proto.ts' });
        expect(parsed.ok).toBe(false);
        if (!parsed.ok) expect(parsed.diagnostics.some((d) => d.code === 'PUI1006')).toBe(true);
      });
    }
    it('ends the owner after actual disconnect and creates a new owner on reattach', async () => {
      const host = create(aliasSource, shadow);
      document.body.append(host);
      const first = host.logicalOwner;
      expect(first).not.toBeNull();
      const old = host.getExposes();
      host.remove();
      await Promise.resolve();
      expect(host.logicalOwner).toBeNull();
      expect(() => old.bump?.(5)).toThrow(/disposed/);
      document.body.append(host);
      expect(host.logicalOwner).not.toBeNull();
      expect(host.logicalOwner).not.toBe(first);
      expect((host.shadowRoot ?? host).querySelectorAll('section > span').length).toBe(2);
    });
    it('preserves owner across a same-turn native host relocation', async () => {
      const host = create(aliasSource, shadow);
      const first = document.createElement('div');
      const second = document.createElement('div');
      document.body.append(first, second);
      first.append(host);
      const owner = host.logicalOwner;
      expect(owner).not.toBeNull();
      second.append(host);
      await Promise.resolve();
      expect(host.logicalOwner).toBe(owner);
      expect((host.shadowRoot ?? host).querySelectorAll('section > span').length).toBe(2);
      host.dispose();
      host.remove();
      first.remove();
      second.remove();
    });
  });
}

describe('ordinary browser output representation', () => {
  it.each([aliasSource, repeatSource, mixedSource])(
    'does not deliver the SSR Presentation interpreter',
    (source) => {
      const parsed = parsePrototype(source, { fileName: 'native-boundary.proto.ts' });
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      const emitted = emitWebComponentSource(parsed.value);
      if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
      expect(emitted.value.code).not.toContain("from './.proto-ui/web-component/ssr-v1'");
      expect(emitted.value.supportingFiles?.map((file) => file.path)).not.toContain(
        '.proto-ui/web-component/ssr-v1.ts'
      );
      expect(emitted.value.code).not.toMatch(
        /presentationElement|presentationChildren|type Presentation/
      );
    }
  );
});
