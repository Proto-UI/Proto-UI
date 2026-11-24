import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { IMAGE_ASSETS, imageNode } from '../../image-demo.shared';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const ITEMS = [
  { radius: 'none', label: 'none', size: { width: '100%', height: '104px' } },
  { radius: 'md', label: 'md', size: { width: '100%', height: '104px' } },
  { radius: 'default', label: 'default (rhea)', size: { width: '100%', height: '104px' } },
  { radius: 'full', label: 'full', size: { width: '104px', height: '104px' } },
] as const;

const radiusDemo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-2xl grid-cols-2 gap-4 p-4 sm:grid-cols-4',
    children: ITEMS.map((item) => ({
      kind: 'box',
      className: 'flex min-w-0 flex-col items-center gap-2',
      children: [
        imageNode(
          'shadcn',
          `radius-${item.radius}`,
          {
            source: IMAGE_ASSETS.portrait,
            a11yMode: 'informative',
            alternativeText: `Portrait illustration with ${item.label} corners`,
            fit: 'cover',
            radius: item.radius,
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
};

export default withShadcnRheaDemo(radiusDemo);
