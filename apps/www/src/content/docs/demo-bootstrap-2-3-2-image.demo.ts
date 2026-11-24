import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { IMAGE_ASSETS, imageNode } from './image-demo.shared';

const APPEARANCES = [
  {
    appearance: 'default',
    label: 'default',
    size: { width: '100%', height: '112px' },
  },
  {
    appearance: 'rounded',
    label: 'rounded (6px)',
    size: { width: '100%', height: '112px' },
  },
  {
    appearance: 'polaroid',
    label: 'polaroid',
    size: { width: '100%', height: '112px' },
  },
  {
    appearance: 'circle',
    label: 'circle (1:1)',
    size: { width: '112px', height: '112px' },
  },
] as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-2xl grid-cols-2 gap-4 p-4 sm:grid-cols-4',
    children: APPEARANCES.map((item) => ({
      kind: 'box',
      className: 'flex min-w-0 flex-col items-center gap-2',
      children: [
        imageNode(
          'bootstrap-2-3-2',
          `appearance-${item.appearance}`,
          {
            source: IMAGE_ASSETS.portrait,
            a11yMode: 'informative',
            alternativeText: `Portrait illustration with Bootstrap 2.3.2 ${item.appearance} appearance`,
            fit: 'cover',
            appearance: item.appearance,
          },
          item.size
        ),
        {
          kind: 'box',
          className: 'text-center font-mono text-xs text-muted-foreground',
          children: [item.label],
        },
      ],
    })),
  },
} satisfies DemoSpec;
