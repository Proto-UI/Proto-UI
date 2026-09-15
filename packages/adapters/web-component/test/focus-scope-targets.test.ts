import { describe, it, expect } from 'vitest';
import { sampleWebComponentScopeTargets } from '../src/focus-scope-targets';
describe('WC scope sequential target sample', () => {
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
