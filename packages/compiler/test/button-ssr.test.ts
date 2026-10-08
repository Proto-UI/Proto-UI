// @vitest-environment happy-dom
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { compileFile, compilePrototype, compilationArtifacts } from '../src/compile';
import { parsePrototype } from '../src/parser';
import { emitWebComponentSource } from '../src/web-component-source';
import { renderProtoStyleTokenCss } from '../../cli/src/services/proto-style-css';
import {
  baseButtonPath,
  buildButtonSsrFixture,
  compileButtonSsrFixture,
  loadGeneratedModule,
  repositoryRoot,
  type FixtureCarrier,
} from './button-ssr-fixture';

interface GeneratedButton extends HTMLElement {
  hydrationStatus: string;
  hydrationDiagnostic: { reason: string } | null;
  logicalOwner: symbol | null;
  connectedCallback(): void;
  setProps(next: Record<string, unknown>): void;
  getExposes(): { disabled: { get(): boolean }; focused: { get(): boolean }; focusSelf(): void };
  dispose(): void;
}
let fixture: Awaited<ReturnType<typeof buildButtonSsrFixture>>;
let client: { register(): void; hydrate(host: GeneratedButton): void };
const mounted: GeneratedButton[] = [];
beforeAll(async () => {
  fixture = await buildButtonSsrFixture({ tagName: 'pui-ssr-unit-button' });
  client = loadGeneratedModule(fixture.generatedFiles, 'Component.client.ts') as typeof client;
  client.register();
});
afterEach(() => {
  for (const element of mounted.splice(0)) {
    element.dispose();
    element.remove();
  }
  document.head.replaceChildren();
  document.body.replaceChildren();
});
function prepare(
  props: Record<string, unknown> = { disabled: false },
  mutate?: (carrier: FixtureCarrier) => void
) {
  const rendered = fixture.render(props, {
    slotHtml: '<span data-label>Save changes</span><span data-copy> selectable label</span>',
  });
  const inert = document.createElement('template');
  inert.innerHTML = rendered.html;
  const host = inert.content.firstElementChild as GeneratedButton;
  // This synthetic DOM starts with a registered element; real pre-definition upgrade is browser-only evidence.
  if (mutate) {
    const node = host.querySelector('script')!;
    const carrier = JSON.parse(node.textContent!);
    mutate(carrier);
    node.textContent = JSON.stringify(carrier);
  }
  const style = document.createElement('style');
  style.setAttribute('data-pui-ssr-css', fixture.provenance.cssSha256);
  style.textContent = fixture.cssText;
  document.head.append(style);
  mounted.push(host);
  return { host, rendered };
}
function attachWithoutAutoConnect(host: GeneratedButton) {
  const original = host.connectedCallback;
  host.connectedCallback = () => {};
  document.body.append(host);
  host.connectedCallback = original;
}

describe('experimental source-generated Button SSR', () => {
  it('lowers unchanged direct Base Button and its complete source-bound styled hook shell', async () => {
    const direct = await compileButtonSsrFixture({ direct: true });
    const server = loadGeneratedModule(compilationArtifacts(direct), 'Component.ts') as {
      renderToString(props: object, options: object): { html: string };
    };
    expect(
      server.renderToString({ disabled: true }, { slotHtml: 'Direct Base Button' }).html
    ).toContain('aria-disabled="true"');
    const input = await readFile(path.join(repositoryRoot, baseButtonPath), 'utf8');
    expect(fixture.provenance.sourceFiles).toContainEqual({
      file: baseButtonPath,
      sha256: createHash('sha256').update(input).digest('hex'),
    });
    expect(fixture.provenance.profile).toBe('web-component-ssr-v1');
    expect(fixture.generatedFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining(['Component.ts', 'Component.client.ts', 'Component.css'])
    );
    for (const file of fixture.generatedFiles.filter((file) => file.kind === 'source')) {
      expect(file.contents).not.toMatch(/from ['"]@proto\.ui\/(runtime|adapter-|core|hooks)/);
    }
    expect(fixture.clientCode).not.toContain('snapshot-prototype-style');
  });

  it('keeps all public SSR targets rejected, including this real source', async () => {
    const input = await readFile(path.join(repositoryRoot, baseButtonPath), 'utf8');
    for (const profile of [
      'react-dom-ssr-v1',
      'vue-ssr-v1',
      'vue2-ssr-v1',
      'web-component-ssr-v1',
    ]) {
      const result = compilePrototype(input, { profile });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.diagnostics[0].code).toBe('PUI4001');
    }
  });

  it('ships complete semantic HTML and the canonical CSS without importing the client', () => {
    const first = fixture.render({ disabled: false }, { slotHtml: '<span>Enabled</span>' });
    const second = fixture.render({ disabled: true }, { slotHtml: '<span>Disabled</span>' });
    expect(first.html).toContain('role="button"');
    expect(first.html).toContain('tabindex="0"');
    expect(second.html).toContain('tabindex="-1"');
    expect(second.html).toContain('aria-disabled="true"');
    expect(second.carrier.attributes['data-pui-style']).toContain('opacity-50');
    expect(first.html).toContain('<span>Enabled</span>');
    const tokens = new Set([
      ...first.carrier.attributes['data-pui-style'].split(' '),
      ...second.carrier.attributes['data-pui-style'].split(' '),
    ]);
    expect(fixture.cssText).toBe(renderProtoStyleTokenCss([...tokens].sort()));
    expect(fixture.cssText).toContain('user-select: text');
    expect(fixture.cssText).toContain('box-sizing: border-box');
  });

  it('adopts original children, focus and selection without duplicate owners or activation', () => {
    const { host } = prepare();
    attachWithoutAutoConnect(host);
    const label = host.querySelector('[data-label]')!;
    const nodes = [...host.childNodes].filter(
      (node) => node.nodeType !== 1 || (node as Element).localName !== 'script'
    );
    host.focus();
    const range = document.createRange();
    range.selectNodeContents(label);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
    host.connectedCallback();
    expect(host.hydrationStatus).toBe('adopted');
    expect(host.querySelector('[data-label]')).toBe(label);
    expect([...host.childNodes]).toEqual(nodes);
    expect(document.activeElement).toBe(host);
    expect(document.getSelection()!.toString()).toBe('Save changes');
    expect(host.getExposes().focused.get()).toBe(true);
    const owner = host.logicalOwner;
    client.hydrate(host);
    host.connectedCallback();
    expect(host.logicalOwner).toBe(owner);
    let effects = 0;
    host.addEventListener('click', (event) => {
      if (event instanceof CustomEvent) ++effects;
    });
    host.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(effects).toBe(1);
    host.setProps({ disabled: true });
    expect(host.getExposes().disabled.get()).toBe(true);
    host.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(effects).toBe(1);
    host.dispose();
    host.dispose();
    host.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(effects).toBe(1);
  });

  it.each(['source', 'profile', 'helpers', 'css', 'raw', 'presentation', 'attributes'])(
    'rejects %s carrier mismatch and preserves the original first frame',
    (kind) => {
      const { host } = prepare(undefined, (carrier) => {
        if (kind === 'source') carrier.binding = '0'.repeat(64);
        if (kind === 'profile') carrier.profile = 'react-dom-ssr-v1';
        if (kind === 'helpers' || kind === 'css') carrier.artifacts[kind] = '0'.repeat(64);
        if (kind === 'raw') (carrier.raw[0] as [string, { value: boolean }])[1].value = true;
        if (kind === 'presentation')
          carrier.presentation = [{ kind: 'text', text: 'Not the source' }];
        if (kind === 'attributes') carrier.attributes.role = 'link';
      });
      attachWithoutAutoConnect(host);
      const before = host.outerHTML,
        children = [...host.childNodes];
      expect(() => host.connectedCallback()).toThrow(/hydration mismatch/i);
      expect(host.hydrationStatus).toBe('mismatch');
      expect(host.outerHTML).toBe(before);
      expect([...host.childNodes]).toEqual(children);
      expect(host.logicalOwner).toBeNull();
    }
  );

  it('retains first-frame nodes and attributes when fresh generated presentation disagrees after carrier matching', () => {
    const { host } = prepare();
    const script = host.querySelector('script')!;
    const carrier = JSON.parse(script.textContent!);
    carrier.presentation = [{ kind: 'text', text: 'Preserve this first frame' }];
    script.textContent = JSON.stringify(carrier);
    host.replaceChildren(
      document.createComment('pui-root-start'),
      document.createTextNode('Preserve this first frame'),
      document.createComment('pui-root-end'),
      script
    );
    attachWithoutAutoConnect(host);
    const before = host.outerHTML,
      nodes = [...host.childNodes];
    expect(() => host.connectedCallback()).toThrow(/fresh client presentation differs/);
    expect(host.hydrationStatus).toBe('mismatch');
    expect(host.outerHTML).toBe(before);
    expect([...host.childNodes]).toEqual(nodes);
  });

  it('releases generated global listeners and slot observers across repeated init and disposal', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const observe = vi.spyOn(window.MutationObserver.prototype, 'observe');
    const disconnect = vi.spyOn(window.MutationObserver.prototype, 'disconnect');
    try {
      for (let index = 0; index < 12; ++index) {
        const { host } = prepare();
        document.body.append(host);
        expect(host.hydrationStatus).toBe('adopted');
        host.connectedCallback();
        client.hydrate(host);
        host.dispose();
        host.dispose();
        host.remove();
        expect(host.logicalOwner).toBeNull();
      }
      const relevant = add.mock.calls.filter(([type]) =>
        ['keydown', 'keyup', 'pointerdown', 'pointerup', 'pointercancel', 'click'].includes(type)
      );
      expect(relevant.length).toBeGreaterThan(0);
      for (const [type, listener] of relevant)
        expect(remove.mock.calls.some((call) => call[0] === type && call[1] === listener)).toBe(
          true
        );
      expect(observe.mock.calls.length).toBe(12);
      expect(disconnect.mock.calls.length).toBe(12);
    } finally {
      add.mockRestore();
      remove.mockRestore();
      observe.mockRestore();
      disconnect.mockRestore();
    }
  });

  it('rejects initial client props and missing/altered stylesheet without removing server content', () => {
    const { host } = prepare();
    attachWithoutAutoConnect(host);
    host.setProps({ disabled: true });
    const before = host.outerHTML;
    expect(() => host.connectedCallback()).toThrow(/initial props differ/);
    expect(host.outerHTML).toBe(before);
    const other = prepare().host;
    attachWithoutAutoConnect(other);
    document.head.replaceChildren();
    const original = other.outerHTML;
    expect(() => other.connectedCallback()).toThrow(/CSS artifact/);
    expect(other.outerHTML).toBe(original);
  });

  it('detects changed actual source and unsupported authored capability instead of substituting a toy implementation', async () => {
    const baseline = await compileButtonSsrFixture();
    const files = Object.fromEntries(
      baseline.ir.sourceFiles.map((file) => [file.file, file.content])
    );
    const changed = {
      ...files,
      [baseButtonPath]: files[baseButtonPath].replace(
        "accessible.role('button')",
        "accessible.role('link')"
      ),
    };
    const result = await compileFile(path.join(repositoryRoot, fixtureButtonPathForTest()), {
      profile: 'web-component-source-v1',
      sourceSnapshot: { entry: baseline.ir.source.file, files: changed },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const emitted = emitWebComponentSource(result.value.ir, {
      ssr: true,
      tagName: fixture.tagName,
      className: 'CompiledButton',
    });
    expect(emitted.ok).toBe(true);
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    const changedServer = loadGeneratedModule(
      compilationArtifacts({ ir: result.value.ir, output: emitted.value }),
      'Component.ts'
    );
    expect(changedServer.hydrationBinding).not.toBe(fixture.provenance.binding);
    const unsupported = {
      ...files,
      [baseButtonPath]: files[baseButtonPath].replace(
        '  const accessible = asAccessible();',
        '  const captured = globalThis.document;\n  const accessible = asAccessible();'
      ),
    };
    const rejected = await compileFile('', {
      profile: 'web-component-source-v1',
      sourceSnapshot: { entry: baseline.ir.source.file, files: unsupported },
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.diagnostics[0].span.file).toBe(baseButtonPath);
  });

  it('refuses known grammar tokens with missing CSS recipes rather than emitting an incomplete first frame', () => {
    const parsed = parsePrototype(
      "import {definePrototype,tw} from '@proto.ui/core'; export default definePrototype({name:'css-negative',setup(def){def.feedback.style.use(tw('text-black'));}});"
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    for (const className of [
      'hydrationArtifacts',
      'hydrationCssText',
      'checkInitialProps',
      'checkStylesheet',
    ]) {
      expect(emitWebComponentSource(parsed.value, { ssr: true, className })).toMatchObject({
        ok: false,
        diagnostics: [{ message: expect.stringContaining('non-reserved') }],
      });
    }
    const emitted = emitWebComponentSource(parsed.value, { ssr: true });
    expect(emitted).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI3301', message: expect.stringContaining('complete CSS artifact') }],
    });
  });

  it('allocates distinct IDs for two instances and independent requests', () => {
    const all = Array.from({ length: 20 }, () => fixture.render().carrier);
    expect(new Set(all.map((carrier) => carrier.instanceId)).size).toBe(all.length);
    expect(new Set(all.map((carrier) => carrier.attributes.id)).size).toBe(all.length);
  });
});
function fixtureButtonPathForTest() {
  return 'packages/compiler/test/fixtures/button-ssr/button.proto.ts';
}
