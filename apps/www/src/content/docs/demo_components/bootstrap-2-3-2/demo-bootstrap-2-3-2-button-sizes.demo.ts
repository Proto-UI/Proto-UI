import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col items-start gap-3',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-button',
            props: { variant: 'primary', size: 'large' },
            children: ['Large primary'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-button',
            props: { size: 'large' },
            children: ['Large default'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-button',
            props: { variant: 'primary' },
            children: ['Default primary'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-button',
            children: ['Default'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-button',
            props: { variant: 'primary', size: 'small' },
            children: ['Small primary'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-button',
            props: { size: 'small' },
            children: ['Small default'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-button',
            props: { variant: 'primary', size: 'mini' },
            children: ['Mini primary'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-button',
            props: { size: 'mini' },
            children: ['Mini default'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
