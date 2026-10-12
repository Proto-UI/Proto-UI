import { describe, expect, it } from 'vitest';
import {
  collectLiquidMaterialObservation,
  liquidMaterialSubjectSelector,
} from './liquid-material-observation';

describe('Liquid material diagnostic subject selection', () => {
  it('retains the existing Accordion and AlertDialog subjects', () => {
    expect(liquidMaterialSubjectSelector('accordion')).toBe(
      '[data-demo-ref$="-trigger"][aria-expanded]'
    );
    expect(liquidMaterialSubjectSelector('alert-dialog')).toBe('[role="alertdialog"]');
    expect(liquidMaterialSubjectSelector('drawer', 'panel')).toBeNull();
  });
  it.each([
    null,
    '',
    'two ids',
    'tab\tid',
    'line\nid',
    'form\fid',
    'return\rid',
    'nul\0id',
    '\ud800',
    '\udfff',
  ])('does not broaden a missing or invalid Popover ID %j to another dialog', (id) =>
    expect(liquidMaterialSubjectSelector('popover', id)).toBeNull()
  );
  it.each(['popover-content', '弹层-設定-🫧', 'punctuation:#.[]()=', 'non-breaking\u00a0space'])(
    'selects exactly the original ID %j and role without changing DOM',
    (id) => {
      const scope = document.createElement('div');
      const intended = document.createElement('div');
      intended.id = id;
      intended.setAttribute('role', 'dialog');
      const other = document.createElement('div');
      other.id = 'other';
      other.setAttribute('role', 'dialog');
      scope.append(intended, other);
      document.body.append(scope);
      try {
        const before = scope.outerHTML;
        const selector = liquidMaterialSubjectSelector('popover', id)!;
        expect(Array.from(scope.querySelectorAll(selector))).toEqual([intended]);
        expect(scope.outerHTML).toBe(before);
        intended.setAttribute('role', 'alertdialog');
        expect(scope.querySelectorAll(selector).length).toBe(0);
      } finally {
        scope.remove();
      }
    }
  );
  // Happy DOM 15 does not decode CSS hex escapes in attribute selectors, even
  // [id="\61 "] for id="a". These cases verify encoding, not native selection.
  it.each([
    ['with"quote', '[id="with\\22 quote"][role="dialog"]'],
    ['with\\slash', '[id="with\\5c slash"][role="dialog"]'],
    ['id"]#other[role="dialog', '[id="id\\22 ]#other[role=\\22 dialog"][role="dialog"]'],
    ['control\u0001a\u001fb\u007fc', '[id="control\\1 a\\1f b\\7f c"][role="dialog"]'],
  ])('encodes %j as one exact CSS string without substitution', (id, expected) => {
    const selector = liquidMaterialSubjectSelector('popover', id)!;
    expect(selector).toBe(expected);
    const serialized = selector.match(/^\[id="((?:\\[0-9a-f]{1,6} |[^"\\])*)"\]\[role="dialog"\]$/);
    expect(serialized).not.toBeNull();
    const decoded = serialized![1].replace(/\\([0-9a-f]{1,6}) /g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    );
    expect(decoded).toBe(id);
  });
  it('distinguishes no matching Content from a real Content with missing diagnostics', () => {
    const scope = document.createElement('div');
    const selector = liquidMaterialSubjectSelector('popover', 'content')!;
    const read = () =>
      Array.from(scope.querySelectorAll(selector)).map(collectLiquidMaterialObservation);
    document.body.append(scope);
    try {
      expect(read()).toEqual([]);
      const panel = document.createElement('div');
      panel.id = 'content';
      panel.setAttribute('role', 'dialog');
      scope.append(panel);
      const facts = read();
      expect(facts).toHaveLength(1);
      expect(facts[0]).toMatchObject({ connected: true, quality: null, reason: null });
    } finally {
      scope.remove();
    }
  });
});
describe('Liquid material diagnostics are observations, not inferred paint', () => {
  it('records the composed shadow-host path', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const subject = document.createElement('button');
    shadow.append(subject);
    document.body.append(host);
    try {
      const facts = collectLiquidMaterialObservation(subject);
      expect(facts.ancestors[0].parentRoute).toBe('shadow-host');
      expect(facts.ancestors[1].tag).toBe('div');
    } finally {
      host.remove();
    }
  });
  it('retains exact fallback, transformed/painted ancestor and disconnected source scope facts without mutation', () => {
    const scope = document.createElement('div'),
      canvas = document.createElement('canvas');
    scope.dataset.materialScene = 'visible-app-canvas';
    canvas.dataset.materialBackdrop = '';
    scope.append(canvas);
    document.body.append(scope);
    const item = document.createElement('div'),
      trigger = document.createElement('button');
    item.style.backgroundColor = '#fff';
    trigger.style.transform = 'translateX(1px)';
    trigger.dataset.materialQuality = 'opaque-fallback';
    trigger.dataset.materialReason = 'source-scope-unavailable';
    item.append(trigger);
    document.body.append(item);
    const before = document.body.innerHTML;
    try {
      const result = collectLiquidMaterialObservation(trigger);
      expect(result.quality).toBe('opaque-fallback');
      expect(result.reason).toBe('source-scope-unavailable');
      expect(result.transform).toBe('translateX(1px)');
      expect(result.ancestors[1].backgroundColor).toBe(getComputedStyle(item).backgroundColor);
      expect(result.sources[0].scopeContainsSubject).toBe(false);
      expect(document.body.innerHTML).toBe(before);
      delete trigger.dataset.materialQuality;
      delete trigger.dataset.materialReason;
      expect(collectLiquidMaterialObservation(trigger).quality).toBeNull();
      scope.append(item);
      expect(collectLiquidMaterialObservation(trigger).sources[0].scopeContainsSubject).toBe(true);
    } finally {
      scope.remove();
      item.remove();
    }
  });
});
