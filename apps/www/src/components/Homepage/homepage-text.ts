import type { TextRootProps } from '@proto.ui/prototypes-base/text';
import type { DemoNode } from '../PrototypePreviewer/demo-types';
import type { ProjectionFamilyId } from '../PrototypePreviewer/projection-families';

const roles: Record<string, Partial<TextRootProps>> = {
  'home-settings__title': {
    size: '2xl',
    weight: 'semibold',
    font: 'heading',
    leading: 'snug',
    tracking: 'tight',
  },
  'home-settings__label': { size: 'sm', weight: 'medium' },
  'home-settings__muted': { size: 'xs', tone: 'muted' },
  'home-settings__feedback': { size: 'sm' },
  'home-gallery__title': { size: 'base', weight: 'semibold', font: 'heading' },
  'home-gallery__caption': { size: 'xs', tone: 'muted' },
  'home-gallery__copy': { size: 'sm' },
  'home-gallery__status': { size: 'sm' },
  'home-gallery__choice-label': { size: 'sm' },
  'home-gallery__text-preview': { size: 'base', leading: 'relaxed' },
};
export function homepageTextProps(
  className: string,
  family: ProjectionFamilyId
): TextRootProps | undefined {
  const role = roles[className];
  if (!role) return;
  return {
    size: 'base',
    tone: 'default',
    weight: family === 'brutalist' ? 'medium' : 'normal',
    font: 'body',
    leading: 'normal',
    tracking: 'normal',
    emphasis: 'normal',
    decoration: 'none',
    ...role,
    ...(role.font === 'heading'
      ? {
          font: family === 'brutalist' ? 'heading' : 'body',
          weight: family === 'brutalist' ? 'bold' : 'semibold',
        }
      : {}),
  };
}
/** Preserve authored semantic boxes and content; insert the selected public Text atom. */
export function composeHomepageText(node: DemoNode, family: ProjectionFamilyId): DemoNode {
  if (node.kind === 'text') return node;
  const props =
    node.kind === 'box' && node.className ? homepageTextProps(node.className, family) : undefined;
  if (props && node.kind === 'box')
    return {
      ...node,
      attrs: { ...node.attrs, 'data-home-text': '' },
      children: [
        {
          kind: 'proto',
          prototypeId: `${family}-text-root`,
          rootTag: 'span',
          // These owners are standalone block text. Declare their formatting
          // context through the normalized surface channel: WC's default block
          // host and a framework's inline span otherwise produce different
          // parent line boxes even with identical family typography and gaps.
          surfaceStyle: { display: 'block' },
          ...(node.ref ? { ref: `${node.ref}-text` } : {}),
          props: { ...props },
          children: [
            {
              kind: 'box',
              tag: 'span',
              attrs: { 'data-home-text-slot': '' },
              children: node.children,
            },
          ],
        },
      ],
    };
  return {
    ...node,
    children: node.children?.map((child) =>
      typeof child === 'string' ? child : composeHomepageText(child, family)
    ),
  };
}
export function setHomepageText(node: HTMLElement, value: string): void {
  const slot = node.querySelector<HTMLElement>('[data-home-text-slot]');
  if (!slot) throw new Error('Homepage text requires its public Text content slot');
  // Update source content, never remove the renderer-owned Prototype.
  slot.textContent = value;
}
