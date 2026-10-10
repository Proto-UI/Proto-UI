import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  'type': 'demo',
  'root': {
    'kind': 'box',
    'className': 'flex min-w-0 flex-wrap gap-4 p-4',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'bootstrap-2-3-2-drawer-root',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'bootstrap-2-3-2-drawer-trigger',
            'children': ['Open Drawer'],
          },
          {
            'kind': 'proto',
            'prototypeId': 'bootstrap-2-3-2-drawer-mask',
          },
          {
            'kind': 'proto',
            'prototypeId': 'bootstrap-2-3-2-drawer-content',
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'bootstrap-2-3-2-drawer-title',
                'children': ['Drawer settings'],
              },
              {
                'kind': 'proto',
                'prototypeId': 'bootstrap-2-3-2-drawer-description',
                'children': [
                  'Changes remain in this demonstration. Close and reopen to exercise focus restoration.',
                ],
              },
              {
                'kind': 'proto',
                'prototypeId': 'bootstrap-2-3-2-drawer-close',
                'children': ['Close'],
              },
            ],
            'props': {
              'enterDuration': 0,
              'leaveDuration': 0,
              'side': 'right',
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
    api.setProps('root', {
      onOpenChange: (detail: { open: boolean; reason: string }) => {
        refs.status.textContent = `${detail.open ? 'Opened' : 'Closed'}: ${detail.reason}`;
      },
    });
  },
} satisfies DemoSpec;
