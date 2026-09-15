import { describe, it, expect } from 'vitest';
import {
  observeWebComponentRadioFocus,
  sampleWebComponentScopeTargets,
} from '../src/focus-scope-targets';
describe('WC scope sequential target sample', () => {
  it('revokes native radio history observation with its view lease', () => {
    const scope = document.createElement('div');
    scope.innerHTML =
      '<input id="a" type="radio" name="g" tabindex="0"><input id="b" type="radio" name="g" tabindex="0"><button id="after" tabindex="0"></button>';
    document.body.append(scope);
    const a = scope.querySelector<HTMLInputElement>('#a')!;
    const b = scope.querySelector<HTMLInputElement>('#b')!;
    const history = observeWebComponentRadioFocus(scope);
    try {
      b.focus();
      scope.querySelector<HTMLElement>('#after')!.focus();
      expect(
        sampleWebComponentScopeTargets(scope, undefined, 'next', history.order).targets
      ).toEqual([b, scope.lastElementChild]);
      history.dispose();
      a.focus();
      expect(history.order(a)).toBe(0);
      b.name = 'changed';
      expect(history.order(b)).toBe(0);
    } finally {
      history.dispose();
      scope.remove();
    }
  });
  it('samples current radio group selection and direction without changing selection', () => {
    // C-AS-FOCUS-SCOPE-0002-J; native Chrome forward/reverse oracle is separate.
    const scope = document.createElement('div');
    scope.innerHTML =
      '<button id="before" tabindex="0"></button><input id="a" type="radio" name="g" tabindex="0"><input id="b" type="radio" name="g" tabindex="0"><input id="c" type="radio" name="g" tabindex="0"><button id="after" tabindex="0"></button>';
    document.body.append(scope);
    const a = scope.querySelector<HTMLInputElement>('#a')!;
    const b = scope.querySelector<HTMLInputElement>('#b')!;
    const c = scope.querySelector<HTMLInputElement>('#c')!;
    const sample = (direction: 'next' | 'prev' = 'next') =>
      sampleWebComponentScopeTargets(scope, undefined, direction).targets.map((el) => el.id);
    try {
      expect(sample()).toEqual(['before', 'a', 'after']);
      expect(sample('prev')).toEqual(['before', 'c', 'after']);
      b.checked = true;
      expect(sample()).toEqual(['before', 'b', 'after']);
      expect(sample('prev')).toEqual(['before', 'b', 'after']);
      b.disabled = true;
      expect(sample()).toEqual(['before', 'a', 'after']);
      expect(sample('prev')).toEqual(['before', 'c', 'after']);
      b.disabled = false;
      b.hidden = true;
      expect(sample()).toEqual(['before', 'a', 'after']);
      b.hidden = false;
      b.setAttribute('tabindex', '-1');
      expect(sample()).toEqual(['before', 'a', 'after']);
      b.setAttribute('tabindex', '0');
      b.checked = false;
      c.focus();
      expect(sample()).toEqual(['before', 'c', 'after']);
      expect([a.checked, b.checked, c.checked]).toEqual([false, false, false]);
      a.checked = true;
      expect(sample('prev')).toEqual(['before', 'a', 'c', 'after']);
    } finally {
      scope.remove();
    }
  });
  it('keeps same-name groups separate by DOM tree and form owner, with unnamed inputs independent', () => {
    const scope = document.createElement('div');
    scope.innerHTML =
      '<form id="one"><input id="a" name="g" type="radio" tabindex="0"><input id="b" name="g" type="radio" tabindex="0" checked></form><form id="two"><input id="c" name="g" type="radio" tabindex="0"><input id="d" name="g" type="radio" tabindex="0" checked></form><input id="e" form="one" name="g" type="radio" tabindex="0"><input id="free" name="g" type="radio" tabindex="0"><input id="unnamed-a" type="radio" tabindex="0"><input id="unnamed-b" type="radio" tabindex="0"><div id="host"></div>';
    const shadow = scope.querySelector('#host')!.attachShadow({ mode: 'open' });
    shadow.innerHTML =
      '<input id="inner-a" type="radio" name="g" tabindex="0"><input id="inner-b" type="radio" name="g" tabindex="0" checked>';
    document.body.append(scope);
    try {
      expect(sampleWebComponentScopeTargets(scope).targets.map((el) => el.id)).toEqual([
        'b',
        'd',
        'free',
        'unnamed-a',
        'unnamed-b',
        'inner-b',
      ]);
      // Happy DOM unchecks same-name radios across different form owners on
      // property writes. Dynamic form-owner selection is asserted in Chrome.
    } finally {
      scope.remove();
    }
  });

  it('sorts tabindex within ShadowRoot and slot scopes before flattening', () => {
    const scope = document.createElement('div');
    const button = (index: number) => {
      const el = document.createElement('button');
      el.tabIndex = index;
      return el;
    };
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    const inner = button(1),
      outer = button(2),
      last = button(0);
    const slot = document.createElement('slot');
    const slotted = button(3),
      slottedFirst = button(1);
    host.append(slotted, slottedFirst);
    root.append(slot, inner);
    scope.append(host, outer, last);
    document.body.append(scope);
    try {
      expect(sampleWebComponentScopeTargets(scope).targets).toEqual([
        outer,
        inner,
        slottedFirst,
        slotted,
        last,
      ]);
      host.tabIndex = 1;
      expect(sampleWebComponentScopeTargets(scope).targets).toEqual([
        host,
        inner,
        slottedFirst,
        slotted,
        outer,
        last,
      ]);
      // Happy DOM's property setter removes tabindex=-1, unlike Chrome.
      host.setAttribute('tabindex', '-1');
      expect(sampleWebComponentScopeTargets(scope).targets).toEqual([outer, last]);
    } finally {
      scope.remove();
    }
  });
  it('excludes hidden inputs and unassociated areas inside an open shadow tree', () => {
    const scope = document.createElement('div');
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.tabIndex = 1;
    const area = document.createElement('area');
    area.href = '#test';
    area.tabIndex = 2;
    const usable = document.createElement('button');
    usable.tabIndex = 0;
    shadow.append(hidden, area, usable);
    scope.append(host);
    document.body.append(scope);
    try {
      expect(sampleWebComponentScopeTargets(scope).targets).toEqual([usable]);
    } finally {
      scope.remove();
    }
  });
  it('uses open shadow slot order, current eligibility and native focus without retaining targets', () => {
    const scope = document.createElement('div');
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const surface = document.createElement('div'),
      slot = document.createElement('slot');
    surface.append(slot);
    shadow.append(surface);
    const current = document.createElement('button'),
      inactive = document.createElement('button'),
      native = document.createElement('button');
    const panel = document.createElement('section');
    // happy-dom does not infer native button tabindex; native Chrome evidence
    // uses unmodified button defaults in the complete Dialog journey.
    current.tabIndex = 0;
    native.tabIndex = 0;
    inactive.tabIndex = -1;
    panel.append(native);
    host.append(current, inactive, panel);
    scope.append(host);
    document.body.append(scope);
    try {
      native.focus();
      expect(sampleWebComponentScopeTargets(scope)).toEqual({
        targets: [current, native],
        activeTarget: native,
      });
      panel.hidden = true;
      expect(sampleWebComponentScopeTargets(scope).targets).toEqual([current]);
      panel.hidden = false;
      native.disabled = true;
      panel.tabIndex = 0;
      expect(sampleWebComponentScopeTargets(scope).targets).toEqual([current, panel]);
      host.remove();
      expect(sampleWebComponentScopeTargets(scope).targets).toEqual([]);
    } finally {
      scope.remove();
    }
  });
});
