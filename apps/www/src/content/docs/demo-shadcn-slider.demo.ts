import { withShadcnRheaDemo } from './shadcn-demo-style';
import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

type Proto = Extract<DemoNode, { kind: 'proto' }>;

const part = (part: string, ref: string, children: Proto['children'] = [], props = {}): Proto => ({
  kind: 'proto',
  prototypeId: `shadcn-slider-${part}`,
  ref,
  props,
  children,
});

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto grid w-full max-w-xs gap-6 p-4',
    children: [
      {
        kind: 'box',
        className: 'grid gap-3',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['Volume'] },
          part(
            'root',
            'volume-root',
            [
              part('track', 'volume-track', [
                part('indicator', 'volume-indicator'),
                part('thumb', 'volume-thumb'),
              ]),
            ],
            { defaultValue: 75, min: 0, max: 100, step: 1, ariaLabel: 'Volume' }
          ),
        ],
      },
      {
        kind: 'box',
        className: 'grid gap-3',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['Brightness (Field)'] },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-root',
            props: {},
            children: [
              part(
                'root',
                'field-root',
                [
                  part('track', 'field-track', [
                    part('indicator', 'field-indicator'),
                    part('field-thumb', 'field-thumb'),
                  ]),
                ],
                { defaultValue: 50, min: 0, max: 100, step: 5, ariaLabel: 'Brightness' }
              ),
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
