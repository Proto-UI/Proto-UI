import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-xl grid-cols-1 gap-3 p-2 sm:grid-cols-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'outline', radius: 'md' },
        children: [
          { kind: 'box', className: 'p-3 text-sm', children: ['outline — Default card surface'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'secondary', radius: 'md' },
        children: [
          { kind: 'box', className: 'p-3 text-sm', children: ['secondary — Subtle control fill'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'muted', radius: 'md', border: 'none' },
        children: [
          { kind: 'box', className: 'p-3 text-sm', children: ['muted — Quiet inset container'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'accent', radius: 'md' },
        children: [
          { kind: 'box', className: 'p-3 text-sm', children: ['accent — Highlighted region'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'solid', radius: 'md', border: 'none' },
        children: [
          {
            kind: 'box',
            className: 'p-3 text-sm font-medium',
            children: ['solid — Primary emphasis'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'transparent', radius: 'md' },
        children: [
          { kind: 'box', className: 'p-3 text-sm', children: ['transparent — Open canvas shell'] },
        ],
      },
      {
        kind: 'box',
        className: 'relative overflow-hidden rounded-md border border-border p-4 sm:col-span-2',
        children: [
          {
            kind: 'box',
            className: 'text-xs opacity-70',
            children: ['Underlying page content dimmed by scrim'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-surface-root',
            className: 'mt-2 block',
            props: { variant: 'scrim', radius: 'sm', border: 'none' },
            children: [
              {
                kind: 'box',
                className: 'px-3 py-2 text-xs font-medium text-white',
                children: ['scrim — 80% black backdrop surface'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
