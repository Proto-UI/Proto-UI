// @vitest-environment happy-dom
import ts from 'typescript';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { parsePrototype } from './parser';
import { emitWebComponentSource } from './web-component-source';
const floatingUi = createRequire(
  fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url))
)('@floating-ui/dom');
import { afterEach, describe, expect, it } from 'vitest';
import { webComponentBrowserSupport } from './web-component-browser-support';
interface Frame {
  fragment: DocumentFragment;
  slot: { start: Comment; end: Comment } | null;
}
interface Builder {
  slot(): Node;
  finish(fragment: DocumentFragment): Frame;
}
interface RangeOwner {
  commit(frame: Frame): void;
  clear(): void;
  dispose(): void;
}
interface Port {
  createFrame(): Builder;
  projectRoot(tag: string, properties: Record<string, unknown>, portal: HTMLElement | null): void;
  commit(frame: Frame): void;
  clear(): void;
  dispose(): void;
}
interface GeneratedSupport {
  createNativeBrowserPort(host: HTMLElement, shadow: boolean): Port;
  createNativeFrame(document: Document, shadow: boolean): Builder;
  createNativeRangeOwner(host: HTMLElement, shadow: boolean): RangeOwner;
}
function generated(): GeneratedSupport {
  const parsed = parsePrototype(
    "import {definePrototype} from '@proto.ui/core';export default definePrototype({name:'native-range-fixture',setup(){return r=>r.el('div');}});",
    { fileName: 'native-range.proto.ts' }
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitWebComponentSource(parsed.value);
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const files = new Map(
    (emitted.value.supportingFiles ?? []).map((file) => [file.path, file.contents])
  );
  expect(files.has(webComponentBrowserSupport.path)).toBe(true);
  expect(files.get(webComponentBrowserSupport.path)).toBe(webComponentBrowserSupport.contents);
  const cache = new Map<string, Record<string, unknown>>();
  function load(file: string): Record<string, unknown> {
    const name = path.posix.normalize(file),
      previous = cache.get(name);
    if (previous) return previous;
    const input = files.get(name);
    if (input === undefined) throw new Error('Missing actual generated support: ' + name);
    const exports: Record<string, unknown> = {};
    cache.set(name, exports);
    const source = ts.transpileModule(input, {
      fileName: name,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function('exports', 'require', source)(exports, (specifier: string) => {
      if (specifier === '@floating-ui/dom') return floatingUi;
      if (!specifier.startsWith('.')) throw new Error('Unexpected native dependency: ' + specifier);
      const target = path.posix.join(path.posix.dirname(name), specifier);
      return load(target.endsWith('.ts') ? target : target + '.ts');
    });
    return exports;
  }
  return load(webComponentBrowserSupport.path) as unknown as GeneratedSupport;
}
const hosts: HTMLElement[] = [];
let customId = 0;
afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
});
function host() {
  const value = document.createElement('div');
  document.body.append(value);
  hosts.push(value);
  return value;
}
function frame(api: GeneratedSupport, shadow: boolean, text: string, withSlot = true) {
  const builder = api.createNativeFrame(document, shadow);
  const fragment = document.createDocumentFragment();
  const section = document.createElement('section');
  section.append(document.createTextNode(text));
  if (withSlot) section.append(builder.slot());
  fragment.append(section);
  return builder.finish(fragment);
}
describe('native WC range resource owner, no template interpreter', () => {
  it('emits no semantic tag/operation materializer', () => {
    expect(webComponentBrowserSupport.contents).not.toMatch(
      /Presentation|materialize|child\.kind|child\.tag|switch\s*\(/
    );
  });
  it('does not move live native children while a candidate frame is constructed or abandoned', () => {
    const api = generated(),
      root = host(),
      native = document.createElement('button');
    root.append(native);
    const owner = api.createNativeRangeOwner(root, false);
    owner.commit(frame(api, false, 'old'));
    const parent = native.parentNode;
    const original = root.innerHTML;
    const abandoned = frame(api, false, 'new');
    expect(abandoned.fragment.contains(native)).toBe(false);
    expect(native.parentNode).toBe(parent);
    expect(root.innerHTML).toBe(original);
    owner.dispose();
  });
  it('moves rather than clones external native children and preserves listeners', () => {
    const api = generated(),
      root = host(),
      native = document.createElement('button');
    root.append(native);
    let clicks = 0;
    native.addEventListener('click', () => clicks++);
    const owner = api.createNativeRangeOwner(root, false);
    owner.commit(frame(api, false, 'one'));
    native.click();
    owner.commit(frame(api, false, 'two'));
    native.click();
    expect(root.querySelector('button')).toBe(native);
    expect(clicks).toBe(2);
    owner.dispose();
    expect(native.parentNode).toBe(root);
    native.click();
    expect(clicks).toBe(3);
  });
  it('preserves foreign siblings and returns projected children when the next frame has no slot', () => {
    const api = generated(),
      root = host(),
      native = document.createElement('button');
    root.append(native);
    const owner = api.createNativeRangeOwner(root, false);
    owner.commit(frame(api, false, 'one'));
    owner.commit(frame(api, false, 'two', false));
    expect(native.parentNode).toBe(root);
    expect(root.querySelector('section')?.textContent).toBe('two');
    owner.clear();
    expect(root.childNodes.length).toBe(1);
    expect(root.firstChild).toBe(native);
    owner.dispose();
  });
  it('readmits a previously projected child returned to the host after one observer delivery', async () => {
    const api = generated(),
      root = host(),
      native = document.createElement('button');
    root.append(native);
    const owner = api.createNativeRangeOwner(root, false);
    owner.commit(frame(api, false, 'one'));
    root.append(native);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(native.parentElement?.localName).toBe('section');
    owner.dispose();
  });
  it('does not reclaim a native child deliberately transferred to another owner', () => {
    const api = generated(),
      root = host(),
      other = host(),
      native = document.createElement('button');
    root.append(native);
    const owner = api.createNativeRangeOwner(root, false);
    owner.commit(frame(api, false, 'one'));
    other.append(native);
    owner.commit(frame(api, false, 'two'));
    expect(native.parentNode).toBe(other);
    owner.dispose();
    expect(native.parentNode).toBe(other);
  });
  it('releases the whole slot container when a native consumer transfers it out', () => {
    const api = generated(),
      root = host(),
      other = host(),
      native = document.createElement('button');
    root.append(native);
    const owner = api.createNativeRangeOwner(root, false);
    owner.commit(frame(api, false, 'one'));
    const section = root.querySelector('section')!;
    other.append(section);
    owner.commit(frame(api, false, 'two'));
    expect(native.parentNode).toBe(section);
    expect(section.parentNode).toBe(other);
    owner.dispose();
    expect(native.parentNode).toBe(section);
    expect(section.parentNode).toBe(other);
  });
  it('does not steal external children into a shadow tree', () => {
    const api = generated(),
      root = host(),
      native = document.createElement('button');
    root.append(native);
    const owner = api.createNativeRangeOwner(root, true);
    owner.commit(frame(api, true, 'one'));
    expect(native.parentNode).toBe(root);
    expect(root.shadowRoot?.querySelector('slot')).not.toBeNull();
    owner.dispose();
    expect(root.shadowRoot?.childNodes.length).toBe(0);
    expect(native.parentNode).toBe(root);
  });
  it('rejects malformed frame ranges before removing the previous DOM', () => {
    const api = generated(),
      root = host(),
      owner = api.createNativeRangeOwner(root, false);
    owner.commit(frame(api, false, 'old'));
    const next = frame(api, false, 'new');
    next.slot!.end.remove();
    const old = root.innerHTML;
    expect(() => owner.commit(next)).toThrow(/slot range/);
    expect(root.innerHTML).toBe(old);
    owner.dispose();
  });
  it('rejects reversed or identical native slot boundaries before mutation', () => {
    const api = generated(),
      root = host(),
      owner = api.createNativeRangeOwner(root, false);
    owner.commit(frame(api, false, 'old'));
    const reversed = frame(api, false, 'new');
    reversed.slot!.end.parentNode!.insertBefore(reversed.slot!.end, reversed.slot!.start);
    const before = root.innerHTML;
    expect(() => owner.commit(reversed)).toThrow(/slot range/);
    expect(root.innerHTML).toBe(before);
    const next = frame(api, false, 'same');
    const invalid = {
      fragment: next.fragment,
      slot: { start: next.slot!.start, end: next.slot!.start },
    };
    expect(() => owner.commit(invalid)).toThrow(/slot range/);
    expect(root.innerHTML).toBe(before);
    owner.dispose();
  });
  it('rejects repeat frame consumption and commits after disposal', () => {
    const api = generated(),
      root = host(),
      owner = api.createNativeRangeOwner(root, false),
      next = frame(api, false, 'one');
    owner.commit(next);
    expect(() => owner.commit(next)).toThrow(/already committed/);
    owner.dispose();
    expect(() => owner.commit(frame(api, false, 'two'))).toThrow(/disposed/);
  });
  for (const trigger of ['connected', 'disconnected'] as const) {
    it(`honors terminal disposal reentered from a native child ${trigger}Callback`, () => {
      const api = generated(),
        root = host();
      let armed = false;
      let owner: RangeOwner;
      class ExternalChild extends HTMLElement {
        connectedCallback() {
          if (armed && trigger === 'connected') owner.dispose();
        }
        disconnectedCallback() {
          if (armed && trigger === 'disconnected') owner.dispose();
        }
      }
      const name = `native-resource-reentry-${++customId}`;
      customElements.define(name, ExternalChild);
      const native = document.createElement(name);
      root.append(native);
      owner = api.createNativeRangeOwner(root, false);
      owner.commit(frame(api, false, 'one'));
      armed = true;
      owner.commit(frame(api, false, 'two'));
      expect(native.parentNode).toBe(root);
      expect(root.querySelector('section')).toBeNull();
      expect(() => owner.commit(frame(api, false, 'three'))).toThrow(/disposed/);
      owner.dispose();
      expect(native.parentNode).toBe(root);
    });
  }
  it('enforces singular slots without making called-but-discarded slots live', () => {
    const api = generated(),
      builder = api.createNativeFrame(document, false);
    builder.slot();
    expect(() => builder.slot()).toThrow(/Multiple slots/);
    const fragment = document.createDocumentFragment();
    fragment.append(document.createElement('p'));
    expect(builder.finish(fragment).slot).toBeNull();
  });
});

for (const shadow of [false, true])
  for (const action of ['clear', 'dispose'] as const) {
    it(`does not remove a consumer-transferred physical control on ${action}, shadow=${shadow}`, () => {
      const api = generated(),
        root = host(),
        external = host();
      const port = api.createNativeBrowserPort(root, shadow);
      port.projectRoot('input', {}, null);
      const builder = port.createFrame();
      port.commit(builder.finish(document.createDocumentFragment()));
      const control = (root.shadowRoot ?? root).querySelector('input');
      expect(control).not.toBeNull();
      external.append(control!);
      port[action]();
      expect(control!.parentNode).toBe(external);
      port.dispose();
      expect(control!.parentNode).toBe(external);
    });
  }
