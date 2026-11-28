import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype, type FocusEntryConfig } from '@proto.ui/core';
import { FOCUS_SET_ENTRY_FOCUSABLE_CAP, FOCUS_SET_FOCUSABLE_CAP } from '@proto.ui/module-focus';
import { createReactModules } from '../src/runtime/modules';
import {
  createLogicalInstance,
  markProtoInstance,
  unbindProtoInstance,
} from '../src/platform/instance-tree';

let serial = 0;
const release: Array<() => void> = [];
afterEach(() => {
  for (const dispose of release.splice(0).reverse()) dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function fixture(target: HTMLElement) {
  const prototype = definePrototype({ name: `react-focus-projection-${++serial}`, setup() {} });
  const instanceToken = createLogicalInstance(prototype);
  document.body.append(target);
  markProtoInstance(target, prototype, instanceToken);
  release.push(() => unbindProtoInstance(target));
  const modules = createReactModules({
    el: target,
    instanceToken,
    router: { rootTarget: target, globalTarget: window },
    emit() {},
    rawPropsSource: { get: () => ({}), subscribe: () => () => {} },
    effectsPort: { queueStyle() {}, requestFlush() {}, flushNow() {} },
    getMeta: () => undefined,
    setExposes() {},
    setTextControlDefaultValue() {},
    runInCallbackScope: (fn) => fn(),
    isViewReady: () => true,
    isEntryAcquisitionReady: () => true,
    getCurrentElement: () => target,
    subscribeTargetReady: () => () => {},
    retryTargetReady() {},
  });
  const caps = new Map(modules.focus({ prototypeName: prototype.name }));
  const project = caps.get(FOCUS_SET_FOCUSABLE_CAP) as (
    target: HTMLElement,
    enabled: boolean,
    options?: { programmatic?: boolean }
  ) => void;
  const entry = caps.get(FOCUS_SET_ENTRY_FOCUSABLE_CAP) as (
    target: HTMLElement,
    config: FocusEntryConfig,
    enabled: boolean
  ) => void;
  const observer = new MutationObserver(() => {});
  observer.observe(target, {
    attributes: true,
    attributeFilter: ['tabindex'],
    attributeOldValue: true,
  });
  release.push(() => observer.disconnect());
  return {
    project: (enabled: boolean, options?: { programmatic?: boolean }) =>
      project(target, enabled, options),
    entry: (enabled = true) =>
      entry(target, { strategy: 'descendant-first', fallback: 'self', disabled: false }, enabled),
    records: () => observer.takeRecords(),
  };
}

describe('React Focus projection preserves current DOM without redundant mutations', () => {
  it.each([
    { label: 'enabled root', tag: 'div', enabled: true, options: undefined, expected: '0' },
    {
      label: 'disabled native root',
      tag: 'button',
      enabled: false,
      options: undefined,
      expected: '-1',
    },
    {
      label: 'programmatic-only root',
      tag: 'div',
      enabled: false,
      options: { programmatic: true },
      expected: '-1',
    },
    {
      label: 'disabled non-native root',
      tag: 'div',
      enabled: false,
      options: undefined,
      expected: null,
    },
  ])(
    '$label changes the current value once and does not write it again',
    ({ tag, enabled, options, expected }) => {
      const target = document.createElement(tag);
      target.setAttribute('tabindex', '7');
      const control = fixture(target);
      control.project(enabled, options);
      control.project(enabled, options);
      control.project(enabled, options);
      expect(target.getAttribute('tabindex')).toBe(expected);
      expect(control.records()).toHaveLength(1);
    }
  );

  it('reasserts the requested value after a different author write or removal', () => {
    const target = document.createElement('div');
    const control = fixture(target);
    control.project(true);
    control.records();
    for (const value of ['3', null]) {
      if (value === null) target.removeAttribute('tabindex');
      else target.setAttribute('tabindex', value);
      control.records();
      control.project(true);
      control.project(true);
      expect(target.getAttribute('tabindex')).toBe('0');
      expect(control.records()).toHaveLength(1);
    }
  });

  it('keeps actual focus across repeated sequential and programmatic-only projections', () => {
    const target = document.createElement('div');
    const control = fixture(target);
    control.project(true);
    target.focus();
    control.records();
    control.project(false, { programmatic: true });
    control.project(false, { programmatic: true });
    expect(target.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(target);
    expect(control.records()).toHaveLength(1);
    control.project(true);
    control.project(true);
    expect(target.tabIndex).toBe(0);
    expect(document.activeElement).toBe(target);
    expect(control.records()).toHaveLength(1);
  });

  it('still resolves current descendants on each Entry projection', () => {
    const target = document.createElement('div');
    const control = fixture(target);
    control.entry();
    control.entry();
    expect(target.tabIndex).toBe(0);
    expect(control.records()).toHaveLength(1);
    const child = document.createElement('button');
    target.append(child);
    control.entry();
    control.entry();
    expect(target.hasAttribute('tabindex')).toBe(false);
    expect(control.records()).toHaveLength(1);
    child.remove();
    control.entry();
    control.entry();
    expect(target.tabIndex).toBe(0);
    expect(control.records()).toHaveLength(1);
    control.entry(false);
    control.entry(false);
    expect(target.hasAttribute('tabindex')).toBe(false);
    expect(control.records()).toHaveLength(1);
  });

  it('does not re-enter an author callback for an already projected value', () => {
    let project!: () => void;
    let calls = 0;
    const name = `react-focus-same-callback-${++serial}`;
    customElements.define(
      name,
      class extends HTMLElement {
        static observedAttributes = ['tabindex'];
        attributeChangedCallback(_name: string, _old: string | null, value: string | null) {
          if (value === '0' && ++calls < 4) project();
        }
      }
    );
    const target = document.createElement(name);
    const control = fixture(target);
    project = () => control.project(true);
    project();
    expect(target.tabIndex).toBe(0);
    expect(calls).toBe(1);
    expect(control.records()).toHaveLength(1);
  });

  it.each(['author-write', 'newer-policy'] as const)(
    'preserves a different %s made reentrantly during publication',
    (effect) => {
      let control!: ReturnType<typeof fixture>;
      let armed = true;
      const name = `react-focus-reentrant-callback-${++serial}`;
      customElements.define(
        name,
        class extends HTMLElement {
          static observedAttributes = ['tabindex'];
          attributeChangedCallback(_name: string, _old: string | null, value: string | null) {
            if (value !== '0' || !armed) return;
            armed = false;
            if (effect === 'author-write') this.setAttribute('tabindex', '4');
            else control.project(false, { programmatic: true });
          }
        }
      );
      const target = document.createElement(name);
      control = fixture(target);
      control.project(true);
      expect(target.getAttribute('tabindex')).toBe(effect === 'author-write' ? '4' : '-1');
      control.records();
      control.project(true);
      control.project(true);
      expect(target.tabIndex).toBe(0);
      expect(control.records()).toHaveLength(1);
    }
  );
});
