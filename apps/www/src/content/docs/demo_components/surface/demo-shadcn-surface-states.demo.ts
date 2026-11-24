import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-3 p-2',
    children: [
      {
        kind: 'box',
        className: 'grid grid-cols-1 gap-3 sm:grid-cols-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-surface-root',
            props: { variant: 'outline', radius: 'md', hovered: true },
            children: [{ kind: 'box', className: 'p-3 text-sm', children: ['Hovered item'] }],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-surface-root',
            props: { variant: 'transparent', radius: 'md', border: 'none', current: true },
            children: [
              { kind: 'box', className: 'p-3 text-sm font-medium', children: ['Current nav item'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-surface-root',
            props: { variant: 'outline', radius: 'md', focusVisible: true },
            children: [
              { kind: 'box', className: 'p-3 text-sm', children: ['Keyboard focus ring'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-surface-root',
            props: { variant: 'solid', actionProfile: 'rhea', pressed: true },
            children: [
              {
                kind: 'box',
                className: 'p-3',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-text-root',
                    props: { tone: 'inherit', size: 'sm', weight: 'medium' },
                    children: ['Pressed Rhea action · inherited text'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'solid', radius: 'lg', border: 'none' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-4',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                props: { tone: 'inherit', size: 'sm', weight: 'semibold' },
                children: ['Contrast inherited by nested Text'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                props: { tone: 'inherit', size: 'xs' },
                children: [
                  'Pass tone="inherit" on Text so labels match solid or accent fills automatically.',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
