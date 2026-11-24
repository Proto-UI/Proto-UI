import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-xl grid-cols-1 gap-4 p-2 sm:grid-cols-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-surface-root',
        props: { variant: 'solid', elevation: 'raised', border: 'all' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-4 text-start',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-text-root',
                rootTag: 'span',
                props: { size: 'base', font: 'heading', weight: 'bold', tone: 'inherit' },
                children: ['Main Surface (#5294ff)'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'medium', tone: 'inherit' },
                children: ['tone="inherit" keeps crisp black ink over accent fills.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-surface-root',
        props: { variant: 'secondary', elevation: 'raised', border: 'all' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-4 text-start',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-text-root',
                rootTag: 'span',
                props: { size: 'base', font: 'heading', weight: 'bold', tone: 'default' },
                children: ['Secondary Card Surface'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'medium', tone: 'muted' },
                children: ['Pairs default foreground headings with muted captions.'],
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
