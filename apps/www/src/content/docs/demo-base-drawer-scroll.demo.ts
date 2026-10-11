import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  'type': 'demo',
  'root': {
    'kind': 'box',
    'className': 'flex min-w-0 flex-wrap gap-4 p-4',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'base-drawer-root',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'base-drawer-trigger',
            'children': ['Open long Drawer'],
          },
          {
            'kind': 'proto',
            'prototypeId': 'base-drawer-mask',
          },
          {
            'kind': 'proto',
            'prototypeId': 'base-drawer-content',
            'ref': 'panel',
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'base-drawer-handle',
                'props': { 'a11yLabel': 'Resize drawer' },
              },
              {
                'kind': 'proto',
                'prototypeId': 'base-drawer-title',
                'children': ['Drawer settings'],
              },
              {
                'kind': 'proto',
                'prototypeId': 'base-drawer-description',
                'children': [
                  'This panel fits its content. Drag the handle outward to dismiss, or choose Close.',
                ],
              },
              {
                kind: 'box',
                children: Array.from({ length: 28 }, (_, index) => ({
                  kind: 'box' as const,
                  className: 'p-4',
                  children: [
                    `Section ${index + 1}: Scroll within the capped panel to reach the final Close control.`,
                  ],
                })),
              },
              {
                'kind': 'proto',
                'prototypeId': 'base-drawer-close',
                'children': ['Close'],
              },
            ],
            'props': {
              'enterDuration': 0,
              'leaveDuration': 0,
              'side': 'bottom',
            },
          },
        ],
        'props': {
          'a11yLabel': 'Drawer',
        },
        'ref': 'root',
      },
      {
        'kind': 'box',
        'ref': 'status',
        'attrs': {
          'aria-live': 'polite',
        },
        'children': ['Closed'],
      },
    ],
  },
  setup({ refs, api }) {
    api.setProps('panel', {
      onSnapPointChange: (detail: { snapPoint: number }) => {
        refs.status.textContent = `Drawer extent: ${Math.round(detail.snapPoint * 100)}%`;
      },
    });
    api.setProps('root', {
      onOpenChange: (detail: { open: boolean; reason: string }) => {
        refs.status.textContent = `${detail.open ? 'Opened' : 'Closed'}: ${detail.reason}`;
      },
    });
  },
} satisfies DemoSpec;
