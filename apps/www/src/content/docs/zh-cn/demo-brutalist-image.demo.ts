import type { DemoNode, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const landscape = '/images/base-image/landscape.svg';
const portrait = '/images/base-image/portrait.svg';

// Dimensions stay consumer-owned on purpose: brutalist-image-root projects the
// framed surface (rounded-base, 2px border, 4px hard offset shadow) while each
// usage sets its own box size. Keep prototype closure exact to
// `['brutalist-image-root']` per PROJECTION_FAMILY_MANIFESTS.brutalist.image.
function framedImage(
  ref: string,
  props: Record<string, unknown>,
  surfaceStyle: Record<string, string>
): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'brutalist-image-root',
    ref,
    props,
    surfaceStyle: { width: '100%', ...surfaceStyle },
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-5 p-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          framedImage(
            'hero-frame',
            {
              source: landscape,
              a11yMode: 'informative',
              alternativeText: 'Sunlit mountain ridge illustration',
              fit: 'cover',
            },
            { height: '200px' }
          ),
          {
            kind: 'box',
            className: 'flex items-center justify-between text-xs text-muted-foreground',
            children: ['Mountain Ridge', 'fit="cover"'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'grid grid-cols-3 gap-4',
        children: [
          {
            kind: 'box',
            className: 'flex min-w-0 flex-col gap-2',
            children: [
              framedImage(
                'fit-contain',
                {
                  source: landscape,
                  a11yMode: 'informative',
                  alternativeText: 'Mountain ridge in contain mode',
                  fit: 'contain',
                },
                { height: '96px' }
              ),
              { kind: 'box', className: 'text-center font-mono text-xs', children: ['contain'] },
            ],
          },
          {
            kind: 'box',
            className: 'flex min-w-0 flex-col gap-2',
            children: [
              framedImage(
                'fit-cover',
                {
                  source: portrait,
                  a11yMode: 'informative',
                  alternativeText: 'Alpine study in cover mode',
                  fit: 'cover',
                },
                { height: '96px' }
              ),
              { kind: 'box', className: 'text-center font-mono text-xs', children: ['cover'] },
            ],
          },
          {
            kind: 'box',
            className: 'flex min-w-0 flex-col gap-2',
            children: [
              framedImage(
                'fit-fill',
                {
                  source: landscape,
                  a11yMode: 'informative',
                  alternativeText: 'Mountain ridge in fill mode',
                  fit: 'fill',
                },
                { height: '96px' }
              ),
              { kind: 'box', className: 'text-center font-mono text-xs', children: ['fill'] },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
