import { LUCIDE_ACTIVITY_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/activity';
import { LUCIDE_ARROW_RIGHT_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/arrow-right';
import { LUCIDE_BELL_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/bell';
import { LUCIDE_BLOCKS_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/blocks';
import { LUCIDE_BOOK_OPEN_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/book-open';
import { LUCIDE_BOX_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/box';
import { LUCIDE_CHART_NO_AXES_COLUMN_INCREASING_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/chart-no-axes-column-increasing';
import { LUCIDE_CIRCLE_QUESTION_MARK_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/circle-question-mark';
import { LUCIDE_CODE_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/code';
import { LUCIDE_COMPASS_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/compass';
import { LUCIDE_CPU_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/cpu';
import { LUCIDE_GLOBE_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/globe';
import { LUCIDE_LAYERS_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/layers';
import { LUCIDE_LAYOUT_GRID_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/layout-grid';
import { LUCIDE_MOUSE_POINTER_CLICK_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/mouse-pointer-click';
import { LUCIDE_PALETTE_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/palette';
import { LUCIDE_PLUS_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/plus';
import { LUCIDE_SCAN_SEARCH_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/scan-search';
import { LUCIDE_SETTINGS_2_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/settings-2';
import { LUCIDE_SHIELD_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/shield';
import { LUCIDE_SLIDERS_HORIZONTAL_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/sliders-horizontal';
import { LUCIDE_SPARKLES_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/sparkles';
import { LUCIDE_SQUARE_CHECK_BIG_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/square-check-big';
import { LUCIDE_TERMINAL_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/terminal';
import { LUCIDE_TEXT_CURSOR_INPUT_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/text-cursor-input';
import { LUCIDE_WORKFLOW_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/workflow';
import { LUCIDE_WRENCH_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/wrench';
import type { DemoChild, DemoNode } from '../PrototypePreviewer/demo-types';

export type GalleryCardDensity = 'regular' | 'compact';
export type GalleryCardEmphasis = 'quiet' | 'standard' | 'accent';
export type GalleryCardBody = 'inset' | 'edge-media';

export type GalleryCardOptions = Readonly<{
  density?: GalleryCardDensity;
  emphasis?: GalleryCardEmphasis;
  body?: GalleryCardBody;
  /** Optional header action aligned to the trailing edge of the heading row. */
  headerAction?: DemoNode;
  /** Omit card header when the card opens directly with compact controls or centered media. */
  headless?: boolean;
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
  'release-plus': LUCIDE_PLUS_SHAPE_FACTORY,
  'arrow-right': LUCIDE_ARROW_RIGHT_SHAPE_FACTORY,
  'nav-blocks': LUCIDE_BLOCKS_SHAPE_FACTORY,
  'nav-layers': LUCIDE_LAYERS_SHAPE_FACTORY,
  'nav-grid': LUCIDE_LAYOUT_GRID_SHAPE_FACTORY,
  'nav-box': LUCIDE_BOX_SHAPE_FACTORY,
  'nav-workflow': LUCIDE_WORKFLOW_SHAPE_FACTORY,
  'nav-compass': LUCIDE_COMPASS_SHAPE_FACTORY,
  'nav-shield': LUCIDE_SHIELD_SHAPE_FACTORY,
  'nav-activity': LUCIDE_ACTIVITY_SHAPE_FACTORY,
  'nav-globe': LUCIDE_GLOBE_SHAPE_FACTORY,
  'nav-code': LUCIDE_CODE_SHAPE_FACTORY,
  'nav-cpu': LUCIDE_CPU_SHAPE_FACTORY,
  'nav-terminal': LUCIDE_TERMINAL_SHAPE_FACTORY,
  'nav-palette': LUCIDE_PALETTE_SHAPE_FACTORY,
  'nav-sparkles': LUCIDE_SPARKLES_SHAPE_FACTORY,
  'nav-wrench': LUCIDE_WRENCH_SHAPE_FACTORY,
  'nav-book': LUCIDE_BOOK_OPEN_SHAPE_FACTORY,
} as const;
export type HomepageGalleryIcon = keyof typeof HOMEPAGE_GALLERY_ICONS;

export type GalleryIconFactory = (typeof HOMEPAGE_GALLERY_ICONS)[HomepageGalleryIcon];

/** Website-owned decorative artwork; the adjacent public Text owns the accessible name. */
export function homepageGalleryIcon(
  name: HomepageGalleryIcon,
  ref = `gallery-icon-${name}`
): DemoNode {
  return box([iconSlot(name, ref)]);
}

function box(children: DemoChild[]): DemoNode {
  return { kind: 'box', tag: 'span', className: 'home-gallery__icon', children };
}

function iconSlot(name: HomepageGalleryIcon, ref: string): DemoNode {
  return {
    kind: 'box',
    tag: 'span',
    ref,
    attrs: { 'aria-hidden': 'true', 'data-gallery-icon': name },
  };
}

export function appendHomepageGalleryGlyph(
  slot: HTMLElement,
  name: HomepageGalleryIcon,
  size = 16
): void {
  const px = String(size);
  appendGallerySvg(slot, HOMEPAGE_GALLERY_ICONS[name], { width: px, height: px });
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
  type ShapeEntry = { tag: string; attrs: Record<string, string | number> };
  const collect =
    (tag: string) =>
    (attrs: Record<string, string | number>): ShapeEntry => ({ tag, attrs });
  const raw = factory({
    path: collect('path'),
    circle: collect('circle'),
    rect: collect('rect'),
    line: collect('line'),
    polyline: collect('polyline'),
    polygon: collect('polygon'),
    ellipse: collect('ellipse'),
  } as never) as unknown as ShapeEntry | ShapeEntry[];
  const shapes = Array.isArray(raw) ? raw : [raw];
  for (const shape of shapes) {
    const el = slot.ownerDocument.createElementNS(svg.namespaceURI, shape.tag);
    for (const [k, v] of Object.entries(shape.attrs)) el.setAttribute(k, String(v));
    svg.append(el);
  }
  slot.append(svg);
}

export const HOMEPAGE_BAR_FACTORS = [0.56, 0.94, 0.66, 0.88, 0.62, 0.78] as const;
const HOMEPAGE_BAR_OPACITIES = [0.28, 0.9, 0.62, 0.92, 0.76, 0.44] as const;

export function homepageBarHeight(value: number, index: number): number {
  const factor = HOMEPAGE_BAR_FACTORS[index % HOMEPAGE_BAR_FACTORS.length]!;
  const scale = 0.56 + (Math.max(0, Math.min(100, value)) / 100) * 0.44;
  return Math.max(16, Math.round(154 * factor * scale));
}

/** Labelled sample series only; heights mirror the page-local plan progress. */
export function appendHomepageGallerySampleBars(slot: HTMLElement): void {
  const svg = slot.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 320 176');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '176');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  for (const y of [28, 96, 166]) {
    const line = slot.ownerDocument.createElementNS(svg.namespaceURI, 'line');
    for (const [name, value] of Object.entries({
      x1: '4',
      x2: '316',
      y1: String(y),
      y2: String(y),
      stroke: 'currentColor',
      'stroke-opacity': '0.08',
    }))
      line.setAttribute(name, value);
    svg.append(line);
  }
  for (let index = 0; index < HOMEPAGE_BAR_FACTORS.length; index++) {
    const bar = slot.ownerDocument.createElementNS(svg.namespaceURI, 'rect');
    const height = homepageBarHeight(40, index);
    bar.setAttribute('x', String(index * 52 + 11));
    bar.setAttribute('width', '38');
    bar.setAttribute('rx', '10');
    bar.setAttribute('y', String(166 - height));
    bar.setAttribute('height', String(height));
    bar.setAttribute('fill', 'currentColor');
    bar.setAttribute('fill-opacity', String(HOMEPAGE_BAR_OPACITIES[index]!));
    bar.setAttribute('data-gallery-bar', String(index));
    svg.append(bar);
  }
  slot.append(svg);
}

/** High-contrast decorative 21x21 geometric protocol matrix (QR silhouette). */
const QR_MATRIX_ROWS = [
  '111111101011001111111',
  '100000100100101000001',
  '101110101110101011101',
  '101110100011001011101',
  '101110101001101011101',
  '100000100110001000001',
  '111111101010101111111',
  '000000001101000000000',
  '101101110010110110101',
  '010010001101001001010',
  '110111101011101101110',
  '001000010100010010001',
  '101110111010111011011',
  '000000001001100100100',
  '111111100110101011010',
  '100000101001010100101',
  '101110101110111010111',
  '101110100101000111001',
  '101110101011011001010',
  '100000100100100110110',
  '111111101101110101011',
] as const;

export function appendHomepageGalleryQrMatrix(slot: HTMLElement): void {
  const svg = slot.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 210 210');
  svg.setAttribute('width', '156');
  svg.setAttribute('height', '156');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (let row = 0; row < QR_MATRIX_ROWS.length; row++) {
    const line = QR_MATRIX_ROWS[row]!;
    for (let col = 0; col < line.length; col++) {
      if (line[col] !== '1') continue;
      const cell = slot.ownerDocument.createElementNS(svg.namespaceURI, 'rect');
      cell.setAttribute('x', String(col * 10));
      cell.setAttribute('y', String(row * 10));
      cell.setAttribute('width', '10');
      cell.setAttribute('height', '10');
      cell.setAttribute('rx', '1.5');
      cell.setAttribute('fill', 'currentColor');
      svg.append(cell);
    }
  }
  slot.append(svg);
}

const SPARK_SERIES = [
  [54, 48, 52, 40, 44, 30, 34, 24, 28, 16, 20, 12],
  [60, 56, 46, 50, 38, 42, 26, 30, 20, 22, 14, 18],
  [48, 52, 44, 36, 42, 34, 28, 32, 22, 18, 24, 10],
  [58, 46, 50, 42, 34, 38, 28, 22, 26, 18, 14, 12],
] as const;

/** Edge-to-edge monochrome area sparkline synced with the sample view toggle. */
export function renderHomepageGalleryAreaChart(slot: HTMLElement, seriesIndex = 0): void {
  slot.replaceChildren();
  const points = SPARK_SERIES[seriesIndex % SPARK_SERIES.length]!;
  const step = 320 / (points.length - 1);
  const coords = points.map((y, index) => `${Math.round(index * step)},${y}`);
  const linePoints = coords.join(' ');
  const areaPoints = `0,84 ${linePoints} 320,84`;

  const svg = slot.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 320 84');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '84');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('preserveAspectRatio', 'none');

  const polygon = slot.ownerDocument.createElementNS(svg.namespaceURI, 'polygon');
  polygon.setAttribute('points', areaPoints);
  polygon.setAttribute('fill', 'currentColor');
  polygon.setAttribute('fill-opacity', '0.09');
  svg.append(polygon);

  const polyline = slot.ownerDocument.createElementNS(svg.namespaceURI, 'polyline');
  polyline.setAttribute('points', linePoints);
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', 'currentColor');
  polyline.setAttribute('stroke-opacity', '0.45');
  polyline.setAttribute('stroke-width', '2');
  polyline.setAttribute('stroke-linejoin', 'round');
  polyline.setAttribute('stroke-linecap', 'round');
  svg.append(polyline);

  slot.append(svg);
}

const MINI_BAR_SERIES = [
  [0.42, 0.72, 0.56, 0.96],
  [0.52, 0.86, 0.64, 0.92],
  [0.38, 0.66, 0.88, 0.74],
  [0.34, 0.58, 0.78, 0.68],
] as const;

/** Compact four-bar monochrome indicator for bottom parity rows. */
export function appendHomepageGalleryMiniBars(slot: HTMLElement, seriesIndex = 0): void {
  const heights = MINI_BAR_SERIES[seriesIndex % MINI_BAR_SERIES.length]!;
  const svg = slot.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 26');
  svg.setAttribute('width', '64');
  svg.setAttribute('height', '26');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (let index = 0; index < heights.length; index++) {
    const bar = slot.ownerDocument.createElementNS(svg.namespaceURI, 'rect');
    const h = Math.max(6, Math.round(heights[index]! * 24));
    bar.setAttribute('x', String(index * 16 + 2));
    bar.setAttribute('y', String(26 - h));
    bar.setAttribute('width', '12');
    bar.setAttribute('height', String(h));
    bar.setAttribute('rx', '3');
    bar.setAttribute('fill', 'currentColor');
    bar.setAttribute('fill-opacity', String(0.35 + index * 0.16));
    svg.append(bar);
  }
  slot.append(svg);
}

const ACTIVITY_BAR_FACTORS = [0.48, 0.76, 0.88, 0.64, 0.94, 0.82, 0.9, 0.86] as const;
const ACTIVITY_BAR_OPACITIES = [0.46, 0.64, 0.74, 0.56, 0.82, 0.72, 0.78, 0.74] as const;

/** Eight-bar rounded monochrome histogram for the bottom-right matrix card. */
export function appendHomepageGalleryActivityBars(slot: HTMLElement): void {
  const svg = slot.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 320 164');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '164');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  for (let index = 0; index < ACTIVITY_BAR_FACTORS.length; index++) {
    const bar = slot.ownerDocument.createElementNS(svg.namespaceURI, 'rect');
    const h = Math.max(28, Math.round(ACTIVITY_BAR_FACTORS[index]! * 150));
    bar.setAttribute('x', String(index * 39 + 6));
    bar.setAttribute('y', String(160 - h));
    bar.setAttribute('width', '30');
    bar.setAttribute('height', String(h));
    bar.setAttribute('rx', '6');
    bar.setAttribute('fill', 'currentColor');
    bar.setAttribute('fill-opacity', String(ACTIVITY_BAR_OPACITIES[index]!));
    svg.append(bar);
  }
  slot.append(svg);
}
