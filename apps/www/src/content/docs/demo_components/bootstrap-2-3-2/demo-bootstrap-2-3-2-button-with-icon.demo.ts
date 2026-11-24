import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-pencil-icon',
            className: 'inline-flex size-3.5 shrink-0 pointer-events-none mr-1.5',
            props: { size: 14 },
          },
          'Edit',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { variant: 'success' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-check-icon',
            className: 'inline-flex size-3.5 shrink-0 pointer-events-none mr-1.5',
            props: { size: 14 },
          },
          'Confirm',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { variant: 'danger' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-trash-icon',
            className: 'inline-flex size-3.5 shrink-0 pointer-events-none mr-1.5',
            props: { size: 14 },
          },
          'Delete',
        ],
      },
    ],
  },
} satisfies DemoSpec;
