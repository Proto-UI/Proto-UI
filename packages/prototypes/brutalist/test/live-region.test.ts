import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import {
  BrutalistLiveRegionRoot,
  brutalistLiveRegionRoot,
  liveRegionRoot,
} from '../src/live-region';
import * as BrutalistPackage from '../src';
import * as LiveRegionEntry from '../src/live-region';
import type { BrutalistLiveRegionRootProps } from '../src/live-region';

type SupportsBaseRootProps =
  Extract<'politeness' | 'atomic', keyof BrutalistLiveRegionRootProps> extends never ? true : false;

type ExposingElement = HTMLElement & { getExposes(): Record<string, unknown> };

// Only the restrained family ink and bounded width belong to this layer; every
// semantic role/aria attribute stays Base-owned.
const ROOT_SURFACE_TOKENS = ['min-w-0', 'max-w-full', 'text-foreground'];
const FORBIDDEN_CHROME_TOKENS = [
  'border-2',
  'rounded-base',
  'shadow-[4px_4px_0_0_#000]',
  'bg-background',
  'cursor-pointer',
];

AdaptToWebComponent(BrutalistLiveRegionRoot);

function prototypeName(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('name' in value)) return null;
  return typeof value.name === 'string' ? value.name : null;
}

// Keep the package-wide set exact instead of filtering to already-known keys,
// which could hide new accidental live-region exports.
const EXPECTED_LIVE_REGION_EXPORTS = {
  BrutalistLiveRegionRoot: 'brutalist-live-region-root',
  brutalistLiveRegionRoot: 'brutalist-live-region-root',
  liveRegionRoot: 'brutalist-live-region-root',
};

function liveRegionExports(entry: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(entry)
      .filter(
        ([name, value]) =>
          name.toLowerCase().includes('liveregion') ||
          prototypeName(value)?.startsWith('brutalist-live-region-')
      )
      .map(([name, value]) => [name, prototypeName(value)])
  );
}

afterEach(() => document.body.replaceChildren());

describe('prototypes/brutalist: live-region', () => {
  it('exports exactly the admitted Root through family and package entries', () => {
    // T-BRUTALIST-LIVE-REGION-0001-CASE-1
    expect(brutalistLiveRegionRoot).toBe(BrutalistLiveRegionRoot);
    expect(liveRegionRoot).toBe(BrutalistLiveRegionRoot);
    expect(BrutalistLiveRegionRoot.name).toBe('brutalist-live-region-root');
    expect(liveRegionExports(BrutalistPackage)).toEqual(EXPECTED_LIVE_REGION_EXPORTS);
    expect(Object.keys(LiveRegionEntry).sort()).toEqual([
      'BrutalistLiveRegionRoot',
      'brutalistLiveRegionRoot',
      'liveRegionRoot',
    ]);
    const packageValues = new Map(Object.entries(BrutalistPackage));
    for (const [name, value] of Object.entries(LiveRegionEntry)) {
      expect(packageValues.get(name)).toBe(value);
    }
    expectTypeOf<SupportsBaseRootProps>().toEqualTypeOf<false>();
    expectTypeOf<BrutalistLiveRegionRootProps>().toEqualTypeOf<{
      politeness?: 'polite' | 'assertive';
      atomic?: boolean;
    }>();
  });

  it('rejects an unexpected package export', () => {
    const observed = liveRegionExports({
      ...BrutalistPackage,
      unexpectedLiveRegionExport: { name: 'brutalist-live-region-extra' },
    });
    expect(observed).toHaveProperty('unexpectedLiveRegionExport');
    expect(observed).not.toEqual(EXPECTED_LIVE_REGION_EXPORTS);
  });

  it('defaults to polite status semantics, atomic true, restrained ink and no interaction', async () => {
    // T-BRUTALIST-LIVE-REGION-0001-CASE-2
    const el = document.createElement('brutalist-live-region-root') as ExposingElement;
    document.body.appendChild(el);
    await Promise.resolve();

    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.getAttribute('aria-atomic')).toBe('true');
    expect(el.tabIndex).toBe(-1);
    expect(el.hasAttribute('aria-label')).toBe(false);
    expect(Object.keys(el.getExposes())).toEqual([]);
    expect(el.hasAttribute('data-pui-a11y-actions')).toBe(false);

    for (const token of ROOT_SURFACE_TOKENS) {
      expect(styleContains(el, token), token).toBe(true);
    }
    for (const token of FORBIDDEN_CHROME_TOKENS) {
      expect(styleContains(el, token), token).toBe(false);
    }
    el.remove();
  });

  it('projects assertive role and aria-atomic false from the inherited Base props', async () => {
    // T-BRUTALIST-LIVE-REGION-0001-CASE-3
    const el = document.createElement('brutalist-live-region-root') as ExposingElement;
    setElementProps(el, { politeness: 'assertive' });
    document.body.appendChild(el);
    await Promise.resolve();

    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
    expect(el.getAttribute('aria-atomic')).toBe('true');

    setElementProps(el, { politeness: 'polite', atomic: false });
    await Promise.resolve();
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.getAttribute('aria-atomic')).toBe('false');
    el.remove();
  });

  it('synchronizes mounted prop transitions and preserves the authored announcement payload', async () => {
    // T-BRUTALIST-LIVE-REGION-0001-CASE-4
    const el = document.createElement('brutalist-live-region-root') as ExposingElement;
    el.appendChild(document.createTextNode('3 new notifications'));
    document.body.appendChild(el);
    await Promise.resolve();
    expect(el.textContent).toBe('3 new notifications');

    setElementProps(el, { politeness: 'assertive', atomic: false });
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
    expect(el.getAttribute('aria-atomic')).toBe('false');

    await Promise.resolve();
    await Promise.resolve();
    expect(el.textContent).toBe('3 new notifications');

    setElementProps(el, { politeness: 'polite', atomic: true });
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.getAttribute('aria-atomic')).toBe('true');
    await Promise.resolve();
    expect(el.textContent).toBe('3 new notifications');
    el.remove();
  });
});
