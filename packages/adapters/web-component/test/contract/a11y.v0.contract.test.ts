import { describe, expect, expectTypeOf, it } from 'vitest';
import type { A11ySemanticObjectSnapshot, Prototype } from '@proto.ui/core';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';

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
          def.a11y.id(id);
          def.a11y.role('button');
          def.a11y.name(name);
          def.a11y.description('Stores changes');
          def.a11y.state('disabled', disabled);
          def.a11y.state('hidden', hidden);
          def.a11y.state('orientation', orientation);
          def.a11y.action('activate', { event: 'click' });
          def.a11y.relation('controls', { target: controls });
          def.a11y.relation('labelledBy', { target: 'label-a' });
          def.a11y.tree({ mergeChildren: true });
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

  it('A11Y-WC-0150: projects valid state-backed heading levels and rejects invalid updates', () => {
    // T-A11Y-0001-CASE-HEADING-LEVEL
    const P = definePrototype({
      name: 'x-a11y-wc-heading-level',
      setup(def) {
        const level = def.state.numberDiscrete('heading.level', 2);
        def.a11y.level(level);
        def.expose.method('setLevel', (value: number) =>
          level.set(value, 'reason: update heading level')
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
      getExposes(): { setLevel(value: number): void };
    };
    document.body.appendChild(el);
    expect(el.getAttribute('aria-level')).toBe('2');

    el.getExposes().setLevel(6);
    expect(el.getAttribute('aria-level')).toBe('6');

    expect(() => el.getExposes().setLevel(0)).toThrow(/level must be an integer in range 1-6/);
    expect(el.getAttribute('aria-level')).toBe('6');
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
        def.a11y.tree({ hidden, mergeChildren });
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
        def.a11y.relation('describedBy', { target: describedBy, mode: 'append' });
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
        def.a11y.state('live', live);
        def.a11y.state('atomic', atomic);
        def.a11y.state('busy', busy);
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
