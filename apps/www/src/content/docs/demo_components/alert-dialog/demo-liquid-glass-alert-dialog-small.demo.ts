import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-alert-dialog-root',
        props: {
          a11yLabel: 'Allow accessory connection',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-alert-dialog-trigger',
            children: ['Show Compact Sheet'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-alert-dialog-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-alert-dialog-content',
            props: { size: 'sm' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-1.5 text-center',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-title',
                    children: ['Allow accessory to connect?'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-description',
                    children: ['Do you want to allow the USB accessory to connect to this device?'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex flex-wrap-reverse items-center justify-center gap-2.5 pt-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-cancel',
                    children: ["Don't allow"],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-action',
                    children: ['Allow'],
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
