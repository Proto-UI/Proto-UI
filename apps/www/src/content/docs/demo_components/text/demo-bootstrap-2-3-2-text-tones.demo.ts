import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-xl grid-cols-1 gap-3 p-2 sm:grid-cols-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-surface-root',
        props: { variant: 'solid', elevation: 'raised', border: 'all' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-3 text-start',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'bold', tone: 'inherit' },
                children: ['Primary Gradient'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-text-root',
                rootTag: 'span',
                props: { size: 'xs', tone: 'inherit' },
                children: ['tone="inherit" preserves white ink & shadow.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-surface-root',
        props: { variant: 'accent', border: 'all' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-3 text-start',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'bold', tone: 'inherit' },
                children: ['Info Accent'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-text-root',
                rootTag: 'span',
                props: { size: 'xs', tone: 'inherit' },
                children: ['Follows classic #d9edf7 tint foreground.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-surface-root',
        props: { variant: 'outline', elevation: 'raised', border: 'all' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-3 text-start',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'bold', tone: 'default' },
                children: ['Default Well'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-text-root',
                rootTag: 'span',
                props: { size: 'xs', tone: 'muted' },
                children: ['Muted #666666 caption on white.'],
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
