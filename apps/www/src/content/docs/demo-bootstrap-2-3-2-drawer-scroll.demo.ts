import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const AUDIT_ENTRIES = [
  '09:00 UTC — Scheduled backup completed successfully.',
  '09:15 UTC — Static stylesheet cache refreshed across edge nodes.',
  '09:40 UTC — Release notes published to documentation portal.',
  '10:05 UTC — Automated accessibility audit passed with zero errors.',
  '10:30 UTC — Database read replica promoted in primary region.',
  '11:00 UTC — Weekly usage summary emailed to workspace owners.',
  '11:25 UTC — SSL certificate renewal verified for custom domains.',
  '11:50 UTC — Queue workers scaled back to baseline capacity.',
];

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-drawer-root',
        ref: 'root',
        props: {
          a11yLabel: 'System activity log',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-drawer-trigger',
            children: ['Scrollable Content'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-drawer-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-drawer-content',
            ref: 'panel',
            props: {
              side: 'bottom',
              maxExtent: { unit: 'logical', value: 380 },
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-drawer-handle',
                props: { a11yLabel: 'Resize drawer' },
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-drawer-header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-drawer-title',
                    children: ['System Activity Log'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-drawer-description',
                    children: ['Recent events scroll inside the drawer body.'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex-1 overflow-y-auto p-[15px] space-y-2',
                children: AUDIT_ENTRIES.map((entry) => ({
                  kind: 'box' as const,
                  className: 'border-b border-border pb-2 text-sm',
                  children: [entry],
                })),
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-drawer-footer',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-drawer-close',
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
} satisfies DemoSpec;
