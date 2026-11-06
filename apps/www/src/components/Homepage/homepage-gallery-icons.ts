import { LUCIDE_BELL_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/bell';
import { LUCIDE_CHART_NO_AXES_COLUMN_INCREASING_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/chart-no-axes-column-increasing';
import { LUCIDE_CIRCLE_QUESTION_MARK_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/circle-question-mark';
import { LUCIDE_LAYERS_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/layers';
import { LUCIDE_MOUSE_POINTER_CLICK_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/mouse-pointer-click';
import { LUCIDE_SCAN_SEARCH_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/scan-search';
import { LUCIDE_SETTINGS_2_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/settings-2';
import { LUCIDE_SLIDERS_HORIZONTAL_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/sliders-horizontal';
import { LUCIDE_SQUARE_CHECK_BIG_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/square-check-big';
import { LUCIDE_TEXT_CURSOR_INPUT_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/text-cursor-input';
import type { DemoChild, DemoNode } from '../PrototypePreviewer/demo-types';

export type GalleryCardDensity = 'regular' | 'compact';
export type GalleryCardEmphasis = 'quiet' | 'standard' | 'accent';
export type GalleryCardBody = 'inset' | 'edge-media';

export type GalleryCardOptions = Readonly<{
  density?: GalleryCardDensity;
  emphasis?: GalleryCardEmphasis;
  body?: GalleryCardBody;
  /** Website-owned decorative SVG placed inside the shared heading row. */
  icon?: DemoNode;
}>;

/** Existing public Lucide shape factories; no hand-authored icon geometry. */
export const HOMEPAGE_GALLERY_ICONS = {
  controls: LUCIDE_MOUSE_POINTER_CLICK_SHAPE_FACTORY,
  hover: LUCIDE_LAYERS_SHAPE_FACTORY,
  'workspace-command': LUCIDE_SCAN_SEARCH_SHAPE_FACTORY,
  'workspace-help': LUCIDE_CIRCLE_QUESTION_MARK_SHAPE_FACTORY,
  preferences: LUCIDE_SETTINGS_2_SHAPE_FACTORY,
  'workspace-progress': LUCIDE_SLIDERS_HORIZONTAL_SHAPE_FACTORY,
  editor: LUCIDE_TEXT_CURSOR_INPUT_SHAPE_FACTORY,
  overlays: LUCIDE_SQUARE_CHECK_BIG_SHAPE_FACTORY,
  choices: LUCIDE_BELL_SHAPE_FACTORY,
  analytics: LUCIDE_CHART_NO_AXES_COLUMN_INCREASING_SHAPE_FACTORY,
} as const;
export type HomepageGalleryIcon = keyof typeof HOMEPAGE_GALLERY_ICONS;

export type GalleryIconFactory = (typeof HOMEPAGE_GALLERY_ICONS)[HomepageGalleryIcon];

/** Website-owned decorative artwork; the adjacent public Text owns the accessible name. */
export function homepageGalleryIcon(name: HomepageGalleryIcon): DemoNode {
  return box([iconSlot(name)]);
}

function box(children: DemoChild[]): DemoNode {
  return { kind: 'box', tag: 'span', className: 'home-gallery__icon', children };
}

function iconSlot(name: HomepageGalleryIcon): DemoNode {
  return {
    kind: 'box',
    tag: 'span',
    ref: `gallery-icon-${name}`,
    attrs: { 'aria-hidden': 'true', 'data-gallery-icon': name },
  };
}

export function appendHomepageGalleryGlyph(slot: HTMLElement, name: HomepageGalleryIcon): void {
  appendGallerySvg(slot, HOMEPAGE_GALLERY_ICONS[name], { width: '18', height: '18' });
}

export function appendGallerySvg(
  slot: HTMLElement,
  factory: GalleryIconFactory,
  size: { width: string; height: string }
): void {
  const svg = slot.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size.width);
  svg.setAttribute('height', size.height);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // Keep each factory node separate: a leading relative move starts at its own origin.
  const paths = factory({
    path: ({ d }: { d: string }) => d,
  } as never) as unknown as Array<{ d: string } | string>;
  for (const shape of paths) {
    const path = slot.ownerDocument.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', typeof shape === 'string' ? shape : shape.d);
    svg.append(path);
  }
  slot.append(svg);
}

/** Labelled sample series only; heights mirror the page-local plan progress. */
export function appendHomepageGallerySampleBars(slot: HTMLElement): void {
  const svg = slot.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 320 112');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '112');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('preserveAspectRatio', 'none');
  const factors = [0.32, 0.48, 0.56, 0.76, 0.68, 0.92];
  for (let index = 0; index < factors.length; index++) {
    const bar = slot.ownerDocument.createElementNS(svg.namespaceURI, 'rect');
    const height = Math.max(4, Math.round(40 * factors[index]!));
    bar.setAttribute('x', String(index * 52 + 14));
    bar.setAttribute('width', '28');
    bar.setAttribute('rx', '6');
    bar.setAttribute('y', String(104 - height));
    bar.setAttribute('height', String(height));
    bar.setAttribute('fill', 'currentColor');
    bar.setAttribute('data-gallery-bar', String(index));
    svg.append(bar);
  }
  slot.append(svg);
}
