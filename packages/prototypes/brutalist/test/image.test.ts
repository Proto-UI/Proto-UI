import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import { BrutalistImageRoot, brutalistImageRoot } from '../src/image';
import * as BrutalistPackage from '../src';
import * as ImageEntry from '../src/image';
import type { BrutalistImageRootProps } from '../src/image';

type HasUnsupportedRootApi =
  Extract<
    'onLoad' | 'onError' | 'appearance' | 'rounded' | 'elevation',
    keyof BrutalistImageRootProps
  > extends never
    ? false
    : true;

type ExposingElement = HTMLElement & { getExposes(): Record<string, any> };

const IMAGE_SURFACE_TOKENS = [
  'block',
  'max-w-full',
  'h-auto',
  'rounded-base',
  'border-2',
  'border-black',
  'shadow-[4px_4px_0_0_#000]',
];

AdaptToWebComponent(BrutalistImageRoot as any);

async function settle(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

async function mount(props: Record<string, unknown> = {}) {
  const root = document.createElement(BrutalistImageRoot.name) as ExposingElement;
  setElementProps(root, props as any);
  document.body.appendChild(root);
  await settle();
  const image = root.querySelector('img');
  if (!image) throw new Error('Image View did not materialize its target');
  return { root, image };
}

function prototypeName(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('name' in value)) return null;
  return typeof value.name === 'string' ? value.name : null;
}

// Keep the package-wide set exact instead of filtering to already-known keys,
// which could hide new accidental image exports.
const EXPECTED_IMAGE_EXPORTS = {
  BrutalistImageRoot: 'brutalist-image-root',
  brutalistImageRoot: 'brutalist-image-root',
};

function imageExports(entry: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(entry)
      .filter(
        ([name, value]) =>
          (name.toLowerCase().includes('image') ||
            prototypeName(value)?.startsWith('brutalist-image-')) &&
          !name.toLowerCase().includes('imageview')
      )
      .map(([name, value]) => [name, prototypeName(value)])
  );
}

afterEach(async () => {
  document.body.replaceChildren();
  await settle();
});

describe('prototypes/brutalist: image', () => {
  it('exports exactly the admitted Root through family and package entries', () => {
    // T-BRUTALIST-IMAGE-0001-CASE-1
    expect(brutalistImageRoot).toBe(BrutalistImageRoot);
    expect(BrutalistImageRoot.name).toBe('brutalist-image-root');
    expect(imageExports(BrutalistPackage)).toEqual(EXPECTED_IMAGE_EXPORTS);
    expect(Object.keys(ImageEntry).sort()).toEqual(['BrutalistImageRoot', 'brutalistImageRoot']);
    const packageValues = new Map(Object.entries(BrutalistPackage));
    for (const [name, value] of Object.entries(ImageEntry)) {
      expect(packageValues.get(name)).toBe(value);
    }
    // The inherited Image View module travels on the direct entry itself.
    expect(BrutalistImageRoot.modules).toHaveLength(1);
    expect(Object.isFrozen(BrutalistImageRoot.modules)).toBe(true);
    expect(BrutalistImageRoot.modules?.[0]?.config).toMatchObject({
      source: '',
      alternativeText: '',
      a11yMode: 'informative',
      fit: 'contain',
    });
    expectTypeOf<HasUnsupportedRootApi>().toEqualTypeOf<false>();
  });

  it.each([
    ['unexpectedImageExport', { name: 'brutalist-image-extra' }],
    ['unexpectedAlias', BrutalistImageRoot],
  ])('rejects an unexpected package export %s', (name, value) => {
    const observed = imageExports({ ...BrutalistPackage, [name]: value });
    expect(observed).toHaveProperty(name);
    expect(observed).not.toEqual(EXPECTED_IMAGE_EXPORTS);
  });

  it('projects the pinned framed-photo surface without owning dimensions or chrome', async () => {
    // T-BRUTALIST-IMAGE-0001-CASE-2
    const { root, image } = await mount({
      source: 'image:a',
      alternativeText: 'Framed sample',
    });

    // The family frame paints on the host-owned image target, not a wrapper.
    expect(root.querySelectorAll('img')).toHaveLength(1);
    expect(root.shadowRoot).toBe(null);
    for (const token of IMAGE_SURFACE_TOKENS) {
      expect(styleContains(image, token), token).toBe(true);
    }
    for (const rejected of [
      'w-[250px]',
      'aspect-4/3',
      'size-full',
      'aspect-square',
      'rounded-full',
      'bg-background',
      'font-base',
      'shadow-shadow',
    ]) {
      expect(styleContains(image, rejected), rejected).toBe(false);
    }
    // Passive frame: no loading, error, or interaction chrome of its own.
    expect(root.hasAttribute('role')).toBe(false);
    expect(image.tabIndex).toBe(-1);
    const tokens = (image.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
    // Only neutralizing responsive tokens may appear; no fixed dimension.
    const owned = tokens.filter(
      (token) =>
        /^(?:w|h|min-w|min-h|max-w|max-h|size)-/.test(token) &&
        !['max-w-full', 'h-auto'].includes(token)
    );
    expect(owned).toEqual([]);
    expect(tokens.some((token) => /(?:animate|motion|transition)/.test(token))).toBe(false);
  });

  it('keeps source, a11y binary, fit, generation and loadingStatus Base-owned', async () => {
    // T-BRUTALIST-IMAGE-0001-CASE-3
    const requests: Array<{ resolve(): void; reject(error?: unknown): void }> = [];
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(() => {
      const { promise, resolve, reject } = Promise.withResolvers<void>();
      requests.push({ resolve: () => resolve(undefined), reject });
      return promise;
    });

    const { root, image } = await mount({
      source: 'image:a',
      alternativeText: 'First image',
      a11yMode: 'informative',
      fit: 'cover',
    });
    const changes: string[] = [];
    root.addEventListener('loadingStatusChange', (event) =>
      changes.push((event as CustomEvent<{ status: string }>).detail.status)
    );
    await settle();

    const exposes = root.getExposes();
    expect(image.getAttribute('src')).toBe('image:a');
    expect(image.alt).toBe('First image');
    expect(image.style.objectFit).toBe('cover');
    expect(exposes.loadingStatus.get()).toBe('loading');
    expect(exposes.fit.get()).toBe('cover');
    expect(requests).toHaveLength(1);
    // The frame keeps painting across the loading transition.
    for (const token of IMAGE_SURFACE_TOKENS) {
      expect(styleContains(image, token), token).toBe(true);
    }

    // A new source creates a new generation on the same physical image.
    setElementProps(root, {
      source: 'image:b',
      alternativeText: '',
      a11yMode: 'decorative',
      fit: 'contain',
    });
    await settle();
    expect(root.querySelector('img')).toBe(image);
    expect(image.getAttribute('src')).toBe('image:b');
    expect(image.alt).toBe('');
    expect(image.style.objectFit).toBe('contain');
    expect(exposes.source.get()).toBe('image:b');
    expect(exposes.loadingStatus.get()).toBe('loading');
    expect(requests).toHaveLength(2);

    // A stale completion from the obsolete source does not change state.
    requests[0]!.resolve();
    await settle();
    expect(exposes.loadingStatus.get()).toBe('loading');
    requests[1]!.resolve();
    await settle();
    expect(exposes.loadingStatus.get()).toBe('loaded');
    expect(changes.filter((status) => status === 'loaded')).toHaveLength(1);
    vi.restoreAllMocks();
  });
});
