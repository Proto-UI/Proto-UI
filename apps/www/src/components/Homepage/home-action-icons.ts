import { LUCIDE_ARROW_RIGHT_SHAPE_FACTORY } from '@proto.ui/prototypes-lucide/icons/arrow-right';

/** Website-owned decorative CTA artwork. Social icon-only links stay separate. */
export const HOME_ACTION_ICONS = {
  'arrow-right': {
    viewBox: '0 0 24 24',
    paths: LUCIDE_ARROW_RIGHT_SHAPE_FACTORY({
      path: ({ d }: { d: string }) => d,
    } as never) as unknown as string[],
    fill: 'none',
    stroke: 'currentColor',
  },
  external: {
    fill: 'currentColor',
    stroke: 'none',
    viewBox: '0 0 24 24',
    paths: [
      'M14 3h7v7h-2V6.414l-9.293 9.293-1.414-1.414L17.586 5H14V3ZM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
    ],
  },
} as const;
export type HomeActionIcon = keyof typeof HOME_ACTION_ICONS;
export function homeActionIcon(value: unknown): HomeActionIcon | undefined {
  if (value === 'external' || value === 'arrow-right') return value;
  // Starlight's content schema normalizes named frontmatter icons before SSR.
  // Raw HTML icons and other names are deliberately outside this bounded mapping.
  if (value && typeof value === 'object' && 'type' in value && 'name' in value)
    return value.type === 'icon' && (value.name === 'external' || value.name === 'arrow-right')
      ? value.name
      : undefined;
  return undefined;
}
export function appendHomeActionGlyph(slot: HTMLElement, icon: HomeActionIcon): void {
  const source = HOME_ACTION_ICONS[icon];
  const svg = slot.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', source.viewBox);
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.style.marginInlineStart = '0.5rem';
  // Keep each factory node separate: a leading relative move starts at its own origin.
  for (const d of source.paths) {
    const path = slot.ownerDocument.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('fill', source.fill);
    path.setAttribute('stroke', source.stroke);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('d', d);
    svg.append(path);
  }
  slot.append(svg);
}
