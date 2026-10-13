import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  'type': 'demo',
  'root': {
    'kind': 'box',
    'className': 'flex min-w-0 flex-wrap gap-4 p-4',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'shadcn-drawer-root',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-drawer-trigger',
            'children': ['Open Drawer'],
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-drawer-mask',
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-drawer-content',
            'ref': 'panel',
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-drawer-handle',
                'props': { 'a11yLabel': 'Resize drawer' },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-drawer-header',
                children: [
                  {
                    'kind': 'proto',
                    'prototypeId': 'shadcn-drawer-title',
                    'children': ['Drawer settings'],
                  },
                  {
                    'kind': 'proto',
                    'prototypeId': 'shadcn-drawer-description',
                    'children': [
                      'This panel fits its content. Drag the handle outward to dismiss, or choose Close.',
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-drawer-footer',
                children: [
                  {
                    'kind': 'proto',
                    'prototypeId': 'shadcn-drawer-close',
                    'children': ['Close'],
                  },
                ],
              },
            ],
            'props': {
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
