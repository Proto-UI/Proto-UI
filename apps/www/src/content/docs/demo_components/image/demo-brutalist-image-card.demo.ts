import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { IMAGE_ASSETS, imageNode } from '../../image-demo.shared';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-5 p-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-3',
        children: [
          imageNode(
            'brutalist',
            'caption-photo',
            {
              source: IMAGE_ASSETS.landscape,
              a11yMode: 'informative',
              alternativeText: 'Mountain ridge bathed in daylight',
              fit: 'cover',
            },
            { width: '100%', height: '180px' }
          ),
          {
            kind: 'box',
            className:
              'rounded-[5px] border-2 border-foreground bg-secondary-background px-3 py-2 text-sm font-medium text-foreground',
            children: ['Field Edition #04 — High-contrast framed photo surface'],
          },
        ],
      },
      {
        kind: 'box',
        className:
          'flex items-center gap-4 rounded-[5px] border-2 border-foreground bg-secondary-background p-3',
        children: [
          {
            kind: 'box',
            className: 'shrink-0',
            children: [
              imageNode(
                'brutalist',
                'decorative-accent',
                {
                  source: IMAGE_ASSETS.portrait,
                  a11yMode: 'decorative',
                  fit: 'cover',
                },
                { width: '56px', height: '56px' }
              ),
            ],
          },
          {
            kind: 'box',
            className: 'flex min-w-0 flex-col gap-0.5',
            children: [
              {
                kind: 'box',
                className: 'text-sm font-bold text-foreground',
                children: ['Decorative thumbnail'],
              },
              {
                kind: 'box',
                className: 'text-xs text-muted-foreground',
                children: [
                  'Set a11yMode="decorative" when the adjacent text already carries the meaning.',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
