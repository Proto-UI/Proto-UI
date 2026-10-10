import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  'type': 'demo',
  'root': {
    'kind': 'box',
    'className': 'flex min-w-0 flex-wrap gap-4 p-4',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'bootstrap-2-3-2-alert-dialog-root',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'bootstrap-2-3-2-alert-dialog-trigger',
            'children': ['Open AlertDialog'],
          },
          {
            'kind': 'proto',
            'prototypeId': 'bootstrap-2-3-2-alert-dialog-mask',
          },
          {
            'kind': 'proto',
            'prototypeId': 'bootstrap-2-3-2-alert-dialog-content',
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'bootstrap-2-3-2-alert-dialog-title',
                'children': ['AlertDialog settings'],
              },
              {
                'kind': 'proto',
                'prototypeId': 'bootstrap-2-3-2-alert-dialog-description',
                'children': [
                  'Changes remain in this demonstration. Close and reopen to exercise focus restoration.',
                ],
              },
              {
                'kind': 'proto',
                'prototypeId': 'bootstrap-2-3-2-alert-dialog-cancel',
                'children': ['Cancel'],
              },
              {
                'kind': 'proto',
                'prototypeId': 'bootstrap-2-3-2-alert-dialog-action',
                'children': ['Confirm'],
                'ref': 'action',
              },
            ],
            'props': {
              'enterDuration': 0,
              'leaveDuration': 0,
            },
          },
        ],
        'props': {
          'a11yLabel': 'AlertDialog',
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
