// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { compilationArtifacts } from '../src/compile';
import { parsePrototype } from '../src/parser';
import { emitWebComponentSource } from '../src/web-component-source';
import { loadGeneratedModule } from './button-ssr-fixture';

type Kind = 'input' | 'textarea' | 'img' | 'host';
type Mode = 'light' | 'shadow';
interface Carrier {
  mode: Mode;
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
  disconnectedCallback(): void;
  hydrate(carrier: Carrier): void;
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

  it.each(matrix)(
    'releases the old $kind owner before a fresh $mode reconnect',
    async ({ kind, mode }) => {
      const { host, control } = prepare(kind, mode, { role: 'host-role' });
      host.connectedCallback();
      let previous = control;
      for (let cycle = 0; cycle < 3; cycle++) {
        const owner = host.logicalOwner;
        host.remove();
        await Promise.resolve();
        expect(host.logicalOwner).toBeNull();
        expect(previous.getAttribute('role')).toBeNull();
        expect(previous.getAttribute('data-pui-style')).toBeNull();
        document.body.append(host);
        const root = mode === 'shadow' ? host.shadowRoot! : host;
        const fresh = root.querySelector(kind)!;
        expect(fresh).not.toBeNull();
        expect(fresh).not.toBe(previous);
        expect(root.querySelectorAll(kind)).toHaveLength(1);
        if (mode === 'shadow') expect(host.querySelector(kind)).toBeNull();
        expect(host.logicalOwner).not.toBe(owner);
        expect(host.hydrationStatus).toBe('client');
        expect(fresh.getAttribute('role')).toBe('group');
        expect(fresh.getAttribute('data-pui-style')).toBe('p-2');
        expect(host.getAttribute('role')).toBe('host-role');
        previous = fresh;
      }
    }
  );

  it.each(['mismatch', 'accept-throws'] as const)(
    'does not retain shadow mode after %s and a consumer reset to client-only',
    (failure) => {
      const { host, script, control } = prepare('input', 'shadow');
      const remove = script.remove.bind(script);
      const sentinel = new Error('injected accept failure');
      if (failure === 'accept-throws')
        script.remove = () => {
          throw sentinel;
        };
      else control.setAttribute('role', 'mismatched');
      if (failure === 'accept-throws') expect(() => host.connectedCallback()).toThrow(sentinel);
      else expect(() => host.connectedCallback()).toThrow(/physical control attribute differs/);
      expect(host.logicalOwner).toBeNull();
      // Consumer explicitly discards the failed transport and old frame. The remaining
      // shadowRoot alone must not be treated as an accepted mode/ownership receipt.
      script.remove = remove;
      remove();
      host.shadowRoot!.replaceChildren();
      for (const name of ['data-pui-ssr', 'data-pui-instance', 'data-pui-props'])
        host.removeAttribute(name);
      host.connectedCallback();
      expect(host.hydrationStatus).toBe('client');
      expect(host.querySelector('input')).not.toBeNull();
      expect(host.shadowRoot!.querySelector('input')).toBeNull();
    }
  );

  it('does not record accepted shadow mode when accept reentrantly disposes the element', async () => {
    const { host, script } = prepare('input', 'shadow');
    const remove = script.remove.bind(script);
    script.remove = () => {
      remove();
      host.dispose();
    };
    expect(() => host.connectedCallback()).not.toThrow();
    expect(host.logicalOwner).toBeNull();
    // Narrow white-box guard probe: the public terminal behavior below must also hold.
    expect(Reflect.get(host, 'acceptedMode') ?? null).toBeNull();
    host.remove();
    await Promise.resolve();
    document.body.append(host);
    expect(host.logicalOwner).toBeNull();
    expect(host.shadowRoot!.querySelector('input')).toBeNull();
    expect(host.querySelector('input')).toBeNull();
    expect(() => host.setProps({ role: 'note' })).toThrow(/disposed/);
  });

  it('keeps the current owner during an accept-time synchronous move and retains its mode later', async () => {
    const { host, script } = prepare('input', 'shadow');
    const remove = script.remove.bind(script);
    let during: symbol | null = null;
    script.remove = () => {
      remove();
      during = host.logicalOwner;
      host.remove();
      document.body.append(host);
    };
    host.connectedCallback();
    await Promise.resolve();
    expect(host.hydrationStatus).toBe('adopted');
    expect(host.logicalOwner).toBe(during);
    expect(host.shadowRoot!.querySelectorAll('input')).toHaveLength(1);
    host.remove();
    await Promise.resolve();
    document.body.append(host);
    expect(host.logicalOwner).not.toBe(during);
    expect(host.shadowRoot!.querySelectorAll('input')).toHaveLength(1);
    expect(host.querySelector('input')).toBeNull();
  });

  it.each(['light', 'shadow'] as const)(
    'keeps terminal disposal terminal after %s acceptance',
    async (mode) => {
      const { host } = prepare('input', mode);
      host.connectedCallback();
      host.dispose();
      host.remove();
      await Promise.resolve();
      document.body.append(host);
      expect(host.logicalOwner).toBeNull();
      expect((host.shadowRoot ?? host).querySelector('input')).toBeNull();
      expect(() => host.setProps({ role: 'note' })).toThrow(/disposed/);
    }
  );

  it.each(['open', 'closed'] as const)(
    'does not claim an arbitrary user-owned %s shadow root on client initialization',
    (mode) => {
      const host = document.createElement('pui-physical-ssr-input') as GeneratedHost;
      const shadow = host.attachShadow({ mode });
      const sentinel = document.createElement('span');
      sentinel.textContent = 'User-owned content';
      shadow.append(sentinel);
      mounted.push(host);
      document.body.append(host);
      expect(host.hydrationStatus).toBe('client');
      expect(host.querySelector('input')).not.toBeNull();
      expect(shadow.querySelector('input')).toBeNull();
      expect(shadow.firstChild).toBe(sentinel);
      host.dispose();
      expect(shadow.firstChild).toBe(sentinel);
    }
  );

  it('rejects an inaccessible closed shadow root for explicit shadow SSR without claiming it', () => {
    const { host, rendered } = prepare('input', 'shadow');
    const template = host.querySelector('template') as HTMLTemplateElement;
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.append(template.content);
    template.remove();
    const original = shadow.firstChild;
    expect(() => host.hydrate(rendered.carrier)).toThrow(/declarative Shadow Root is absent/);
    expect(host.logicalOwner).toBeNull();
    expect(shadow.firstChild).toBe(original);
  });

  it.each(['light', 'shadow'] as const)(
    'honors an explicit %s carrier before reading the embedded carrier',
    (mode) => {
      const { host, script, rendered, control } = prepare('input', mode);
      const embedded = JSON.parse(script.textContent!);
      embedded.mode = mode === 'light' ? 'shadow' : 'light';
      script.textContent = JSON.stringify(embedded);
      expect(() => host.hydrate(rendered.carrier)).not.toThrow();
      expect(host.hydrationStatus).toBe('adopted');
      expect((mode === 'shadow' ? host.shadowRoot! : host).querySelector('input')).toBe(control);
    }
  );

  it('keeps explicit light-carrier conflict checks for an existing open shadow root', () => {
    const { host, rendered } = prepare('input', 'light');
    const shadow = host.attachShadow({ mode: 'open' });
    const sentinel = document.createElement('span');
    shadow.append(sentinel);
    expect(() => host.hydrate(rendered.carrier)).toThrow(
      /light carrier has a physical Shadow Root/
    );
    expect(host.logicalOwner).toBeNull();
    expect(shadow.firstChild).toBe(sentinel);
  });

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
