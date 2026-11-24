import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex min-w-0 flex-wrap items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-alert-dialog-root',
        props: {
          a11yLabel: 'Opaque fallback confirmation',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-alert-dialog-trigger',
            props: { variant: 'prominent', material: 'opaque' },
            children: ['Open Opaque Fallback'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-alert-dialog-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-alert-dialog-content',
            props: { material: 'opaque' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-1.5',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-title',
                    children: ['Publish release notes?'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-description',
                    children: [
                      'Opaque material mode keeps full contrast over dense backdrops or reduced-transparency environments.',
                    ],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex flex-wrap-reverse items-center justify-end gap-2.5 pt-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-cancel',
                    children: ['Cancel'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-action',
                    children: ['Publish'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
