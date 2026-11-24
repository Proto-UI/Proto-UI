import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-wrap items-center gap-3 p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'solid', actionProfile: 'rhea' },
        children: [
          {
            kind: 'box',
            className: 'px-3 py-1.5',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'medium', tone: 'inherit', actionProfile: 'rhea' },
                children: ['Rhea · 1.25rem'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'secondary', actionProfile: 'luma' },
        children: [
          {
            kind: 'box',
            className: 'px-3 py-1.5',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'medium', tone: 'inherit', actionProfile: 'luma' },
                children: ['Luma · 1.25rem'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'outline', actionProfile: 'lyra' },
        children: [
          {
            kind: 'box',
            className: 'px-2.5 py-1.5',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'xs', weight: 'medium', tone: 'inherit', actionProfile: 'lyra' },
                children: ['Lyra · 1rem'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'secondary', actionProfile: 'mira' },
        children: [
          {
            kind: 'box',
            className: 'px-2.5 py-1',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'xs', weight: 'medium', tone: 'inherit', actionProfile: 'mira' },
                children: ['Mira · relaxed'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'solid', actionProfile: 'sera' },
        children: [
          {
            kind: 'box',
            className: 'px-3 py-1.5',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'xs', weight: 'semibold', tone: 'inherit', actionProfile: 'sera' },
                children: ['Sera · Uppercase'],
              },
            ],
          },
        ],
      },
    ],
  },
};

export default withShadcnRheaDemo(demo);
