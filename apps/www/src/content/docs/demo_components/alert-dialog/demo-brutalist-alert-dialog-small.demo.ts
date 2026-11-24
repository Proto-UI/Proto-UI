import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-alert-dialog-root',
        props: {
          a11yLabel: 'Allow accessory connection',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-alert-dialog-trigger',
            children: ['Show Dialog'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-alert-dialog-mask',
            ref: 'mask',
            previewTheme: 'portal',
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-alert-dialog-content',
            ref: 'content',
            previewTheme: 'portal',
            props: { size: 'sm' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-alert-dialog-header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-alert-dialog-title',
                    children: ['Allow accessory to connect?'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-alert-dialog-description',
                    children: [
                      'Do you want to allow the USB accessory to connect to this device?',
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-alert-dialog-footer',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-alert-dialog-cancel',
                    children: ["Don't allow"],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-alert-dialog-action',
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
