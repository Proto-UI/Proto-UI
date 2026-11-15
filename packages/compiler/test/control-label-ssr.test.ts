// @vitest-environment happy-dom
import { createControlLabelRef, type InstanceAssociations } from '@proto.ui/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { compilationArtifacts, compileFile, compilePrototype } from '../src/compile';
import { emitWebComponentSource } from '../src/web-component-source';
import {
  buildButtonSsrFixture,
  compileButtonSsrFixture,
  loadGeneratedModule,
  repositoryRoot,
  type FixtureCarrier,
} from './button-ssr-fixture';

interface Consumer extends HTMLElement {
  instanceAssociations: InstanceAssociations | undefined;
  hydrationStatus?: string;
  logicalOwner?: symbol | null;
  connectedCallback(): void;
  attributeChangedCallback(name: string, previous: string | null, value: string | null): void;
  setProps(props: Record<string, unknown>): void;
  dispose(): void;
}
let fixture: Awaited<ReturnType<typeof buildButtonSsrFixture>>;
const targetTag = 'pui-client-hydration-control-label-target';
const labelTag = 'pui-client-hydration-control-label-source';
const mounted: Consumer[] = [];

beforeAll(async () => {
  fixture = await buildButtonSsrFixture({ tagName: targetTag });
  const client = loadGeneratedModule(fixture.generatedFiles, 'Component.client.ts') as {
    register(): void;
  };
  client.register();
  const source = await compileFile('packages/prototypes/base/src/label/root.proto.ts', {
    root: repositoryRoot,
    profile: 'web-component-source-v1',
  });
  if (!source.ok) throw new Error(JSON.stringify(source.diagnostics));
  const label = loadGeneratedModule(compilationArtifacts(source.value), 'Component.ts') as {
    register(tag: string): void;
  };
  label.register(labelTag);
});

afterEach(async () => {
  for (const host of mounted.splice(0).reverse()) {
    host.dispose();
    host.remove();
  }
  document.head.replaceChildren();
  document.body.replaceChildren();
  await checkpoint();
});

async function checkpoint() {
  await Promise.resolve();
  await new Promise<void>((resolve) => {
    const node = document.createElement('span');
    const observer = new MutationObserver(() => {
      observer.disconnect();
      resolve();
    });
    observer.observe(node, { attributes: true });
    node.setAttribute('data-checkpoint', 'ready');
  });
  await Promise.resolve();
}

function pointerClick(host: HTMLElement) {
  for (const type of ['pointerdown', 'pointerup'])
    host.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        composed: true,
        cancelable: true,
        pointerType: 'mouse',
        pointerId: 1,
        button: 0,
        clientX: 10,
        clientY: 10,
      })
    );
  host.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      composed: true,
      cancelable: true,
      button: 0,
      detail: 1,
    })
  );
}

function prepareTarget(mutate?: (carrier: FixtureCarrier) => void): Consumer {
  const rendered = fixture.render(
    { disabled: false },
    { slotHtml: '<span>Original content</span>' }
  );
  const template = document.createElement('template');
  template.innerHTML = rendered.html;
  const host = template.content.firstElementChild as Consumer;
  if (mutate) {
    const script = host.querySelector('script')!;
    const carrier = JSON.parse(script.textContent!);
    mutate(carrier);
    script.textContent = JSON.stringify(carrier);
  }
  for (const [hash, css] of [
    [fixture.provenance.artifacts.css, fixture.cssText],
    [fixture.provenance.artifacts.environment, fixture.environmentCssText],
  ]) {
    const style = document.createElement('style');
    style.setAttribute('data-pui-ssr-css', hash);
    style.textContent = css;
    document.head.append(style);
  }
  mounted.push(host);
  return host;
}

function prepareLabel(associations: InstanceAssociations): Consumer {
  const label = document.createElement(labelTag) as Consumer;
  label.instanceAssociations = associations;
  label.textContent = 'Actual external Label';
  mounted.push(label);
  document.body.append(label);
  return label;
}

describe('private client-only ControlLabel hydration', () => {
  it.each(['assertNoInstanceAssociations', 'validateNativeInstanceAssociations'])(
    'rejects a custom element class name that collides with the %s support import',
    async (className) => {
      const source = await compileButtonSsrFixture({ direct: true });
      const result = emitWebComponentSource(source.ir, {
        ssr: true,
        controlLabelHydration: 'client-only',
        className,
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('An import collision produced an invalid client module');
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'Choose a valid, non-reserved custom element class identifier.',
          }),
        ])
      );
    }
  );

  it('retains default direct SSR rejection and requires an explicit private mode', async () => {
    const source = await compileButtonSsrFixture({ direct: true });
    const result = emitWebComponentSource(source.ir, { ssr: true });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Direct SSR admitted the association without the private mode');
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(
      result.diagnostics.every(
        (diagnostic) => diagnostic.code === 'PUI4003' && /ControlLabel/.test(diagnostic.message)
      )
    ).toBe(true);
    expect(fixture.generatedFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        '.proto-ui/interaction/control-label-v1.ts',
        '.proto-ui/interaction/ownership-v1.ts',
      ])
    );
    const rendered = fixture.render();
    expect(rendered.html).not.toMatch(/instanceAssociations|instance-associations|controlLabel/);
    expect(rendered.carrier.raw).toEqual([]);
  });

  it.each(['before-adoption', 'after-adoption'] as const)(
    'binds actual independent Label and hydrated Button %s, then rebinds without duplicate activation',
    async (timing) => {
      const first = Object.freeze({ controlLabel: createControlLabelRef() });
      const next = Object.freeze({ controlLabel: createControlLabelRef() });
      const host = prepareTarget();
      const original = host.querySelector('span');
      if (timing === 'before-adoption') host.instanceAssociations = first;
      document.body.append(host);
      expect(host.hydrationStatus).toBe('adopted');
      expect(host.querySelector('span')).toBe(original);
      if (timing === 'after-adoption') host.instanceAssociations = first;
      const label = prepareLabel(first);
      await checkpoint();
      expect(label.id).not.toBe('');
      expect(host.getAttribute('aria-labelledby')).toBe(label.id);
      expect(host.hasAttribute('aria-label')).toBe(false);
      let signals = 0;
      host.addEventListener('click', (event) => {
        if (event instanceof CustomEvent) signals++;
      });
      pointerClick(label);
      expect(signals).toBe(1);
      expect(document.activeElement).toBe(host);
      host.setProps({ disabled: true });
      host.blur();
      pointerClick(label);
      expect(signals).toBe(1);
      expect(document.activeElement).not.toBe(host);
      expect(host.getAttribute('aria-labelledby')).toBe(label.id);
      host.setProps({ disabled: false });
      label.instanceAssociations = next;
      expect(host.hasAttribute('aria-labelledby')).toBe(false);
      pointerClick(label);
      expect(signals).toBe(1);
      host.instanceAssociations = next;
      expect(host.getAttribute('aria-labelledby')).toBe(label.id);
      pointerClick(label);
      expect(signals).toBe(2);
      host.instanceAssociations = undefined;
      expect(host.hasAttribute('aria-labelledby')).toBe(false);
      pointerClick(label);
      expect(signals).toBe(2);
      host.instanceAssociations = next;
      host.dispose();
      expect(host.hasAttribute('aria-labelledby')).toBe(false);
      pointerClick(label);
      expect(signals).toBe(2);
      expect(() => {
        host.instanceAssociations = first;
      }).toThrow(/disposed/);
    }
  );

  it.each(['forged-ref', 'unknown-key', 'attribute', 'props'] as const)(
    'rejects %s client input while retaining the existing valid pair',
    async (kind) => {
      const associations = Object.freeze({ controlLabel: createControlLabelRef() });
      const host = prepareTarget();
      host.instanceAssociations = associations;
      document.body.append(host);
      const label = prepareLabel(associations);
      await checkpoint();
      const invalid = () => {
        if (kind === 'attribute')
          host.attributeChangedCallback('instance-associations', null, '{}');
        else if (kind === 'props') host.setProps({ instanceAssociations: associations });
        else
          host.instanceAssociations = (
            kind === 'forged-ref' ? { controlLabel: {} } : { ...associations, unknown: true }
          ) as InstanceAssociations;
      };
      let failure: unknown;
      try {
        invalid();
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(TypeError);
      expect((failure as TypeError).message).toMatch(/association|opaque/i);
      expect(host.getAttribute('aria-labelledby')).toBe(label.id);
      let signals = 0;
      host.addEventListener('click', (event) => {
        if (event instanceof CustomEvent) signals++;
      });
      pointerClick(label);
      expect(signals).toBe(1);
    }
  );

  it.each(['Props', 'ServerOptions', 'Root attributes'] as const)(
    'rejects %s association transport before reading the association value',
    (subject) => {
      let reads = 0;
      const input = Object.defineProperty({}, 'instanceAssociations', {
        enumerable: true,
        get() {
          reads++;
          return { controlLabel: createControlLabelRef() };
        },
      });
      const props = subject === 'Props' ? input : {};
      const options =
        subject === 'ServerOptions'
          ? input
          : subject === 'Root attributes'
            ? { rootAttributes: input }
            : {};
      expect(() => fixture.render(props, options)).toThrow(/association transport is unsupported/);
      expect(reads).toBe(0);
    }
  );

  it('refuses a real opaque reference nested inside arbitrary initial data', () => {
    const ref = createControlLabelRef();
    expect(() => fixture.render({ metadata: { nested: [ref] } })).toThrow(/portable|Capabilities/);
  });

  it.each(['carrier', 'raw', 'attributes', 'baselines'] as const)(
    'rejects forged %s association data while preserving the complete first frame',
    (kind) => {
      const host = prepareTarget((carrier) => {
        if (kind === 'carrier') carrier.instanceAssociations = { controlLabel: {} };
        if (kind === 'raw')
          carrier.raw.push(['instanceAssociations', { kind: 'value', value: ['record', []] }]);
        if (kind === 'attributes') carrier.attributes['instance-associations'] = '{}';
        if (kind === 'baselines')
          (carrier.baselines as Record<string, string>)['instanceassociations'] = '{}';
      });
      const connect = host.connectedCallback;
      host.connectedCallback = () => {};
      document.body.append(host);
      host.connectedCallback = connect;
      const before = host.outerHTML;
      const children = [...host.childNodes];
      expect(() => host.connectedCallback()).toThrow(/instance association/i);
      expect(host.hydrationStatus).toBe('mismatch');
      expect(host.logicalOwner).toBeNull();
      expect(host.outerHTML).toBe(before);
      expect([...host.childNodes]).toEqual(children);
    }
  );

  it('rejects server association acquisition and implicit Anatomy pairing explicitly', () => {
    const server = loadGeneratedModule(fixture.generatedFiles, 'Component.ts') as {
      createHydrationOwner(port: unknown, props: object, associations: () => unknown): unknown;
    };
    const kernel = loadGeneratedModule(
      fixture.generatedFiles,
      '.proto-ui/web-component/ssr-v1.ts'
    ) as {
      createServerPort(options: object): { close(): void };
    };
    const port = kernel.createServerPort({});
    let calls = 0;
    try {
      expect(() =>
        server.createHydrationOwner(port, {}, () => {
          calls++;
          return { controlLabel: createControlLabelRef() };
        })
      ).toThrow(/instance associations are supported only after client hydration/i);
      expect(calls).toBe(0);
    } finally {
      port.close();
    }
    const source = compilePrototype(
      `import {definePrototype,createAnatomyFamily} from '@proto.ui/core';
      import {asControlLabel} from '@proto.ui/hooks';
      const family=createAnatomyFamily('ssr-pair',{roles:{root:{cardinality:{min:1,max:1}},caption:{cardinality:{min:1,max:1}},control:{cardinality:{min:1,max:1}}},relations:[{kind:'contains',parent:'root',child:'caption'},{kind:'contains',parent:'root',child:'control'}]});
      export default definePrototype({name:'independent-caption',setup(def){def.anatomy.claim(family,{role:'caption'});asControlLabel().label({family,labelRole:'caption',targetRole:'control'});return r=>r.slot();}});`,
      { profile: 'web-component-source-v1' }
    );
    if (!source.ok) throw new Error(JSON.stringify(source.diagnostics));
    const result = emitWebComponentSource(source.value.ir, {
      ssr: true,
      controlLabelHydration: 'client-only',
    });
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI4003', message: expect.stringMatching(/anatomy/i) }],
    });
  });
});
