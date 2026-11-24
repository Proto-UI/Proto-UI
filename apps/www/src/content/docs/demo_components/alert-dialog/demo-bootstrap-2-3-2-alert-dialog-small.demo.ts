import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-alert-dialog-root',
        props: {
          a11yLabel: 'Allow accessory connection',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-alert-dialog-trigger',
            children: ['Show Compact Dialog'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-alert-dialog-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-alert-dialog-content',
            props: { size: 'sm' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-alert-dialog-title',
                children: ['Allow accessory to connect?'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-alert-dialog-description',
                children: [
                  'Do you want to allow the USB accessory to connect to this device?',
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-alert-dialog-footer',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-alert-dialog-cancel',
                    children: ["Don't allow"],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-alert-dialog-action',
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
