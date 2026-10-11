import { describe, expect, it } from 'vitest';
import { collectLiquidMaterialObservation } from './liquid-material-observation';
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
