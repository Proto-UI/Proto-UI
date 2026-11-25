import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function materialRow(
  ref: string,
  text: string,
  description: string,
  props: Record<string, unknown>
): DemoNode {
  const key = `lg-mat-${ref}`;
  return {
    kind: 'box',
    className: 'flex items-start gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-checkbox-root',
        ref,
        props,
        associations: { controlLabel: key },
        children: [
          { kind: 'proto', prototypeId: 'liquid-glass-checkbox-indicator', ref: `${ref}Ind` },
        ],
      },
      {
        kind: 'box',
        className: 'grid gap-0.5 leading-snug',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-label-root',
            ref: `${ref}Label`,
            props: { naming: true, activation: true },
            associations: { controlLabel: key },
            children: [text],
          },
          {
            kind: 'box',
            className: 'text-xs text-muted-foreground',
            children: [description],
          },
        ],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-md',
    children: [
      {
        kind: 'box',
        className: 'grid gap-4',
        children: [
          materialRow(
            'lgAuto',
            'Optical glass surface (auto)',
            'Requests backdrop refraction when supported and falls back automatically when reduced transparency or increased contrast is active.',
            { defaultChecked: true, material: 'auto' }
          ),
          materialRow(
            'lgOpaque',
            'Opaque surface (opaque)',
            'Opts out of optical translucency while keeping the same color contrast and checkmark hierarchy.',
            { defaultChecked: true, material: 'opaque' }
          ),
        ],
      },
    ],
  },
} satisfies DemoSpec;
