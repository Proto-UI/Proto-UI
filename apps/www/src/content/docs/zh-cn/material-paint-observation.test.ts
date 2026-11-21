import { describe, expect, it } from 'vitest';
import { observeOwnedMaterialPaint } from './material-paint-observation';

function fixture(
  patch: Record<string, string | undefined> = {},
  marker: string | null = 'contact-v1'
) {
  const image = 'url("data:image/png;base64,AAAA")';
  const style = {
    backgroundImage: 'none',
    backdropFilter: 'none',
    borderLeftWidth: '1px',
    borderTopWidth: '1px',
  };
  const pseudo = {
    backgroundImage: image,
    left: '-10px',
    top: '-10px',
    width: '118px',
    height: '58px',
    content: '""',
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: '-1',
    visibility: 'visible',
    opacity: '1',
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    ...patch,
  };
  const receipt = {
    materialQuality: 'self-optical',
    materialSource: 'visible-app-canvas',
    materialContact: 'held',
    materialPhase: 'rest',
  };
  const rect = { left: 0, top: 0, width: 100, height: 40 };
  const element = {
    ownerDocument: {
      defaultView: { getComputedStyle: (_el: unknown, part?: string) => (part ? pseudo : style) },
    },
    style: { getPropertyValue: (name: string) => (name === '--pui-material-image' ? image : '') },
    dataset: receipt,
    getAttribute: () => marker,
    getBoundingClientRect: () => rect,
    querySelectorAll: () => [],
  } as unknown as Element;
  return { element, style, pseudo, receipt, rect };
}

describe('owned optical paint observation, independent of quality metadata', () => {
  it('accepts only this host committed contact image with its real expanded geometry', () => {
    const { element } = fixture();
    expect(observeOwnedMaterialPaint(element)).toMatchObject({
      committed: true,
      geometryMatches: true,
      carrier: 'contact-v1',
      expectedCarrierGeometry: { left: -10, top: -10, width: 118, height: 58 },
    });
  });
  it.each(['idle', 'hover', 'focus'])(
    'accepts the unexpanded %s carrier only with a neutral committed contact receipt',
    () => {
      const { element, receipt } = fixture({
        left: '-1px',
        top: '-1px',
        width: '100px',
        height: '40px',
      });
      receipt.materialContact = 'rest';
      expect(observeOwnedMaterialPaint(element)).toMatchObject({
        committed: true,
        geometryMatches: true,
        paintOutset: 0,
        expectedCarrierGeometry: { left: -1, top: -1, width: 100, height: 40 },
      });
    }
  );
  it.each([
    ['held', 'rest'],
    ['held', 'pressed'],
    ['release', 'rest'],
    ['rest', 'pressed'],
  ])('requires the bounded expansion for contact=%s phase=%s', (contact, phase) => {
    const { element, receipt, pseudo } = fixture();
    receipt.materialContact = contact;
    receipt.materialPhase = phase;
    expect(observeOwnedMaterialPaint(element)).toMatchObject({
      committed: true,
      paintOutset: 9,
    });
    Object.assign(pseudo, { left: '-1px', top: '-1px', width: '100px', height: '40px' });
    expect(observeOwnedMaterialPaint(element).committed).toBe(false);
  });
  it('does not infer engagement from an expanded actual carrier or an unknown receipt', () => {
    const { element, receipt } = fixture();
    receipt.materialContact = 'rest';
    expect(observeOwnedMaterialPaint(element).committed).toBe(false);
    for (const contact of ['', 'unknown']) {
      receipt.materialContact = contact;
      receipt.materialPhase = 'pressed';
      expect(observeOwnedMaterialPaint(element).committed).toBe(false);
    }
    receipt.materialContact = 'held';
    receipt.materialPhase = 'unknown';
    expect(observeOwnedMaterialPaint(element).committed).toBe(false);
  });
  it('recomputes the bound from host dimensions and rejects a scaled old carrier', () => {
    const { element, rect, pseudo } = fixture();
    Object.assign(rect, { width: 200, height: 80 });
    Object.assign(pseudo, { left: '-19px', top: '-19px', width: '236px', height: '116px' });
    expect(observeOwnedMaterialPaint(element).committed).toBe(false);
    Object.assign(pseudo, { left: '-18px', top: '-18px', width: '234px', height: '114px' });
    expect(observeOwnedMaterialPaint(element)).toMatchObject({
      committed: true,
      paintOutset: 17,
      expectedCarrierGeometry: { left: -18, top: -18, width: 234, height: 114 },
    });
  });
  it.each([
    { backgroundImage: 'none' },
    { backgroundImage: 'url("data:image/png;base64,BBBB")' },
    { left: '-9px' },
    { width: '100px' },
    { height: 'auto' },
    { content: '"author content"' },
    { position: 'relative' },
    { pointerEvents: 'auto' },
    { zIndex: '1' },
    { visibility: 'hidden' },
    { opacity: '0' },
    { backgroundSize: 'auto' },
    { backgroundRepeat: 'repeat' },
  ])('rejects corrupted carrier despite self-optical metadata: %j', (patch) => {
    const { element } = fixture(patch);
    expect(observeOwnedMaterialPaint(element).committed).toBe(false);
  });
  it('does not use an unowned pseudo image or a descendant as proof', () => {
    const { element } = fixture({}, null);
    expect(observeOwnedMaterialPaint(element)).toMatchObject({ image: 'none', committed: false });
  });
  it('rejects an unknown marker and duplicate host paint', () => {
    expect(observeOwnedMaterialPaint(fixture({}, 'foreign').element).committed).toBe(false);
    const { element, style } = fixture();
    style.backgroundImage = 'url("data:image/png;base64,AAAA")';
    expect(observeOwnedMaterialPaint(element).committed).toBe(false);
  });
  it('retains the existing direct-host path without claiming contact geometry', () => {
    const { element, style } = fixture({}, null);
    style.backgroundImage = 'url("data:image/png;base64,AAAA")';
    expect(observeOwnedMaterialPaint(element)).toMatchObject({ committed: true, carrier: null });
  });
});
