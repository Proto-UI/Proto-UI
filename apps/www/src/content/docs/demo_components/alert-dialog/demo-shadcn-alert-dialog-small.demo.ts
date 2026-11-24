import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-alert-dialog-root',
        props: {
          a11yLabel: 'Allow accessory connection',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-trigger',
            props: { variant: 'outline' },
            children: ['Show Dialog'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-content',
            props: { size: 'sm' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-alert-dialog-header',
                props: { align: 'center' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-title',
                    children: ['Allow accessory to connect?'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-description',
                    children: [
                      'Do you want to allow the USB accessory to connect to this device?',
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-alert-dialog-footer',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-cancel',
                    children: ["Don't allow"],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-action',
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
} satisfies DemoSpec);
