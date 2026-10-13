import { afterEach, describe, expect, it, vi } from 'vitest';
import { snapshotStaticHitInset } from '@proto.ui/core';
import { createWebHitParticipationHostBridge } from '@proto.ui/module-hit-participation';

const inset = snapshotStaticHitInset({
  top: { value: 0.5, unit: 'rem' },
  right: { value: 0.75, unit: 'rem' },
  bottom: { value: 0.5, unit: 'rem' },
  left: { value: 0.75, unit: 'rem' },
});
const arg = (
  target: HTMLElement,
  mode: 'participating' | 'disabled' | 'passthrough' = 'participating'
) => ({ config: { mode }, regions: [{ target, mode, staticHitInset: inset }] });
const root = () => {
  const el = document.createElement('div');
  el.style.position = 'relative';
  document.body.append(el);
  return el;
};
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  document.head.querySelectorAll('style').forEach((x) => x.remove());
});

describe('static same-root hit inset generic Web projection', () => {
  it('claims a transparent same-root pseudo without changing root flow/paint style or creating semantic nodes', () => {
    const el = root();
    el.style.cssText += ';width:32px;height:18.4px;border:1px solid transparent';
    const before = el.style.cssText;
    const bridge = createWebHitParticipationHostBridge();
    bridge.sync(arg(el));
    expect(el.style.cssText).toBe(before);
    expect(el.children).toHaveLength(0);
    expect(el.getAttribute('tabindex')).toBeNull();
    const text = document.head.querySelector('style')!.textContent!;
    expect(text).toContain('top:-0.5rem!important');
    expect(text).toContain('right:-0.75rem!important');
    expect(text).toContain('pointer-events:inherit!important');
    expect(text).not.toMatch(/z-index:|opacity:|transform:|background:/);
    bridge.sync({ config: { mode: 'participating' }, regions: [] });
    expect(el.hasAttribute('data-pui-static-hit')).toBe(false);
    expect(document.head.querySelector('style')).toBeNull();
    expect(el.style.cssText).toBe(before);
  });
  it('preserves equal owner claims until last release and rejects geometry conflict before writes', () => {
    const el = root();
    const first = createWebHitParticipationHostBridge();
    const second = createWebHitParticipationHostBridge();
    first.sync(arg(el));
    second.sync(arg(el));
    const mark = el.getAttribute('data-pui-static-hit');
    const fresh = root();
    expect(() =>
      second.sync({
        config: { mode: 'participating' },
        regions: [
          arg(fresh).regions[0],
          { target: el, mode: 'participating', staticHitInset: snapshotStaticHitInset({}) },
        ],
      })
    ).toThrow(/conflicting/);
    expect(fresh.hasAttribute('data-pui-static-hit')).toBe(false);
    first.sync({ config: { mode: 'participating' }, regions: [] });
    expect(el.getAttribute('data-pui-static-hit')).toBe(mark);
    second.sync({ config: { mode: 'participating' }, regions: [] });
    expect(el.hasAttribute('data-pui-static-hit')).toBe(false);
  });
  it('rejects existing author pseudo content and non-positioned roots atomically', () => {
    const original = window.getComputedStyle.bind(window);
    const occupied = root();
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) =>
      pseudo && el === occupied
        ? ({ content: '"author"' } as CSSStyleDeclaration)
        : original(el, pseudo)
    );
    const bridge = createWebHitParticipationHostBridge();
    const fresh = root();
    expect(() =>
      bridge.sync({
        config: { mode: 'participating' },
        regions: [arg(fresh).regions[0], arg(occupied).regions[0]],
      })
    ).toThrow(/author already owns/);
    expect(fresh.hasAttribute('data-pui-static-hit')).toBe(false);
    const unpositioned = root();
    unpositioned.style.position = 'static';
    expect(() => bridge.sync(arg(unpositioned))).toThrow(/positioned padding-box/);
    expect(document.head.querySelector('style')).toBeNull();
  });
  it('replaces single-owner insets after all preflight and restores external later writes', () => {
    const el = root();
    el.style.setProperty('pointer-events', 'auto', 'important');
    const bridge = createWebHitParticipationHostBridge();
    bridge.sync(arg(el, 'disabled'));
    const first = el.getAttribute('data-pui-static-hit');
    bridge.sync({
      config: { mode: 'disabled' },
      regions: [
        {
          target: el,
          mode: 'disabled',
          staticHitInset: snapshotStaticHitInset({ top: { value: 2, unit: 'px' } }),
        },
      ],
    });
    expect(el.getAttribute('data-pui-static-hit')).not.toBe(first);
    expect(document.head.querySelectorAll('style')).toHaveLength(1);
    el.style.setProperty('pointer-events', 'visible', 'important');
    el.setAttribute('data-pui-static-hit', 'author-value');
    bridge.sync({ config: { mode: 'participating' }, regions: [] });
    expect(el.style.getPropertyValue('pointer-events')).toBe('visible');
    expect(el.style.getPropertyPriority('pointer-events')).toBe('important');
    expect(el.getAttribute('data-pui-static-hit')).toBe('author-value');
  });
  it('installs in the native shadow root scope and restores exact pointer-events priority', () => {
    const host = root();
    const shadow = host.attachShadow({ mode: 'open' });
    const el = root();
    shadow.append(el);
    el.style.setProperty('pointer-events', 'auto', 'important');
    const bridge = createWebHitParticipationHostBridge();
    bridge.sync(arg(el, 'passthrough'));
    expect(shadow.querySelector('style')).not.toBeNull();
    expect(el.style.pointerEvents).toBe('none');
    bridge.sync({ config: { mode: 'participating' }, regions: [] });
    expect(el.style.pointerEvents).toBe('auto');
    expect(el.style.getPropertyPriority('pointer-events')).toBe('important');
    expect(shadow.querySelector('style')).toBeNull();
  });
  it.each(['marker', 'style-remove', 'style-edit', 'position', 'display'])(
    'same-value sync revalidates external %s changes before any writes',
    (kind) => {
      const el = root();
      const bridge = createWebHitParticipationHostBridge();
      bridge.sync(arg(el));
      const fresh = root();
      if (kind === 'marker') el.setAttribute('data-pui-static-hit', 'author');
      if (kind === 'style-remove') document.head.querySelector('style')!.remove();
      if (kind === 'style-edit')
        document.head.querySelector('style')!.textContent = '/* author now owns this */';
      if (kind === 'position') el.style.position = 'static';
      if (kind === 'display') el.style.display = 'contents';
      expect(() =>
        bridge.sync({
          config: { mode: 'participating' },
          regions: [arg(fresh).regions[0], arg(el).regions[0]],
        })
      ).toThrow(/unsupported/);
      expect(fresh.hasAttribute('data-pui-static-hit')).toBe(false);
      bridge.sync({ config: { mode: 'participating' }, regions: [] });
      if (kind === 'marker') expect(el.getAttribute('data-pui-static-hit')).toBe('author');
      if (kind === 'style-edit')
        expect(document.head.querySelector('style')!.textContent).toBe(
          '/* author now owns this */'
        );
    }
  );
  it.each(['input', 'textarea', 'select', 'img', 'canvas'])(
    'rejects replaced %s rather than silently losing extension',
    (tag) => {
      const el = document.createElement(tag);
      el.style.cssText = 'position:relative;display:block';
      document.body.append(el);
      expect(() => createWebHitParticipationHostBridge().sync(arg(el))).toThrow(
        /single principal box/
      );
      expect(el.hasAttribute('data-pui-static-hit')).toBe(false);
    }
  );
  it('reserves only an inset ring and inherits native hidden/cursor state', () => {
    const el = root();
    const bridge = createWebHitParticipationHostBridge();
    bridge.sync(arg(el));
    const text = document.head.querySelector('style')!.textContent!;
    expect(text).toContain('visibility:inherit!important');
    expect(text).toContain('cursor:inherit!important');
    expect(text).toContain('clip-path:polygon(evenodd,');
    expect(text).toContain('0.75rem 0.5rem');
    bridge.sync({ config: { mode: 'participating' }, regions: [] });
  });
  it.each([
    'insert-rule',
    'delete-rule',
    'edit-rule',
    'sheet-disabled',
    'style-disabled',
    'media',
    'move',
  ])('CSSOM/state mutation %s loses ownership and survives cleanup', (kind) => {
    const el = root();
    const bridge = createWebHitParticipationHostBridge();
    bridge.sync(arg(el));
    const style = document.head.querySelector('style')!;
    const text = style.textContent;
    const sheet = style.sheet!;
    if (kind === 'insert-rule')
      sheet.insertRule('body { color: rgb(1, 2, 3) }', sheet.cssRules.length);
    if (kind === 'delete-rule') sheet.deleteRule(0);
    if (kind === 'edit-rule')
      (sheet.cssRules[0] as CSSStyleRule).style.setProperty('cursor', 'crosshair');
    if (kind === 'sheet-disabled') sheet.disabled = true;
    if (kind === 'style-disabled') style.disabled = true;
    if (kind === 'media') style.media = 'print';
    if (kind === 'move') document.body.append(style);
    expect(style.textContent).toBe(text);
    expect(() => bridge.sync(arg(el))).toThrow(/projection changed externally/);
    bridge.sync({ config: { mode: 'participating' }, regions: [] });
    expect(style.isConnected).toBe(true);
    expect(el.hasAttribute('data-pui-static-hit')).toBe(false);
  });
});

it.each(['fresh', 'existing'])(
  'rejects display:none %s claims before any projection mutation',
  (kind) => {
    const accepted = root();
    const hidden = root();
    const fresh = root();
    const bridge = createWebHitParticipationHostBridge();
    bridge.sync({
      config: { mode: 'participating' },
      regions: [arg(accepted).regions[0], ...(kind === 'existing' ? arg(hidden).regions : [])],
    });
    hidden.style.display = 'none';
    const before = document.documentElement.outerHTML;
    expect(() =>
      bridge.sync({
        config: { mode: 'disabled' },
        regions: [arg(fresh, 'disabled').regions[0], arg(hidden, 'disabled').regions[0]],
      })
    ).toThrow(/non-replaced single principal box/);
    expect(document.documentElement.outerHTML).toBe(before);
    expect(fresh.hasAttribute('data-pui-static-hit')).toBe(false);
    bridge.sync({ config: { mode: 'participating' }, regions: [] });
  }
);

it('rejects a missing document head without replacing old regions or leaking target ownership', () => {
  const old = root(),
    next = root();
  const bridge = createWebHitParticipationHostBridge();
  bridge.sync({ config: { mode: 'disabled' }, regions: [{ target: old, mode: 'disabled' }] });
  const head = document.head;
  head.remove();
  try {
    expect(() => bridge.sync(arg(next))).toThrow();
    expect(old.style.pointerEvents).toBe('none');
    bridge.sync({ config: { mode: 'participating' }, regions: [] });
    expect(old.style.pointerEvents).toBe('');
    const other = createWebHitParticipationHostBridge();
    expect(() =>
      other.sync({ config: { mode: 'disabled' }, regions: [{ target: next, mode: 'disabled' }] })
    ).not.toThrow();
    other.sync({ config: { mode: 'participating' }, regions: [] });
  } finally {
    document.documentElement.prepend(head);
  }
});

it('does not retain a phantom owner after initial inset activation fails', () => {
  const target = root();
  const bridge = createWebHitParticipationHostBridge();
  const head = document.head;
  head.remove();
  try {
    expect(() => bridge.sync(arg(target))).toThrow();
    bridge.sync({ config: { mode: 'participating' }, regions: [] });
    const other = createWebHitParticipationHostBridge();
    expect(() =>
      other.sync({ config: { mode: 'disabled' }, regions: [{ target, mode: 'disabled' }] })
    ).not.toThrow();
    other.sync({ config: { mode: 'participating' }, regions: [] });
  } finally {
    document.documentElement.prepend(head);
  }
});
