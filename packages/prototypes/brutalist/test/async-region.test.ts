import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import {
  BrutalistAsyncRegionRoot,
  asyncRegionRoot,
  brutalistAsyncRegionRoot,
} from '../src/async-region';
import * as BrutalistPackage from '../src';
import * as AsyncRegionEntry from '../src/async-region';
import type { BrutalistAsyncRegionRootProps } from '../src/async-region';

type SupportsBaseRootProps =
  Extract<'busy', keyof BrutalistAsyncRegionRootProps> extends never ? true : false;

type ExposingElement = HTMLElement & { getExposes(): Record<string, unknown> };

// Only the restrained family ink and bounded width belong to this layer; every
// busy/aria semantic stays Base-owned.
const ROOT_SURFACE_TOKENS = ['min-w-0', 'max-w-full', 'text-foreground'];
const FORBIDDEN_CHROME_TOKENS = [
  'border-2',
  'rounded-base',
  'shadow-[4px_4px_0_0_#000]',
  'bg-background',
  'cursor-pointer',
  'animate-spin',
  'animate-pulse',
];

// Motion/loading utility families are checked as prefixes because their real
// tokens carry suffixes (animate-*, transition-*, duration-*, ease-*).
const FORBIDDEN_MOTION_PREFIXES = ['animate-', 'transition-', 'duration-', 'ease-'];

AdaptToWebComponent(BrutalistAsyncRegionRoot);

function prototypeName(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('name' in value)) return null;
  return typeof value.name === 'string' ? value.name : null;
}

// Keep the package-wide set exact instead of filtering to already-known keys,
// which could hide new accidental async-region exports.
const EXPECTED_ASYNC_REGION_EXPORTS = {
  BrutalistAsyncRegionRoot: 'brutalist-async-region-root',
  brutalistAsyncRegionRoot: 'brutalist-async-region-root',
  asyncRegionRoot: 'brutalist-async-region-root',
};

function asyncRegionExports(entry: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(entry)
      .filter(
        ([name, value]) =>
          name.toLowerCase().includes('asyncregion') ||
          prototypeName(value)?.startsWith('brutalist-async-region-')
      )
      .map(([name, value]) => [name, prototypeName(value)])
  );
}

afterEach(() => document.body.replaceChildren());

describe('prototypes/brutalist: async-region', () => {
  it('exports exactly the admitted Root through family and package entries', () => {
    // T-BRUTALIST-ASYNC-REGION-0001-CASE-1
    expect(brutalistAsyncRegionRoot).toBe(BrutalistAsyncRegionRoot);
    expect(asyncRegionRoot).toBe(BrutalistAsyncRegionRoot);
    expect(BrutalistAsyncRegionRoot.name).toBe('brutalist-async-region-root');
    expect(asyncRegionExports(BrutalistPackage)).toEqual(EXPECTED_ASYNC_REGION_EXPORTS);
    expect(Object.keys(AsyncRegionEntry).sort()).toEqual([
      'BrutalistAsyncRegionRoot',
      'asyncRegionRoot',
      'brutalistAsyncRegionRoot',
    ]);
    const packageValues = new Map(Object.entries(BrutalistPackage));
    for (const [name, value] of Object.entries(AsyncRegionEntry)) {
      expect(packageValues.get(name)).toBe(value);
    }
    expectTypeOf<SupportsBaseRootProps>().toEqualTypeOf<false>();
    expectTypeOf<BrutalistAsyncRegionRootProps>().toEqualTypeOf<{ busy?: boolean }>();
  });

  it('rejects an unexpected package export', () => {
    const observed = asyncRegionExports({
      ...BrutalistPackage,
      unexpectedAsyncRegionExport: { name: 'brutalist-async-region-extra' },
    });
    expect(observed).toHaveProperty('unexpectedAsyncRegionExport');
    expect(observed).not.toEqual(EXPECTED_ASYNC_REGION_EXPORTS);
  });

  it('defaults to not-busy semantics, restrained ink and no interaction or loading chrome', async () => {
    // T-BRUTALIST-ASYNC-REGION-0001-CASE-2
    const el = document.createElement('brutalist-async-region-root') as ExposingElement;
    document.body.appendChild(el);
    await Promise.resolve();

    expect(el.getAttribute('aria-busy')).toBe('false');
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.hasAttribute('aria-label')).toBe(false);
    expect(el.tabIndex).toBe(-1);
    expect(Object.keys(el.getExposes()).sort()).toEqual(['busy']);
    expect(el.hasAttribute('data-pui-a11y-actions')).toBe(false);
    // Busy is a semantic fact only: the layer mounts no spinner, skeleton,
    // progress or toast child and owns no motion tokens.
    expect(
      el.querySelector('[role="progressbar"], [role="status"], [class*="animate"]')
    ).toBeNull();
    expect(el.children.length).toBe(0);

    for (const token of ROOT_SURFACE_TOKENS) {
      expect(styleContains(el, token), token).toBe(true);
    }
    for (const token of FORBIDDEN_CHROME_TOKENS) {
      expect(styleContains(el, token), token).toBe(false);
    }
    const styleTokens = (el.getAttribute('data-pui-style') ?? '').split(/\s+/);
    for (const prefix of FORBIDDEN_MOTION_PREFIXES) {
      expect(
        styleTokens.some((token) => token.startsWith(prefix)),
        `no motion token with prefix ${prefix}`
      ).toBe(false);
    }
    el.remove();
  });

  it('projects aria-busy true and back while preserving the authored payload on mounted transitions', async () => {
    // T-BRUTALIST-ASYNC-REGION-0001-CASE-3
    const el = document.createElement('brutalist-async-region-root') as HTMLElement & {
      getExposes(): { busy: { get(): boolean } };
    };
    el.appendChild(document.createTextNode('Authored results'));
    document.body.appendChild(el);
    await Promise.resolve();
    expect(el.textContent).toBe('Authored results');
    expect(el.getExposes().busy.get()).toBe(false);

    setElementProps(el, { busy: true });
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.getExposes().busy.get()).toBe(true);
    expect(el.textContent).toBe('Authored results');
    // The busy fact never materializes as a loading widget.
    expect(
      el.querySelector('[role="progressbar"], [role="status"], [class*="animate"]')
    ).toBeNull();

    setElementProps(el, { busy: false });
    expect(el.getAttribute('aria-busy')).toBe('false');
    expect(el.getExposes().busy.get()).toBe(false);
    await Promise.resolve();
    expect(el.textContent).toBe('Authored results');
    el.remove();
  });

  it('preserves authored descendants and focus on prop-only transitions', async () => {
    // T-BRUTALIST-ASYNC-REGION-0001-CASE-4
    const el = document.createElement('brutalist-async-region-root');
    const button = document.createElement('button');
    button.textContent = 'Retry';
    el.appendChild(button);
    document.body.appendChild(el);
    await Promise.resolve();
    button.focus();
    expect(document.activeElement).toBe(button);

    setElementProps(el, { busy: true });
    expect(el.textContent).toBe('Retry');
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(button);

    setElementProps(el, { busy: false });
    expect(el.textContent).toBe('Retry');
    expect(el.getAttribute('aria-busy')).toBe('false');
    expect(document.activeElement).toBe(button);
    el.remove();
  });
});
