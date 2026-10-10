import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  'type': 'demo',
  'root': {
    'kind': 'box',
    'className': 'flex min-w-0 flex-wrap gap-4 p-4',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'brutalist-popover-root',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'brutalist-popover-trigger',
            'children': ['Open Popover'],
          },
          {
            'kind': 'proto',
            'prototypeId': 'brutalist-popover-content',
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'brutalist-popover-title',
                'children': ['Popover settings'],
              },
              {
                'kind': 'proto',
                'prototypeId': 'brutalist-popover-description',
                'children': [
                  'Tab between the trigger and content, then move to the outside control. Outside focus closes without moving focus back.',
                ],
              },
              {
                'kind': 'proto',
                'prototypeId': 'brutalist-popover-close',
                'children': ['Close'],
              },
            ],
            'props': {
              'enterDuration': 0,
              'leaveDuration': 0,
            },
          },
        ],
        'props': {
          'a11yLabel': 'Popover',
        },
        'ref': 'root',
      },
      {
        'kind': 'proto',
        'prototypeId': 'brutalist-button',
        'children': ['Outside focus target'],
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
