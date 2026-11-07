import type { DemoNode, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const landscape = '/images/base-image/landscape.svg';
const portrait = '/images/base-image/portrait.svg';
const unavailable = 'data:image/png;base64,invalid';

// Dimensions stay consumer-owned on purpose: the family projects the framed
// surface while each usage fixes its own box through surfaceStyle.
function image(
  ref: string,
  props: Record<string, unknown>,
  surfaceStyle: Record<string, string>
): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'brutalist-image-root',
    ref,
    props,
    surfaceStyle: { display: 'block', width: '100%', ...surfaceStyle },
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-4',
    children: [
      {
        kind: 'box',
        className: 'grid grid-cols-3 gap-3',
        children: (['contain', 'cover', 'fill'] as const).map((fit) => ({
          kind: 'box',
          className: 'flex min-w-0 flex-col gap-2',
          children: [
            image(
              `fit-${fit}`,
              {
                source: landscape,
                a11yMode: 'informative',
                alternativeText: `Mountains and a sun (${fit})`,
                fit,
              },
              { height: '112px' }
            ),
            { kind: 'box', className: 'text-center font-mono text-xs', children: [fit] },
          ],
        })),
      },
      {
        kind: 'box',
        className: 'flex items-center gap-3 text-sm',
        children: [
          {
            kind: 'box',
            className: 'w-16 shrink-0',
            children: [
              image(
                'decorative',
                { source: portrait, a11yMode: 'decorative', fit: 'contain' },
                { height: '64px' }
              ),
            ],
          },
          'Decorative image · the text carries the meaning.',
        ],
      },
      image(
        'error',
        {
          source: unavailable,
          a11yMode: 'informative',
          alternativeText: 'Broken source stays framed while loadingStatus reports error',
          fit: 'contain',
        },
        { height: '96px' }
      ),
    ],
  },
} satisfies DemoSpec;
