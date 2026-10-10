import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
export default {
  'type': 'demo',
  'root': {
    'kind': 'box',
    'className': 'min-w-0 grid gap-4 p-4',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'bootstrap-2-3-2-toast-viewport',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'bootstrap-2-3-2-toast-root',
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'bootstrap-2-3-2-toast-title',
                'children': ['Document saved'],
              },
              {
                'kind': 'proto',
                'prototypeId': 'bootstrap-2-3-2-toast-description',
                'children': ['This live notification pauses while you hover or focus its action.'],
              },
              {
                'kind': 'proto',
                'prototypeId': 'bootstrap-2-3-2-toast-action',
                'children': ['Undo'],
                'props': {
                  'a11yLabel': 'Undo saving this demo',
                },
                'ref': 'action',
              },
              {
                'kind': 'proto',
                'prototypeId': 'bootstrap-2-3-2-toast-close',
                'children': ['Dismiss'],
              },
            ],
            'props': {
              'duration': 8000,
            },
            'ref': 'root',
          },
        ],
        'props': {
          'a11yLabel': 'Demo notifications, press F8',
        },
        'ref': 'viewport',
      },
      {
        'kind': 'proto',
        'prototypeId': 'bootstrap-2-3-2-button',
        'ref': 'reopen',
        'children': ['Show notification again'],
      },
      {
        'kind': 'box',
        'ref': 'status',
        'children': ['Ready'],
      },
    ],
  },
  setup({ refs, api }) {
    api.setProps('action', {
      onAction: () => {
        refs.status.textContent = 'Undo requested';
      },
    });
    api.setProps('reopen', {
      onClick: () => {
        const reopen = api.getExposes('root')?.openToast;
        if (typeof reopen === 'function') reopen();
      },
    });
  },
} satisfies DemoSpec;
