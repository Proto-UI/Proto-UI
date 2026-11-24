import { bootstrap232ActionAppearance } from '@proto.ui/prototypes-bootstrap-2-3-2/surface';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const secondaryButton = bootstrap232ActionAppearance({ emphasis: 'secondary' });

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 items-start p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-dialog-root',
        ref: 'root',
        props: { a11yLabel: 'No close button' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-dialog-trigger',
            ref: 'trigger',
            children: ['No Close Button'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-dialog-mask',
            ref: 'mask',
            previewTheme: 'portal',
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-dialog-content',
            ref: 'content',
            previewTheme: 'portal',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dialog-header',
                ref: 'header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-dialog-title',
                    ref: 'title',
                    children: ['No Close Button'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'px-[15px] py-[15px]',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-dialog-description',
                    ref: 'description',
                    children: [
                      'This modal omits the top-right close icon and delegates dismissal to Escape, backdrop click, or the footer button.',
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dialog-footer',
                ref: 'footer',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-dialog-close',
                    ref: 'close',
                    surfaceStyle: { display: 'inline-flex' },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'bootstrap-2-3-2-surface-root',
                        ref: 'closeAppearance',
                        props: { ...secondaryButton.surface },
                        surfaceStyle: { ...secondaryButton.layout, pointerEvents: 'none' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'bootstrap-2-3-2-text-root',
                            ref: 'closeLabel',
                            props: { ...secondaryButton.text },
                            children: ['Close'],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
