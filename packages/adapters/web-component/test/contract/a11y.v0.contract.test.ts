import { asAccessible } from '@proto.ui/hooks';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { A11ySemanticObjectSnapshot, Prototype } from '@proto.ui/core';
import { createA11ySemanticObjectRef, createAnatomyFamily, definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { createHostSurfaceProjection } from '@proto.ui/adapter-base';
import {
  A11Y_PROJECT_CAP,
  createWebA11yProjector,
  type A11yProjector,
} from '@proto.ui/module-a11y';
import { createWebComponentModules } from '../../src/runtime/modules';
import {
  createLogicalInstance,
  markProtoInstance,
  unbindProtoInstance,
} from '../../src/platform/instance-tree';

describe('contract: adapter-web-component / a11y projection (v0)', () => {
  it('types projected tree snapshots as resolved booleans', () => {
    type SnapshotTree = NonNullable<A11ySemanticObjectSnapshot['tree']>;
    expectTypeOf<SnapshotTree['hidden']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<SnapshotTree['mergeChildren']>().toEqualTypeOf<boolean | undefined>();
  });

  it('A11Y-WC-0100: projects supported semantic object IR to host attributes', () => {
    // T-A11Y-0001-CASE-WEB-PROJECTION
    const P: Prototype<{ disabled?: boolean; label?: string; orientation?: string }> =
      definePrototype({
        name: 'x-a11y-wc-projection',
        setup(def) {
          def.props.define({
            disabled: { type: 'boolean', empty: 'fallback' },
            label: { type: 'string', empty: 'fallback' },
            orientation: { type: 'string', empty: 'fallback' },
          });
          def.props.setDefaults({ disabled: false, label: 'Save', orientation: 'vertical' });

          const disabled = def.state.bool('button.disabled', false);
          const id = def.state.string('button.id', 'button-a');
          const name = def.state.string('button.name', 'Save');
          const hidden = def.state.bool('button.hidden', false);
          const controls = def.state.string('button.controls', 'panel-a');
          const orientation = def.state.string('button.orientation', 'vertical');
          asAccessible().id(id);
          asAccessible().role('button');
          asAccessible().name(name);
          asAccessible().description('Stores changes');
          asAccessible().state('disabled', disabled);
          asAccessible().state('hidden', hidden);
          asAccessible().state('orientation', orientation);
          asAccessible().action('activate', { event: 'click' });
          asAccessible().relation('controls', { target: controls });
          asAccessible().relation('labelledBy', { target: 'label-a' });
          asAccessible().tree({ mergeChildren: true });
          def.props.watch(['disabled'], (_run, next) => {
            disabled.set(next.disabled);
            hidden.set(next.disabled);
            controls.set(next.disabled ? 'panel-b' : 'panel-a');
          });
          def.props.watch(['label'], (_run, next) => {
            name.set(next.label ?? '');
          });
          def.props.watch(['orientation'], (_run, next) => {
            orientation.set(next.orientation ?? '');
          });

          return (r) => r.el('button', 'Save');
        },
      });

    if (!customElements.get(P.name)) {
      customElements.define(
        P.name,
        AdaptToWebComponent(P, { register: false, registerAs: P.name })
      );
    }

    const el = document.createElement(P.name) as HTMLElement;
    document.body.appendChild(el);

    expect(el.getAttribute('id')).toBe('button-a');
    expect(el.getAttribute('role')).toBe('button');
    expect(el.getAttribute('aria-label')).toBe('Save');
    expect(el.getAttribute('aria-description')).toBe('Stores changes');
    expect(el.getAttribute('aria-disabled')).toBe('false');
    expect(el.getAttribute('aria-hidden')).toBe('false');
    expect(el.hasAttribute('hidden')).toBe(false);
    expect(el.getAttribute('aria-orientation')).toBe('vertical');
    expect(el.getAttribute('aria-controls')).toBe('panel-a');
    expect(el.getAttribute('aria-labelledby')).toBe('label-a');
    expect(el.getAttribute('data-pui-a11y-actions')).toBe('activate');
    expect(el.getAttribute('data-pui-a11y-merge-children')).toBe('true');

    setElementProps(el, { disabled: true });

    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.hasAttribute('hidden')).toBe(true);
    expect(el.getAttribute('aria-controls')).toBe('panel-b');

    setElementProps(el, { label: 'Store changes' });
    expect(el.getAttribute('aria-label')).toBe('Store changes');

    setElementProps(el, { label: '' });
    expect(el.hasAttribute('aria-label')).toBe(false);

    setElementProps(el, { orientation: '' });
    expect(el.hasAttribute('aria-orientation')).toBe(false);

    setElementProps(el, { orientation: 'horizontal' });
    expect(el.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('A11Y-WC-0150: projects valid heading levels, omits invalid updates, and clears stale levels', () => {
    // T-A11Y-0001-CASE-HEADING-LEVEL
    const P = definePrototype({
      name: 'x-a11y-wc-heading-level',
      setup(def) {
        const role = def.state.string('heading.role', 'heading');
        const level = def.state.numberDiscrete('heading.level', 2);
        asAccessible().role(role);
        asAccessible().level(level);
        def.expose.method('setLevel', (value: number) =>
          level.set(value, 'reason: update heading level')
        );
        def.expose.method('getLevel', () => level.get());
        def.expose.method('setRole', (value: string) =>
          role.set(value, 'reason: update heading role')
        );
        return (r) => r.el('div', 'Heading');
      },
    });

    if (!customElements.get(P.name)) {
      customElements.define(
        P.name,
        AdaptToWebComponent(P, { register: false, registerAs: P.name })
      );
    }

    const el = document.createElement(P.name) as HTMLElement & {
      getExposes(): {
        setLevel(value: number): void;
        getLevel(): number;
        setRole(value: string): void;
      };
    };
    document.body.appendChild(el);
    expect(el.getAttribute('role')).toBe('heading');
    expect(el.getAttribute('aria-level')).toBe('2');

    el.getExposes().setLevel(6);
    expect(el.getAttribute('aria-level')).toBe('6');

    el.getExposes().setLevel(0);
    expect(el.getExposes().getLevel()).toBe(0);
    expect(el.getAttribute('role')).toBe('heading');
    expect(el.hasAttribute('aria-level')).toBe(false);

    el.getExposes().setLevel(4);
    expect(el.getExposes().getLevel()).toBe(4);
    expect(el.getAttribute('aria-level')).toBe('4');

    el.getExposes().setRole('button');
    expect(el.getAttribute('role')).toBe('button');
    expect(el.hasAttribute('aria-level')).toBe(false);

    el.getExposes().setRole('heading');
    expect(el.getAttribute('role')).toBe('heading');
    expect(el.getAttribute('aria-level')).toBe('4');
    el.remove();
  });

  it('A11Y-WC-0200: projects dynamic tree state without changing layout visibility', () => {
    // T-A11Y-0001-CASE-DYNAMIC-TREE
    const P: Prototype<{ decorative?: boolean }> = definePrototype({
      name: 'x-a11y-wc-dynamic-tree',
      setup(def) {
        def.props.define({ decorative: { type: 'boolean', empty: 'fallback' } });
        def.props.setDefaults({ decorative: true });

        const hidden = def.state.bool('tree.hidden', true);
        const mergeChildren = def.state.bool('tree.mergeChildren', true);
        asAccessible().tree({ hidden, mergeChildren });
        def.props.watch(['decorative'], (_run, next) => {
          hidden.set(next.decorative, 'reason: test tree hidden');
          mergeChildren.set(next.decorative, 'reason: test tree merge children');
        });
      },
    });

    if (!customElements.get(P.name)) {
      customElements.define(
        P.name,
        AdaptToWebComponent(P, { register: false, registerAs: P.name })
      );
    }

    const el = document.createElement(P.name) as HTMLElement;
    document.body.appendChild(el);
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('data-pui-a11y-merge-children')).toBe('true');
    expect(el.hasAttribute('hidden')).toBe(false);

    setElementProps(el, { decorative: false });
    expect(el.getAttribute('aria-hidden')).toBe('false');
    expect(el.getAttribute('data-pui-a11y-merge-children')).toBe('false');
    expect(el.hasAttribute('hidden')).toBe(false);

    setElementProps(el, { decorative: true });
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('data-pui-a11y-merge-children')).toBe('true');
    expect(el.hasAttribute('hidden')).toBe(false);
    el.remove();
  });

  it('A11Y-WC-0200: append relations preserve host-authored IDREF tokens', () => {
    // T-A11Y-0001-CASE-ADDITIVE-RELATION
    const P = definePrototype({
      name: 'x-a11y-wc-additive-relation',
      setup(def) {
        const describedBy = def.state.string('describedBy', 'tooltip-a');
        asAccessible().relation('describedBy', { target: describedBy, mode: 'append' });
        def.expose.method('setDescription', (value: string) => describedBy.set(value));
        return (r) => r.el('button', 'Info');
      },
    });

    if (!customElements.get(P.name)) {
      customElements.define(
        P.name,
        AdaptToWebComponent(P, { register: false, registerAs: P.name })
      );
    }

    const el = document.createElement(P.name) as HTMLElement & {
      getExposes(): { setDescription(value: string): void };
    };
    el.setAttribute('aria-describedby', 'host-help');
    document.body.appendChild(el);

    expect(el.getAttribute('aria-describedby')).toBe('host-help tooltip-a');

    el.getExposes().setDescription('tooltip-b');
    expect(el.getAttribute('aria-describedby')).toBe('host-help tooltip-b');
  });

  it('A11Y-WC-0300: projects live, atomic, and busy a11y states to host attributes', () => {
    // T-A11Y-0001-CASE-LIVE-ATOMIC-BUSY
    const P = definePrototype({
      name: 'x-a11y-wc-live-atomic-busy',
      setup(def) {
        const live = def.state.string('live', 'polite');
        const atomic = def.state.bool('atomic', true);
        const busy = def.state.bool('busy', false);
        asAccessible().state('live', live);
        asAccessible().state('atomic', atomic);
        asAccessible().state('busy', busy);
        def.expose.method('setLive', (value: string) => live.set(value));
        def.expose.method('setAtomic', (value: boolean) => atomic.set(value));
        def.expose.method('setBusy', (value: boolean) => busy.set(value));
        return (r) => r.el('div', 'region');
      },
    });

    if (!customElements.get(P.name)) {
      customElements.define(
        P.name,
        AdaptToWebComponent(P, { register: false, registerAs: P.name })
      );
    }

    const el = document.createElement(P.name) as HTMLElement & {
      getExposes(): {
        setLive(value: string): void;
        setAtomic(value: boolean): void;
        setBusy(value: boolean): void;
      };
    };
    document.body.appendChild(el);

    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.getAttribute('aria-atomic')).toBe('true');
    expect(el.getAttribute('aria-busy')).toBe('false');

    el.getExposes().setLive('assertive');
    expect(el.getAttribute('aria-live')).toBe('assertive');

    el.getExposes().setAtomic(false);
    expect(el.getAttribute('aria-atomic')).toBe('false');

    el.getExposes().setBusy(true);
    expect(el.getAttribute('aria-busy')).toBe('true');

    el.getExposes().setBusy(false);
    expect(el.getAttribute('aria-busy')).toBe('false');
    el.remove();
  });
});

let partFixtureId = 0;
function createPartElements(targetId?: string, baseline?: string, explicitTargetId?: string) {
  const suffix = ++partFixtureId;
  const family = createAnatomyFamily(`wc-part-${suffix}`, {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      source: { cardinality: { min: 0, max: '*' } },
      target: { cardinality: { min: 0, max: '*' } },
    },
  });
  const make = (role: 'root' | 'source' | 'target') => {
    const proto = definePrototype<{ match?: string; present?: boolean }>({
      name: `x-wc-part-${suffix}-${role}`,
      setup(def) {
        def.anatomy.claim(family, { role });
        if (role === 'root') return;
        def.props.define({
          match: { type: 'string', empty: 'fallback' },
          present: { type: 'boolean', empty: 'fallback' },
        });
        def.props.setDefaults({ match: 'protocol/key', present: true });
        const key = def.state.string('match', 'protocol/key');
        const accessible = asAccessible();
        accessible.part(family, { key });
        if (role === 'target' && explicitTargetId) accessible.id(explicitTargetId);
        accessible.role(role === 'source' ? 'button' : 'region');
        accessible.relation(role === 'source' ? 'controls' : 'labelledBy', {
          target: { kind: 'part', family, role: role === 'source' ? 'target' : 'source', key },
        });
        def.props.watch(['match', 'present'], (run, next) => {
          key.set(next.match ?? '');
          run.lifecycle.setPresent(next.present !== false);
        });
      },
    });
    customElements.define(proto.name, AdaptToWebComponent(proto, { register: false }));
    return document.createElement(proto.name);
  };
  const root = make('root'),
    source = make('source'),
    target = make('target');
  if (targetId !== undefined) target.setAttribute('id', targetId);
  if (baseline !== undefined) source.setAttribute('aria-controls', baseline);
  root.append(source, target);
  document.body.append(root);
  return { root, source, target };
}

const flushPartView = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

describe('contract: adapter-web-component / same-domain part relationships', () => {
  it('T-A11Y-PART-RELATIONSHIP-0001-CASE-HOST-ID-OWNERSHIP: adopts an authored identity before applying an explicit declaration', async () => {
    const { root, source, target } = createPartElements('author-initial', undefined, 'proto-id');
    try {
      expect(target.id).toBe('author-initial');
      expect(source.getAttribute('aria-controls')).toBe('author-initial');
    } finally {
      root.remove();
      await flushPartView();
    }
  });

  it('T-A11Y-PART-RELATIONSHIP-0001-CASE-HOST-ID-OWNERSHIP: a later authored id supersedes an unchanged explicit declaration', async () => {
    const { root, source, target } = createPartElements(undefined, undefined, 'proto-id');
    try {
      expect(source.getAttribute('aria-controls')).toBe('proto-id');
      target.id = 'author-later';
      await flushPartView();
      expect(target.id).toBe('author-later');
      expect(source.getAttribute('aria-controls')).toBe('author-later');
      setElementProps(target, { present: false });
      await flushPartView();
      expect(target.id).toBe('author-later');
      setElementProps(target, { present: true });
      await flushPartView();
      expect(target.id).toBe('author-later');
      expect(source.getAttribute('aria-controls')).toBe('author-later');
    } finally {
      root.remove();
      await flushPartView();
    }
  });

  it('T-A11Y-PART-RELATIONSHIP-0001-CASE-VIEW-EPOCH-LIFECYCLE: retains identity and withdraws source contributions before detach', async () => {
    const { root, source, target } = createPartElements('host-panel', 'host-caption');
    try {
      expect(source.getAttribute('aria-controls')).toBe('host-caption host-panel');
      const sourceId = source.id;
      expect(target.getAttribute('aria-labelledby')).toBe(sourceId);
      setElementProps(target, { present: false });
      expect(source.getAttribute('aria-controls')).toBe('host-caption');
      expect(target.id).toBe('host-panel');
      await flushPartView();
      setElementProps(target, { present: true });
      await flushPartView();
      expect(source.getAttribute('aria-controls')).toBe('host-caption host-panel');
      expect(target.getAttribute('aria-labelledby')).toBe(sourceId);
      setElementProps(source, { present: false });
      expect(target.hasAttribute('aria-labelledby')).toBe(false);
      expect(source.getAttribute('aria-controls')).toBe('host-caption');
      await flushPartView();
      setElementProps(source, { present: true });
      await flushPartView();
      expect(source.id).toBe(sourceId);
      expect(target.getAttribute('aria-labelledby')).toBe(sourceId);
    } finally {
      root.remove();
      await flushPartView();
    }
  });

  it('T-A11Y-PART-RELATIONSHIP-0001-CASE-HOST-ID-OWNERSHIP: preserves identical preexisting tokens and later author identity', async () => {
    const { root, source, target } = createPartElements(
      'authored-target',
      'caption authored-target'
    );
    try {
      setElementProps(target, { present: false });
      expect(source.getAttribute('aria-controls')).toBe('caption authored-target');
      await flushPartView();
      setElementProps(target, { present: true });
      await flushPartView();
      target.id = 'authored-later';
      await flushPartView();
      expect(source.getAttribute('aria-controls')).toBe('caption authored-target authored-later');
      const duplicate = document.createElement('div');
      duplicate.id = 'authored-later';
      root.append(duplicate);
      await flushPartView();
      expect(target.id).toBe('authored-later');
      expect(source.getAttribute('aria-controls')).toBe('caption authored-target');
      duplicate.remove();
      await flushPartView();
      expect(source.getAttribute('aria-controls')).toBe('caption authored-target authored-later');
      target.remove();
      await flushPartView();
      expect(target.id).toBe('authored-later');
      expect(source.getAttribute('aria-controls')).toBe('caption authored-target');
    } finally {
      root.remove();
      await flushPartView();
    }
  });

  it('T-A11Y-PART-RELATIONSHIP-0001-CASE-HOST-ID-OWNERSHIP: restores an empty authored id exactly and never overwrites an initial collision', async () => {
    const first = createPartElements('');
    const collision = document.createElement('div');
    collision.id = 'collision';
    document.body.append(collision);
    const second = createPartElements('collision');
    try {
      expect(first.target.id).not.toBe('');
      setElementProps(first.target, { present: false });
      expect(first.target.getAttribute('id')).toBe('');
      expect(second.target.id).toBe('collision');
      expect(second.source.hasAttribute('aria-controls')).toBe(false);
    } finally {
      first.root.remove();
      second.root.remove();
      collision.remove();
      await flushPartView();
    }
  });

  it('T-A11Y-PART-RELATIONSHIP-0001-CASE-SAME-EPOCH-REPLACEMENT: synchronously reconciles the actual WC surface provider', async () => {
    const proto = definePrototype({ name: 'wc-part-binding-provider', setup() {} });
    const boundary = document.createElement('x-wc-binding-provider');
    const source = document.createElement('button');
    const first = document.createElement('input');
    first.setAttribute('id', '');
    const second = document.createElement('textarea');
    const conflict = document.createElement('input');
    conflict.id = 'host-different';
    document.body.append(boundary, source);
    boundary.append(first);
    const createProvider = (host: HTMLElement, initial: HTMLElement) => {
      const token = createLogicalInstance(proto);
      markProtoInstance(host, proto, token);
      const surface = createHostSurfaceProjection<HTMLElement>(host, initial);
      const modules = createWebComponentModules({
        el: host,
        surfaceProjection: surface,
        instanceToken: token,
        router: { rootTarget: host, globalTarget: window },
        rawPropsSource: { get: () => ({}), subscribe: () => () => {} },
        effectsPort: { queueStyle() {}, requestFlush() {} },
        textControlTarget: null,
        imageViewTarget: null,
        getMeta: () => undefined,
        setExposes() {},
        runInCallbackScope: (fn) => fn(),
        isViewReady: () => true,
        subscribeTargetReady: () => () => {},
        retryTargetReady() {},
      });
      const projector = modules.a11y!({ prototypeName: proto.name }).find(
        ([cap]) => cap === A11Y_PROJECT_CAP
      )![1] as A11yProjector;
      return {
        surface,
        projector,
        dispose() {
          projector.dispose?.();
          unbindProtoInstance(token);
        },
      };
    };
    const targetProvider = createProvider(boundary, first);
    const { surface, projector } = targetProvider;
    const sourceBoundary = document.createElement('x-wc-source-provider');
    document.body.append(sourceBoundary);
    sourceBoundary.append(source);
    source.setAttribute('aria-controls', 'source-caption');
    const sourceProvider = createProvider(sourceBoundary, source);
    const targetRef = createA11ySemanticObjectRef();
    const sourceRef = createA11ySemanticObjectRef();
    const targetSnapshot = {
      objectRef: targetRef,
      viewEpoch: 3,
      states: {},
      actions: {},
      relations: {},
    };
    const dependent = sourceProvider.projector;
    const family = createAnatomyFamily('wc-physical-pair', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        source: { cardinality: { min: 0, max: '*' } },
        target: { cardinality: { min: 0, max: '*' } },
      },
    });
    const sourceSnapshot = {
      objectRef: sourceRef,
      viewEpoch: 4,
      states: {},
      actions: {},
      relations: { controls: [targetRef] },
      relationModes: { controls: 'append' as const },
      partRelationships: [
        {
          family,
          scope: {},
          source: sourceRef,
          sourceRole: 'source',
          targetRole: 'target',
          relation: 'controls',
          key: 'pair',
          sourceEpoch: 4,
          targetEpoch: 3,
          target: targetRef,
        },
      ],
    };
    try {
      projector(targetSnapshot);
      dependent(sourceSnapshot);
      const id = first.id;
      expect(source.getAttribute('aria-controls')).toBe(`source-caption ${id}`);
      boundary.replaceChildren(second);
      surface.setSurfaceTarget(second);
      // The provider callback finishes the replacement before the host exposes it.
      expect(first.getAttribute('id')).toBe('');
      expect(second.id).toBe(id);
      expect(source.getAttribute('aria-controls')).toBe(`source-caption ${id}`);
      boundary.replaceChildren(conflict);
      surface.setSurfaceTarget(conflict);
      expect(second.hasAttribute('id')).toBe(false);
      expect(conflict.id).toBe('host-different');
      expect(source.getAttribute('aria-controls')).toBe('source-caption');
      boundary.replaceChildren(second);
      surface.setSurfaceTarget(second);
      expect(source.getAttribute('aria-controls')).toBe(`source-caption ${id}`);
      projector({ ...targetSnapshot, viewEpoch: 2 });
      expect(source.getAttribute('aria-controls')).toBe(`source-caption ${id}`);
      dependent({ ...sourceSnapshot, viewEpoch: 3 });
      expect(source.getAttribute('aria-controls')).toBe(`source-caption ${id}`);
      projector({ ...targetSnapshot, viewEpoch: 4 });
      expect(source.getAttribute('aria-controls')).toBe('source-caption');
      dependent({
        ...sourceSnapshot,
        partRelationships: sourceSnapshot.partRelationships.map((part) => ({
          ...part,
          targetEpoch: 4,
        })),
      });
      expect(source.getAttribute('aria-controls')).toBe(`source-caption ${id}`);
      const replacementSource = document.createElement('button');
      replacementSource.setAttribute('aria-controls', 'replacement-caption');
      sourceBoundary.replaceChildren(replacementSource);
      sourceProvider.surface.setSurfaceTarget(replacementSource);
      expect(source.getAttribute('aria-controls')).toBe('source-caption');
      expect(replacementSource.getAttribute('aria-controls')).toBe(`replacement-caption ${id}`);
      sourceProvider.surface.setSurfaceTarget(null);
      expect(replacementSource.getAttribute('aria-controls')).toBe('replacement-caption');
      sourceBoundary.replaceChildren(source);
      sourceProvider.surface.setSurfaceTarget(source);
      expect(source.getAttribute('aria-controls')).toBe(`source-caption ${id}`);
      first.id = 'old-node-later';
      await flushPartView();
      expect(source.getAttribute('aria-controls')).toBe(`source-caption ${id}`);
    } finally {
      targetProvider.dispose();
      sourceProvider.dispose();
      boundary.remove();
      sourceBoundary.remove();
      await flushPartView();
    }
  });
});
