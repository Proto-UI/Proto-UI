import { describe, it, expect } from 'vitest';
import {
  observeWebComponentRadioFocus,
  sampleWebComponentScopeTargets,
} from '../src/focus-scope-targets';
describe('WC scope sequential target sample', () => {
  it('samples HTML focusables below non-HTML containers such as foreignObject', () => {
    // C-AS-FOCUS-SCOPE-0002-J: composed traversal must not stop at SVG
    // boundaries; foreignObject content participates in document order.
    const scope = document.createElement('div');
    scope.innerHTML = '<button id="before" tabindex="0"></button>';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const foreign = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    const inner = document.createElement('button');
    inner.id = 'inner';
    inner.tabIndex = 0;
    foreign.append(inner);
    svg.append(foreign);
    scope.append(svg);
    const after = document.createElement('button');
    after.id = 'after';
    after.tabIndex = 0;
    scope.append(after);
    document.body.append(scope);
    try {
      expect(sampleWebComponentScopeTargets(scope).targets.map((el) => el.id)).toEqual([
        'before',
        'inner',
        'after',
      ]);
    } finally {
      scope.remove();
    }
  });

  it('keeps aria-disabled but still tabbable controls in the sample', () => {
    // aria-disabled does not remove a control from native sequential focus
    // navigation; only native disabled/inert/tabindex/visibility rules do.
    const scope = document.createElement('div');
    scope.innerHTML =
      '<button id="aria" tabindex="0" aria-disabled="true"></button><button id="plain" tabindex="0"></button><button id="native" tabindex="0" disabled></button>';
    document.body.append(scope);
    try {
      expect(sampleWebComponentScopeTargets(scope).targets.map((el) => el.id)).toEqual([
        'aria',
        'plain',
      ]);
    } finally {
      scope.remove();
    }
  });

  it('keeps aria-hidden wrappers with tabbable descendants in the sample', () => {
    // aria-hidden removes the subtree from the accessibility tree but not from
    // native sequential focus navigation; the substituted order must not jump
    // over a real native tab stop inside such a wrapper.
    const scope = document.createElement('div');
    scope.innerHTML =
      '<button id="before" tabindex="0"></button><div aria-hidden="true"><button id="wrapped" tabindex="0"></button></div><button id="after" tabindex="0"></button>';
    document.body.append(scope);
    try {
      expect(sampleWebComponentScopeTargets(scope).targets.map((el) => el.id)).toEqual([
        'before',
        'wrapped',
        'after',
      ]);
    } finally {
      scope.remove();
    }
  });

  it('excludes content-visibility:hidden subtrees from the sample', () => {
    // C-AS-FOCUS-SCOPE-0002-J: skipped content is not sequentially reachable.
    const scope = document.createElement('div');
    scope.innerHTML = '<button id="before" tabindex="0"></button>';
    const skipped = document.createElement('div');
    skipped.style.contentVisibility = 'hidden';
    skipped.innerHTML = '<button id="skipped" tabindex="0"></button>';
    scope.append(skipped);
    document.body.append(scope);
    try {
      expect(sampleWebComponentScopeTargets(scope).targets.map((el) => el.id)).toEqual(['before']);
    } finally {
      scope.remove();
    }
  });

  it('prunes a scope hidden by composed ancestors outside the container', () => {
    const carrier = document.createElement('div');
    const outer = document.createElement('div');
    const scope = document.createElement('div');
    scope.innerHTML = '<button id="inside" tabindex="0"></button>';
    outer.append(scope);
    carrier.append(outer);
    document.body.append(carrier);
    const sample = () => sampleWebComponentScopeTargets(scope).targets.map((el) => el.id);
    try {
      expect(sample()).toEqual(['inside']);
      outer.hidden = true;
      expect(sample()).toEqual([]);
      outer.hidden = false;
      outer.setAttribute('inert', '');
      expect(sample()).toEqual([]);
      outer.removeAttribute('inert');
      outer.style.display = 'none';
      expect(sample()).toEqual([]);
      outer.style.display = '';
      outer.style.contentVisibility = 'hidden';
      expect(sample()).toEqual([]);
      outer.style.contentVisibility = '';
      expect(sample()).toEqual(['inside']);

      const shadowCarrier = document.createElement('div');
      shadowCarrier.attachShadow({ mode: 'open' }).append(outer);
      carrier.append(shadowCarrier);
      shadowCarrier.hidden = true;
      expect(sample()).toEqual([]);
      shadowCarrier.hidden = false;
      expect(sample()).toEqual(['inside']);
    } finally {
      carrier.remove();
    }
  });

  it('includes a projected tabbable scope container in its native position', () => {
    // C-AS-FOCUS-SCOPE-0002-J: strategy:self projects a real native stop on
    // the scope owner; sampling must not erase that projected participation.
    const scope = document.createElement('div');
    scope.id = 'scope';
    scope.tabIndex = 0;
    scope.innerHTML = '<button id="child" tabindex="0"></button>';
    document.body.append(scope);
    try {
      expect(sampleWebComponentScopeTargets(scope).targets.map((el) => el.id)).toEqual([
        'scope',
        'child',
      ]);
    } finally {
      scope.remove();
    }
  });

  it('samples the editing host, not inherited-editability descendants', () => {
    // isContentEditable is inherited; only the contenteditable host is a
    // native sequential stop.
    const scope = document.createElement('div');
    scope.innerHTML =
      '<div id="editor" contenteditable=""><span id="plain">text</span><div id="nested">more</div></div><button id="after" tabindex="0"></button>';
    document.body.append(scope);
    try {
      expect(sampleWebComponentScopeTargets(scope).targets.map((el) => el.id)).toEqual([
        'editor',
        'after',
      ]);
    } finally {
      scope.remove();
    }
  });

  it('excludes image-map areas whose image is CSS-hidden and restores them when rendered', () => {
    const scope = document.createElement('div');
    scope.innerHTML =
      '<button id="before" tabindex="0"></button><div id="image-wrapper"><img id="map-image" src="data:x" usemap="#m" style="display:none"></div><map name="m"><area id="area" href="#a" tabindex="0" shape="rect" coords="0,0,10,10"></map><button id="after" tabindex="0"></button>';
    document.body.append(scope);
    const image = scope.querySelector<HTMLImageElement>('#map-image')!;
    const wrapper = scope.querySelector<HTMLElement>('#image-wrapper')!;
    const sample = () => sampleWebComponentScopeTargets(scope).targets.map((el) => el.id);
    try {
      expect(sample()).toEqual(['before', 'after']);
      image.style.display = '';
      expect(sample()).toEqual(['before', 'area', 'after']);
      image.style.visibility = 'hidden';
      expect(sample()).toEqual(['before', 'after']);
      image.style.visibility = '';
      wrapper.style.contentVisibility = 'hidden';
      expect(sample()).toEqual(['before', 'after']);
      wrapper.style.contentVisibility = '';
      expect(sample()).toEqual(['before', 'area', 'after']);
    } finally {
      scope.remove();
    }
  });

  it('excludes image-map areas when the associated slotted image has a hidden flat-tree ancestor', () => {
    const scope = document.createElement('div');
    scope.innerHTML =
      '<map name="slotted-map"><area id="slotted-area" href="#a" tabindex="0"></map>';
    const carrier = document.createElement('div');
    const shadow = carrier.attachShadow({ mode: 'open' });
    const hidden = document.createElement('div');
    hidden.hidden = true;
    const slot = document.createElement('slot');
    hidden.append(slot);
    shadow.append(hidden);
    const image = document.createElement('img');
    image.src = 'data:x';
    image.useMap = '#slotted-map';
    carrier.append(image);
    // Happy DOM does not project assignedSlot. Inject only that host fact;
    // the sampler still owns and observes the composed-ancestor decision.
    Object.defineProperty(image, 'assignedSlot', { configurable: true, value: slot });
    document.body.append(scope, carrier);
    try {
      expect(image.assignedSlot).toBe(slot);
      expect(sampleWebComponentScopeTargets(scope).targets).toEqual([]);
      hidden.hidden = false;
      expect(sampleWebComponentScopeTargets(scope).targets.map((el) => el.id)).toEqual([
        'slotted-area',
      ]);
    } finally {
      scope.remove();
      carrier.remove();
    }
  });

  it('remembers the most recent native in-scope focus for trap recovery', () => {
    // C-AS-FOCUS-SCOPE-0002-I: pointer/programmatic focus is observed by the
    // view lease, including when focus later leaves the scope entirely.
    const scope = document.createElement('div');
    scope.innerHTML = '<button id="a" tabindex="0"></button><button id="b" tabindex="0"></button>';
    document.body.append(scope);
    const a = scope.querySelector<HTMLElement>('#a')!;
    const b = scope.querySelector<HTMLElement>('#b')!;
    const history = observeWebComponentRadioFocus(scope);
    try {
      expect(history.recent()).toBeNull();
      b.focus();
      expect(history.recent()).toBe(b);
      a.focus();
      expect(history.recent()).toBe(a);
      // Focus leaving the scope (blank area) must not clear the anchor.
      (document.body as HTMLElement).tabIndex = -1;
      document.body.focus();
      expect(history.recent()).toBe(a);
      a.remove();
      expect(history.recent()).toBeNull();
    } finally {
      history.dispose();
      scope.remove();
      (document.body as HTMLElement).removeAttribute('tabindex');
    }
  });

  it('surfaces the remembered focus through the sampler for module recovery', () => {
    const scope = document.createElement('div');
    scope.innerHTML =
      '<button id="a" tabindex="0"></button><button id="b" tabindex="0"></button><button id="c" tabindex="0"></button>';
    document.body.append(scope);
    const b = scope.querySelector<HTMLElement>('#b')!;
    const history = observeWebComponentRadioFocus(scope);
    try {
      b.focus();
      (document.body as HTMLElement).tabIndex = -1;
      document.body.focus();
      const sample = sampleWebComponentScopeTargets(scope, undefined, 'next', history.order, () =>
        history.recent()
      );
      expect(sample.recentTarget).toBe(b);
      expect(sample.targets.map((el) => el.id)).toEqual(['a', 'b', 'c']);
    } finally {
      history.dispose();
      scope.remove();
      (document.body as HTMLElement).removeAttribute('tabindex');
    }
  });

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
  it('retains the traversal position of deep focus inside a negative-tabindex shadow host', () => {
    const scope = document.createElement('div');
    const before = document.createElement('button');
    before.id = 'before';
    before.tabIndex = 0;
    const host = document.createElement('div');
    host.id = 'negative-host';
    host.setAttribute('tabindex', '-1');
    const root = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('button');
    inner.id = 'inner';
    inner.tabIndex = 0;
    root.append(inner);
    const after = document.createElement('button');
    after.id = 'after';
    after.tabIndex = 0;
    scope.append(before, host, after);
    document.body.append(scope);
    try {
      inner.focus();
      expect(sampleWebComponentScopeTargets(scope)).toEqual({
        targets: [before, after],
        activeTarget: inner,
        recentTarget: null,
        activeInsertionIndex: 1,
      });
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
        recentTarget: null,
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
