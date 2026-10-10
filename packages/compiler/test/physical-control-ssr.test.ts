// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { compilationArtifacts } from '../src/compile';
import { parsePrototype } from '../src/parser';
import { emitWebComponentSource } from '../src/web-component-source';
import { loadGeneratedModule } from './button-ssr-fixture';

type Kind = 'input' | 'textarea' | 'img' | 'host';
type Mode = 'light' | 'shadow';
interface Carrier {
  control: {
    tag: string;
    properties: Record<string, string | number | boolean | null>;
    attributes: Record<string, string>;
  } | null;
  attributes: Record<string, string>;
  baselines: Record<string, string>;
  interactionAttributes: Record<string, string | null>;
}
interface GeneratedHost extends HTMLElement {
  hydrationStatus: string;
  logicalOwner: symbol | null;
  connectedCallback(): void;
  setProps(props: Record<string, unknown>): void;
  dispose(): void;
}
interface BrowserPort {
  hydrationBaselines?: Record<string, string | null>;
  attribute(name: string, value: string | null): void;
  validateInitial(snapshot: { present: boolean; attributes: Record<string, string | null> }): void;
  commit(children: []): void;
  accept(): void;
  dispose(): void;
}
const fixtures = new Map<Kind, ReturnType<typeof compileFixture>>();
const mounted: GeneratedHost[] = [];
function compileFixture(kind: Kind) {
  const declaration =
    kind === 'host'
      ? ''
      : kind === 'img'
        ? "modules: [declareImageView({source:'', alternativeText:'', a11yMode:'decorative', fit:'contain'})],"
        : `modules: [declareTextControl({content:'plain-text', lineMode:'${kind === 'input' ? 'single' : 'multiline'}', engine:'host'})],`;
  const source = `import {definePrototype,tw} from '@proto.ui/core';
import {asAccessible,asTextControl,asImageView} from '@proto.ui/hooks';
import {declareTextControl} from '@proto.ui/module-text-control';
import {declareImageView} from '@proto.ui/module-image-view';
export default definePrototype({name:'physical-ssr-${kind}',${declaration}setup(def){
  def.props.define({role:{type:'string',default:'group'}});
  const role = def.state.string('role','group');
  const accessible = asAccessible();
  accessible.role(role);
  def.lifecycle.onCreated(run => role.set(run.props.get().role));
  def.props.watch(['role'], (_run,next) => role.set(next.role));
  def.feedback.style.use(tw('p-2'));
  ${kind === 'host' ? '' : kind === 'img' ? 'asImageView();' : "const editor = asTextControl(); def.lifecycle.onCreated(() => editor.sync({defaultValue:'server',valueMode:'uncontrolled'}));"}
  return () => null;
}});`;
  const parsed = parsePrototype(source);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const output = emitWebComponentSource(parsed.value, {
    ssr: true,
    tagName: `pui-physical-ssr-${kind}`,
    className: `Physical${kind}`,
  });
  if (!output.ok) throw new Error(JSON.stringify(output.diagnostics));
  const files = compilationArtifacts({ ir: parsed.value, output: output.value });
  const server = loadGeneratedModule(files, 'Component.ts') as unknown as {
    hydrationArtifacts: { css: string };
    renderToString(props: object, options: object): { html: string; carrier: Carrier };
  };
  const client = loadGeneratedModule(files, 'Component.client.ts') as { register(): void };
  const helper = loadGeneratedModule(files, '.proto-ui/web-component/ssr-v1.ts') as unknown as {
    createBrowserPort(
      host: HTMLElement,
      mode: Mode,
      carrier: Carrier,
      recovery: boolean
    ): BrowserPort;
  };
  client.register();
  return { server, helper, css: files.find((file) => file.path === 'Component.css')!.contents };
}
beforeAll(() => {
  for (const kind of ['input', 'textarea', 'img', 'host'] as const)
    fixtures.set(kind, compileFixture(kind));
});
afterEach(() => {
  for (const host of mounted.splice(0)) {
    host.dispose();
    host.remove();
  }
  document.body.replaceChildren();
  document.head.replaceChildren();
});
function prepare(kind: Kind, mode: Mode, rootAttributes: Record<string, string> = {}) {
  const fixture = fixtures.get(kind)!;
  const rendered = fixture.server.renderToString({ role: 'group' }, { mode, rootAttributes });
  const inert = document.createElement('template');
  inert.innerHTML = rendered.html;
  const host = inert.content.firstElementChild as GeneratedHost;
  const root =
    mode === 'shadow' ? (host.querySelector('template') as HTMLTemplateElement).content : host;
  const control = kind === 'host' ? host : (root.querySelector(kind) as HTMLElement);
  const script = host.querySelector('script')!;
  const style = document.createElement('style');
  style.setAttribute('data-pui-ssr-css', fixture.server.hydrationArtifacts.css);
  style.textContent = fixture.css;
  document.head.append(style);
  const original = host.connectedCallback;
  host.connectedCallback = () => {};
  document.body.append(host);
  host.connectedCallback = original;
  mounted.push(host);
  return { host, control, script, fixture, rendered };
}
const matrix = (['input', 'textarea', 'img'] as const).flatMap((kind) =>
  (['light', 'shadow'] as const).map((mode) => ({ kind, mode }))
);

describe('experimental physical Root SSR attribute ownership', () => {
  it.each(matrix)(
    'adopts $kind in $mode with distinct host and control attributes',
    ({ kind, mode }) => {
      const hostAttributes = { role: 'region', 'data-pui-style': 'host-owned' };
      const { host, control, rendered, script } = prepare(kind, mode, hostAttributes);
      expect(rendered.carrier).toEqual(JSON.parse(script.textContent!));
      expect(rendered.carrier.control?.attributes).toMatchObject({
        role: 'group',
        'data-pui-style': 'p-2',
      });
      expect(() => host.connectedCallback()).not.toThrow();
      expect(host.hydrationStatus).toBe('adopted');
      expect((host.shadowRoot ?? host).querySelector(kind)).toBe(control);
      expect(control.getAttribute('role')).toBe('group');
      expect(control.getAttribute('data-pui-style')).toBe('p-2');
      expect(host.getAttribute('role')).toBe('region');
      expect(host.getAttribute('data-pui-style')).toBe('host-owned');
      host.setProps({ role: 'note' });
      expect(control.getAttribute('role')).toBe('note');
      host.dispose();
      expect(control.getAttribute('role')).toBeNull();
      expect(control.getAttribute('data-pui-style')).toBeNull();
      expect(host.getAttribute('role')).toBe('region');
      expect(host.getAttribute('data-pui-style')).toBe('host-owned');
    }
  );

  it.each(matrix)(
    'adopts $kind in $mode when host has no projected attributes',
    ({ kind, mode }) => {
      const { host, control } = prepare(kind, mode);
      expect(host.hasAttribute('role')).toBe(false);
      expect(() => host.connectedCallback()).not.toThrow();
      expect(control.getAttribute('role')).toBe('group');
      expect(control.getAttribute('data-pui-style')).toBe('p-2');
    }
  );

  it.each(
    matrix.flatMap((entry) => ['role', 'data-pui-style'].map((name) => ({ ...entry, name })))
  )(
    'rejects changed physical $name on $kind in $mode without overwriting the server frame',
    ({ kind, mode, name }) => {
      const { host, control, fixture, rendered } = prepare(kind, mode);
      control.setAttribute(name, 'changed');
      const before = control.outerHTML;
      expect(() => fixture.helper.createBrowserPort(host, mode, rendered.carrier, false)).toThrow(
        /physical control attribute differs/
      );
      expect(() => host.connectedCallback()).toThrow(/physical control attribute differs/);
      expect(host.hydrationStatus).toBe('mismatch');
      expect(host.logicalOwner).toBeNull();
      expect(control.outerHTML).toBe(before);
      expect((host.shadowRoot ?? host).contains(control)).toBe(true);
    }
  );

  it.each(matrix)(
    'rejects mutually changed carrier and $kind in $mode using fresh client attributes',
    ({ kind, mode }) => {
      const { host, control, script } = prepare(kind, mode);
      const carrier = JSON.parse(script.textContent!);
      carrier.control.attributes.role = 'note';
      script.textContent = JSON.stringify(carrier);
      control.setAttribute('role', 'note');
      const before = control.outerHTML;
      expect(() => host.connectedCallback()).toThrow(/fresh client attribute differs: role/);
      expect(host.hydrationStatus).toBe('mismatch');
      expect(control.outerHTML).toBe(before);
    }
  );

  it.each(matrix)(
    'restores physical ownership independently of host baselines for $kind in $mode',
    ({ kind, mode }) => {
      const { host, control, fixture, rendered } = prepare(kind, mode, {
        role: 'region',
        'data-pui-style': 'host-owned',
      });
      const port = fixture.helper.createBrowserPort(host, mode, rendered.carrier, false);
      const roleBaseline = port.hydrationBaselines?.role ?? null;
      if (kind === 'img')
        expect(port.hydrationBaselines).toMatchObject({ alt: '', style: 'object-fit:contain' });
      if (kind === 'input')
        expect(port.hydrationBaselines).toMatchObject({ type: 'text', value: 'server' });
      if (kind === 'textarea') expect(port.hydrationBaselines).not.toHaveProperty('value');
      port.commit([]);
      port.accept();
      port.attribute('data-pui-style', 'p-4');
      port.dispose();
      expect(control.getAttribute('data-pui-style')).toBeNull();
      expect(roleBaseline).toBeNull();
      expect(host.getAttribute('data-pui-style')).toBe('host-owned');
    }
  );

  it.each(matrix)(
    'preserves newer external physical attributes at disposal for $kind in $mode',
    ({ kind, mode }) => {
      const { host, control } = prepare(kind, mode);
      host.connectedCallback();
      control.setAttribute('role', 'external');
      host.setProps({ role: 'note' });
      expect(control.getAttribute('role')).toBe('note');
      control.setAttribute('data-pui-style', 'external-style');
      host.dispose();
      expect(control.getAttribute('role')).toBe('external');
      expect(control.getAttribute('data-pui-style')).toBe('external-style');
    }
  );

  it.each(matrix)(
    'revalidates $kind physical attributes immediately before $mode commit',
    ({ kind, mode }) => {
      const { host, control, fixture, rendered } = prepare(kind, mode);
      const port = fixture.helper.createBrowserPort(host, mode, rendered.carrier, false);
      control.setAttribute('role', 'changed-after-validation');
      expect(() => port.commit([])).toThrow(/physical control attribute differs: role/);
      port.dispose();
    }
  );

  it.each(matrix)(
    'retains $kind physical property baselines separately from $mode host baselines',
    ({ kind, mode }) => {
      const { host, control, fixture, rendered } = prepare(kind, mode, { role: 'host-baseline' });
      // Explicit helper-level collision: the physical property precedes a generated projection.
      rendered.carrier.control!.properties.role = 'physical-baseline';
      const port = fixture.helper.createBrowserPort(host, mode, rendered.carrier, false);
      expect(port.hydrationBaselines?.role).toBe('physical-baseline');
      port.commit([]);
      port.accept();
      port.attribute('role', 'note');
      port.dispose();
      expect(control.getAttribute('role')).toBe('physical-baseline');
      expect(host.getAttribute('role')).toBe('host-baseline');
    }
  );

  it.each(
    (['input', 'textarea'] as const).flatMap((kind) =>
      (['light', 'shadow'] as const).map((mode) => ({ kind, mode }))
    )
  )(
    'retains pre-adoption $kind editing through $mode adoption and later updates',
    ({ kind, mode }) => {
      const { host, control } = prepare(kind, mode);
      const editor = control as HTMLInputElement | HTMLTextAreaElement;
      editor.value = 'already edited';
      editor.setSelectionRange(2, 5, 'backward');
      host.connectedCallback();
      expect(editor.value).toBe('already edited');
      expect([editor.selectionStart, editor.selectionEnd, editor.selectionDirection]).toEqual([
        2,
        5,
        'backward',
      ]);
      host.setProps({ role: 'note' });
      expect(editor.value).toBe('already edited');
    }
  );

  it.each(matrix)('keeps presence and physical tag checks for $kind in $mode', ({ kind, mode }) => {
    const { host, control, fixture, rendered } = prepare(kind, mode);
    const port = fixture.helper.createBrowserPort(host, mode, rendered.carrier, false);
    expect(() => port.validateInitial({ present: false, attributes: {} })).toThrow(
      /initial presence differs/
    );
    const replacement = document.createElement('div');
    control.replaceWith(replacement);
    expect(() => port.commit([])).toThrow(/physical control Root differs/);
    port.dispose();
  });

  // Shadow reconnect is a separately preserved failing mode-retention regression.
  it.each(matrix.filter(({ mode }) => mode === 'light'))(
    'releases the old $kind owner before a fresh $mode reconnect',
    async ({ kind, mode }) => {
      const { host, control } = prepare(kind, mode, { role: 'host-role' });
      host.connectedCallback();
      const owner = host.logicalOwner;
      host.remove();
      await Promise.resolve();
      expect(host.logicalOwner).toBeNull();
      expect(control.getAttribute('role')).toBeNull();
      expect(control.getAttribute('data-pui-style')).toBeNull();
      document.body.append(host);
      const fresh = (host.shadowRoot ?? host).querySelector(kind)!;
      expect(fresh).not.toBe(control);
      expect(host.logicalOwner).not.toBe(owner);
      expect(host.hydrationStatus).toBe('client');
      expect(fresh.getAttribute('role')).toBe('group');
      expect(fresh.getAttribute('data-pui-style')).toBe('p-2');
      expect(host.getAttribute('role')).toBe('host-role');
    }
  );

  it.each(['light', 'shadow'] as const)(
    'keeps host-only %s adoption and host baselines',
    (mode) => {
      const { host } = prepare('host', mode, { role: 'region', 'data-pui-style': 'host-owned' });
      expect(() => host.connectedCallback()).not.toThrow();
      expect(host.hydrationStatus).toBe('adopted');
      expect(host.getAttribute('role')).toBe('group');
      host.setProps({ role: 'note' });
      host.dispose();
      expect(host.getAttribute('role')).toBe('region');
      expect(host.getAttribute('data-pui-style')).toBe('host-owned');
    }
  );
});
