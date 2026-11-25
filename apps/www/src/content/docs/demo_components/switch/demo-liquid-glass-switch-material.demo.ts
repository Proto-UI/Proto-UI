import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-md gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-field-root',
        className: 'flex flex-row items-center justify-between gap-4',
        children: [
          {
            kind: 'box',
            className: 'flex min-w-0 flex-1 flex-col gap-1',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-label',
                children: ['Auto material (default)'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-description',
                children: ['Requests Liquid Glass lensing when a backdrop source is available.'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-field-switch',
            props: { material: 'auto', defaultChecked: true },
            children: [{ kind: 'proto', prototypeId: 'liquid-glass-switch-thumb' }],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-field-root',
        className: 'flex flex-row items-center justify-between gap-4',
        children: [
          {
            kind: 'box',
            className: 'flex min-w-0 flex-1 flex-col gap-1',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-label',
                children: ['Opaque surface'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-field-description',
                children: ['Opts out of translucency for dense forms or glass containers.'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-field-switch',
            props: { material: 'opaque', defaultChecked: true },
            children: [{ kind: 'proto', prototypeId: 'liquid-glass-switch-thumb' }],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
