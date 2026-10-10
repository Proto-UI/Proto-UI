import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  'type': 'demo',
  'root': {
    'kind': 'box',
    'className': 'flex min-w-0 flex-wrap gap-4 p-4',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'brutalist-drawer-root',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'brutalist-drawer-trigger',
            'children': ['Open Drawer'],
          },
          {
            'kind': 'proto',
            'prototypeId': 'brutalist-drawer-mask',
          },
          {
            'kind': 'proto',
            'prototypeId': 'brutalist-drawer-content',
            'ref': 'panel',
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'brutalist-drawer-handle',
                'props': { 'a11yLabel': 'Resize drawer' },
              },
              {
                'kind': 'proto',
                'prototypeId': 'brutalist-drawer-title',
                'children': ['Drawer settings'],
              },
              {
                'kind': 'proto',
                'prototypeId': 'brutalist-drawer-description',
                'children': [
                  'Drag the handle to half size or expand it with Arrow Up. Drag further down to close. Changes remain in this demonstration.',
                ],
              },
              {
                'kind': 'proto',
                'prototypeId': 'brutalist-drawer-close',
                'children': ['Close'],
              },
            ],
            'props': {
              'enterDuration': 0,
              'leaveDuration': 0,
              'side': 'bottom',
              'snapPoints': [0.5, 1],
              'defaultSnapPoint': 1,
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
