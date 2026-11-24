import { withShadcnRheaDemo } from '../shadcn-demo-style';
import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-lg flex-col gap-3 p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'outline', radius: 'lg' },
        children: [
          {
            kind: 'box',
            className: 'flex items-center justify-between gap-4 p-4',
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-0.5',
                children: [
                  {
                    kind: 'box',
                    className: 'text-sm font-medium',
                    children: ['Workspace Sync'],
                  },
                  {
                    kind: 'box',
                    className: 'text-xs opacity-75',
                    children: ['Automatically backs up changes across devices.'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-surface-root',
                props: { variant: 'secondary', radius: 'full', border: 'none' },
                children: [
                  {
                    kind: 'box',
                    className: 'px-2.5 py-0.5 text-xs font-medium',
                    children: ['Active'],
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
        props: { variant: 'muted', radius: 'md', border: 'none' },
        children: [
          {
            kind: 'box',
            className: 'px-4 py-3 text-sm',
            children: ['Draft saved locally. Publish when ready to share with your team.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-surface-root',
            props: { variant: 'solid', radius: 'md', focusVisible: true },
            children: [
              {
                kind: 'box',
                className: 'px-4 py-2 text-sm font-medium',
                children: ['Publish Release'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-surface-root',
            props: { variant: 'accent', radius: 'md', elevation: 'raised' },
            children: [
              {
                kind: 'box',
                className: 'px-4 py-2 text-sm font-medium',
                children: ['Elevated Callout'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
