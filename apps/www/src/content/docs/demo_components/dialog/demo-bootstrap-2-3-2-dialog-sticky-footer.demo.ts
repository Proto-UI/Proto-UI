import { bootstrap232ActionAppearance } from '@proto.ui/prototypes-bootstrap-2-3-2/surface';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const secondaryButton = bootstrap232ActionAppearance({ emphasis: 'secondary' });
const primaryButton = bootstrap232ActionAppearance({ emphasis: 'primary' });

const ITEMS = [
  '1. Verify database connection strings and read-replica fallback settings before applying changes.',
  '2. Confirm active session cookies remain valid across rolling deployments.',
  '3. Review webhook retry intervals and dead-letter queue thresholds.',
  '4. Ensure TLS certificate renewal hooks are active on every edge node.',
  '5. Archive the previous release manifest for one-click rollback.',
  '6. Notify the operations channel once health checks turn green.',
];

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
        props: { a11yLabel: 'Sticky footer' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-dialog-trigger',
            ref: 'trigger',
            children: ['Sticky Footer'],
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
                    children: ['Deployment checklist'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'max-h-[40vh] overflow-y-auto px-[15px] py-[15px] grid gap-3 text-sm leading-relaxed',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-dialog-description',
                    ref: 'description',
                    children: ['Review the checklist while the modal footer stays pinned below.'],
                  },
                  ...ITEMS.map((text) => ({ kind: 'box' as const, children: [text] })),
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
                            children: ['Cancel'],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-dialog-close',
                    ref: 'confirm',
                    surfaceStyle: { display: 'inline-flex' },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'bootstrap-2-3-2-surface-root',
                        ref: 'confirmAppearance',
                        props: { ...primaryButton.surface },
                        surfaceStyle: { ...primaryButton.layout, pointerEvents: 'none' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'bootstrap-2-3-2-text-root',
                            ref: 'confirmLabel',
                            props: { ...primaryButton.text },
                            children: ['Confirm'],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dialog-close-icon',
                ref: 'closeIcon',
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
