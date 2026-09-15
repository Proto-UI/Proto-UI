import { describe, expect, it } from 'vitest';
import { createZIndexOverlayLayerScheduler } from '@proto.ui/module-overlay';

function req(role: string) {
  return {
    role: role as any,
    offset: 0,
    modal: false,
    portal: false,
  };
}

describe('module-overlay: z-index layer scheduler', () => {
  it('keeps dialog mask above generic overlay regardless of attach order', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');

    const scheduler1 = createZIndexOverlayLayerScheduler();
    const offOverlay1 = scheduler1.attach(a, req('overlay'));
    const offMask1 = scheduler1.attach(b, req('dialog-mask'));
    expect(Number(b.style.zIndex)).toBeGreaterThan(Number(a.style.zIndex));
    offMask1();
    offOverlay1();

    const scheduler2 = createZIndexOverlayLayerScheduler();
    const offMask2 = scheduler2.attach(b, req('dialog-mask'));
    const offOverlay2 = scheduler2.attach(a, req('overlay'));
    expect(Number(b.style.zIndex)).toBeGreaterThan(Number(a.style.zIndex));
    offOverlay2();
    offMask2();
  });

  it('keeps dialog content above dialog mask regardless of attach order', () => {
    const mask = document.createElement('div');
    const content = document.createElement('div');

    const scheduler1 = createZIndexOverlayLayerScheduler();
    const offMask1 = scheduler1.attach(mask, req('dialog-mask'));
    const offContent1 = scheduler1.attach(content, req('dialog-content'));
    expect(Number(content.style.zIndex)).toBeGreaterThan(Number(mask.style.zIndex));
    offContent1();
    offMask1();

    const scheduler2 = createZIndexOverlayLayerScheduler();
    const offContent2 = scheduler2.attach(content, req('dialog-content'));
    const offMask2 = scheduler2.attach(mask, req('dialog-mask'));
    expect(Number(content.style.zIndex)).toBeGreaterThan(Number(mask.style.zIndex));
    offMask2();
    offContent2();
  });

  it('restores previous inline z-index on detach', () => {
    const el = document.createElement('div');
    el.style.zIndex = '42';

    const scheduler = createZIndexOverlayLayerScheduler();
    const off = scheduler.attach(el, req('dialog-content'));

    expect(el.style.zIndex).not.toBe('42');
    off();
    expect(el.style.zIndex).toBe('42');
  });
});

it('T-OVERLAY-CATALOG-0001-CASE-LAYER: restores inline priority once and cannot undo a later lease', () => {
  const el = document.createElement('div');
  el.style.setProperty('z-index', '42', 'important');
  const scheduler = createZIndexOverlayLayerScheduler();
  const off = scheduler.attach(el, req('overlay'));
  off();
  expect(el.style.getPropertyValue('z-index')).toBe('42');
  expect(el.style.getPropertyPriority('z-index')).toBe('important');
  const next = scheduler.attach(el, req('overlay'));
  const value = el.style.zIndex;
  off();
  expect(el.style.zIndex).toBe(value);
  next();
});
