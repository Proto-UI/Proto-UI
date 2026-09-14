import { describe, expect, it } from 'vitest';
import {
  __HIT_PARTICIPATION_MODE_MARK,
  createWebHitParticipationHostBridge,
} from '@proto.ui/module-hit-participation';

describe('module-hit-participation: web host bridge', () => {
  it('HIT-ADAPTER-0100: disabled regions are projected to host pointer-events none', () => {
    const bridge = createWebHitParticipationHostBridge();
    const el = document.createElement('div') as unknown as HTMLElement & Record<symbol, unknown>;

    bridge.sync({
      config: { mode: 'disabled' },
      regions: [{ target: el, role: 'content' as any, mode: 'disabled' }],
    });

    expect(el.style.pointerEvents).toBe('none');
    expect(el[__HIT_PARTICIPATION_MODE_MARK]).toBe('disabled');
  });

  it('HIT-ADAPTER-0200: passthrough remains distinguishable from disabled at the host bridge layer', () => {
    const bridge = createWebHitParticipationHostBridge();
    const el = document.createElement('div') as unknown as HTMLElement & Record<symbol, unknown>;

    bridge.sync({
      config: { mode: 'passthrough' },
      regions: [{ target: el, role: 'content' as any, mode: 'passthrough' }],
    });

    expect(el.style.pointerEvents).toBe('none');
    expect(el[__HIT_PARTICIPATION_MODE_MARK]).toBe('passthrough');
  });

  it('HIT-ADAPTER-0300: participating restores the previous host pointer-events value', () => {
    const bridge = createWebHitParticipationHostBridge();
    const el = document.createElement('div') as unknown as HTMLElement & Record<symbol, unknown>;
    el.style.pointerEvents = 'auto';

    bridge.sync({
      config: { mode: 'disabled' },
      regions: [{ target: el, role: 'content' as any, mode: 'disabled' }],
    });
    bridge.sync({
      config: { mode: 'participating' },
      regions: [{ target: el, role: 'content' as any, mode: 'participating' }],
    });

    expect(el.style.pointerEvents).toBe('auto');
    expect(el[__HIT_PARTICIPATION_MODE_MARK]).toBe('participating');
  });

  it('HIT-ADAPTER-0400: removing a region clears the previously projected host state', () => {
    const bridge = createWebHitParticipationHostBridge();
    const el = document.createElement('div') as unknown as HTMLElement & Record<symbol, unknown>;

    bridge.sync({
      config: { mode: 'disabled' },
      regions: [{ target: el, role: 'content' as any, mode: 'disabled' }],
    });
    bridge.sync({
      config: { mode: 'participating' },
      regions: [],
    });

    expect(el.style.pointerEvents).toBe('');
    expect(el[__HIT_PARTICIPATION_MODE_MARK]).toBeUndefined();
  });

  it('HIT-ADAPTER-0500: non-host targets are ignored instead of crashing the bridge', () => {
    const bridge = createWebHitParticipationHostBridge();

    expect(() =>
      bridge.sync({
        config: { mode: 'disabled' },
        regions: [{ target: { opaque: true }, role: 'content' as any, mode: 'disabled' }],
      })
    ).not.toThrow();
  });
  it.each([false, true])(
    'T-HIT-PARTICIPATION-0001-CASE-SHARING: final owner restores the original declaration (reverse=%s)',
    (reverse) => {
      const target = document.createElement('div');
      target.style.setProperty('pointer-events', 'auto', 'important');
      const owners = [createWebHitParticipationHostBridge(), createWebHitParticipationHostBridge()];
      const claim = {
        config: { mode: 'disabled' as const },
        regions: [{ target, mode: 'disabled' as const }],
      };
      for (const owner of owners) owner.sync(claim);
      if (reverse) owners.reverse();
      owners[0].sync({ config: claim.config, regions: [] });
      expect(target.style.pointerEvents).toBe('none');
      owners[1].sync({ config: claim.config, regions: [] });
      expect(target.style.pointerEvents).toBe('auto');
      expect(target.style.getPropertyPriority('pointer-events')).toBe('important');
      owners[1].sync({ config: claim.config, regions: [] });
      expect(target.style.pointerEvents).toBe('auto');
    }
  );

  it.each(['participating', 'passthrough'] as const)(
    'T-HIT-PARTICIPATION-0001-CASE-CONFLICT: rejects %s before changing any region',
    (mode) => {
      const target = document.createElement('div');
      const previous = document.createElement('div');
      const fresh = document.createElement('div');
      previous.style.pointerEvents = 'auto';
      const first = createWebHitParticipationHostBridge();
      const second = createWebHitParticipationHostBridge();
      first.sync({ config: { mode: 'disabled' }, regions: [{ target, mode: 'disabled' }] });
      second.sync({
        config: { mode: 'disabled' },
        regions: [{ target: previous, mode: 'disabled' }],
      });
      expect(() =>
        second.sync({
          config: { mode },
          regions: [
            { target: fresh, mode },
            { target, mode },
          ],
        })
      ).toThrow(/conflicting.*mode/i);
      expect(previous.style.pointerEvents).toBe('none');
      expect(fresh.style.pointerEvents).toBe('');
      expect(target.style.pointerEvents).toBe('none');
      second.sync({ config: { mode: 'disabled' }, regions: [] });
      expect(previous.style.pointerEvents).toBe('auto');
      expect(target.style.pointerEvents).toBe('none');
      first.sync({ config: { mode: 'disabled' }, regions: [] });
    }
  );
});
