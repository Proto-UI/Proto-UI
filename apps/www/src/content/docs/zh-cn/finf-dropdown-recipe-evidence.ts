import type { Locator } from 'playwright-core';
import type { DemoRenderResult, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';
import type { RuntimeId } from '../../../components/PrototypePreviewer/runtimes/ids';

export const DROPDOWN_DEMOS = {
  destructive: 'demo-shadcn-dropdown-destructive',
  inset: 'demo-shadcn-dropdown-inset',
} as const;
export type DropdownRecipe = keyof typeof DROPDOWN_DEMOS;
export const dropdownPreviewSelector = (recipe: DropdownRecipe) =>
  `[data-previewer-id][data-demo-id="${DROPDOWN_DEMOS[recipe]}"]`;

export const dropdownEvidenceRecipes = [
  { recipe: 'destructive', profile: 'new-york-v4' },
  { recipe: 'inset', profile: 'new-york-v4' },
  { recipe: 'inset', profile: 'rhea' },
] as const;

export const dropdownInsetRem = { 'new-york-v4': 2, rhea: 1.75 } as const;
export const dropdownFixtureSelector = (recipe: DropdownRecipe) =>
  `[data-dropdown-evidence-fixture="${recipe}"]`;

export function newYorkDropdownDemo(original: DemoSpec): DemoSpec {
  if (
    original.root.kind !== 'proto' ||
    original.root.prototypeId !== 'shadcn-style-scope' ||
    original.root.props?.styleProfile !== 'rhea'
  )
    throw new Error('Public Shadcn Dropdown recipe must retain its declared Rhea scope.');
  const root = structuredClone(original.root);
  root.props = { ...root.props, styleProfile: 'new-york-v4' };
  return { ...original, root };
}

/** Render a separate consumer of the authored recipe under the fixed New York scope. */
export async function mountNewYorkDropdownFixture(recipe: DropdownRecipe, runtime: RuntimeId) {
  const { loadDemo } = await import('../../../components/PrototypePreviewer/demo-modules');
  const { renderDemo } = await import('../../../components/PrototypePreviewer/demo-renderer');
  const { collectPrototypeIds } = await import('../../../components/PrototypePreviewer/demo-types');
  const { loadPrototypes } =
    await import('../../../components/PrototypePreviewer/prototype-modules');
  const { resolveProjectionThemeSurfaceStyle } =
    await import('../../../components/PrototypePreviewer/projection-theme');
  const { createRuntimePreviewSurface, runtimePreviewFamily } =
    await import('../../../components/PrototypePreviewer/runtime-preview-surface');
  const previewer = document.querySelector<HTMLElement>(dropdownPreviewSelector(recipe));
  if (!previewer || runtimePreviewFamily(previewer) !== 'shadcn')
    throw new Error('Public Shadcn Dropdown preview missing.');
  const original = await loadDemo(DROPDOWN_DEMOS[recipe]);
  const surface = createRuntimePreviewSurface(
    newYorkDropdownDemo(original),
    'shadcn',
    resolveProjectionThemeSurfaceStyle('shadcn', previewer),
    runtime
  );
  const ids = new Set<string>();
  collectPrototypeIds(surface.demo.root, ids);
  const host = document.createElement('div');
  host.dataset.dropdownEvidenceFixture = recipe;
  document.body.append(host);
  let view: DemoRenderResult | undefined;
  try {
    await loadPrototypes([...ids]);
    view = await renderDemo({ host, demo: surface.demo, runtime });
    await surface.ready;
  } catch (error) {
    try {
      await view?.destroy();
    } finally {
      host.remove();
    }
    throw error;
  }

  const mountedView = view;
  return {
    publicProfile: 'rhea',
    fixtureProfile: 'new-york-v4',
    async destroy() {
      try {
        await mountedView.destroy();
      } finally {
        host.remove();
      }
    },
  } as const;
}

/** Canvas resolves the browser's real computed paint without adding DOM/CSS. */
export async function observeDropdownItem(item: Locator, tintPercent: number) {
  return item.evaluate((element, percent) => {
    const css = getComputedStyle(element);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas is required for computed color observations.');
    const rgba = (color: string) => {
      if (!CSS.supports('color', color)) throw new Error(`Unresolved color: ${color}`);
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const destructive = css.getPropertyValue('--color-destructive').trim();
    const svg = element.querySelector('svg');
    return {
      background: css.backgroundColor,
      foreground: css.color,
      backgroundRgba: rgba(css.backgroundColor),
      foregroundRgba: rgba(css.color),
      expectedBackgroundRgba: rgba(`color-mix(in oklab, ${destructive} ${percent}%, transparent)`),
      expectedForegroundRgba: rgba(destructive),
      iconRgba: svg ? rgba(getComputedStyle(svg).stroke) : null,
      focused: element === document.activeElement,
      focusVisible: element.hasAttribute('data-focus-visible'),
      pressed: element.hasAttribute('data-pressed'),
      hovered: element.hasAttribute('data-hovered'),
      active: element.hasAttribute('data-active'),
      disabled: element.getAttribute('aria-disabled'),
      opacity: css.opacity,
      pointerEvents: css.pointerEvents,
    };
  }, tintPercent);
}

export function channelsClose(actual: readonly number[], expected: readonly number[]): boolean {
  return (
    actual.length === 4 &&
    expected.length === 4 &&
    actual.every(
      (value, index) =>
        Number.isFinite(value) &&
        Number.isFinite(expected[index]) &&
        Math.abs(value - expected[index]!) <= 2
    )
  );
}

export async function observeDropdownGeometry(locator: Locator) {
  return locator.evaluate((element) => {
    const css = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    let textX: number | null = null;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim() || node.parentElement?.closest('svg')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      textX = range.getBoundingClientRect().x;
      break;
    }
    const svg = element.querySelector('svg');
    const icon = svg?.getBoundingClientRect();
    return {
      x: rect.x,
      width: rect.width,
      height: rect.height,
      textX,
      paddingLeft: Number.parseFloat(css.paddingLeft),
      paddingRight: Number.parseFloat(css.paddingRight),
      direction: css.direction,
      rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      icon:
        svg && icon
          ? {
              width: icon.width,
              height: icon.height,
              viewBox: svg.getAttribute('viewBox'),
              paths: [...svg.querySelectorAll('path')].map((shape) => shape.getAttribute('d')),
              shapes: svg.querySelectorAll('path,rect,circle,line,polyline,polygon,ellipse').length,
            }
          : null,
    };
  });
}

/** Missing ID relationships are a failure, including the null === null case. */
export function hasNamedDropdownGroup(
  role: string | null,
  labelledBy: string | null,
  labelId: string | null
): boolean {
  return role === 'group' && Boolean(labelId?.trim()) && labelledBy === labelId;
}
