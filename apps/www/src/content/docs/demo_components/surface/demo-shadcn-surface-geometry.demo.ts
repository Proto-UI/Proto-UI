import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-4 p-2',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        children: (['none', 'sm', 'md', 'lg', 'xl', 'full'] as const).map((radius) => ({
          kind: 'proto' as const,
          prototypeId: 'shadcn-surface-root',
          props: { variant: 'outline', radius },
          children: [
            {
              kind: 'box' as const,
              className: 'px-3 py-1.5 text-xs font-medium',
              children: [`radius="${radius}"`],
            },
          ],
        })),
      },
      {
        kind: 'box',
        className: 'grid grid-cols-1 gap-3 sm:grid-cols-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-surface-root',
            props: { variant: 'outline', radius: 'md', border: 'all' },
            children: [{ kind: 'box', className: 'p-3 text-xs', children: ['border="all"'] }],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-surface-root',
            props: { variant: 'transparent', radius: 'none', border: 'bottom' },
            children: [{ kind: 'box', className: 'p-3 text-xs', children: ['border="bottom"'] }],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-surface-root',
            props: { variant: 'muted', radius: 'md', border: 'none', elevation: 'raised' },
            children: [
              { kind: 'box', className: 'p-3 text-xs', children: ['border="none" · raised'] },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
