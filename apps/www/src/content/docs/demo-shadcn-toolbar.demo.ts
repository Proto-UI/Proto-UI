import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
export default {
  'type': 'demo',
  'root': {
    'kind': 'box',
    'className': 'min-w-0 grid gap-4 p-4',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'shadcn-toolbar-root',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-toolbar-button',
            'children': ['Undo'],
            'props': {
              'value': 'undo',
            },
            'ref': 'undo',
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-toolbar-separator',
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-toolbar-button',
            'children': ['Redo'],
            'props': {
              'value': 'redo',
            },
            'ref': 'redo',
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-toolbar-button',
            'children': ['Unavailable'],
            'props': {
              'disabled': true,
            },
          },
        ],
        'props': {
          'a11yLabel': 'Editing commands',
        },
        'ref': 'root',
      },
      {
        'kind': 'box',
        'ref': 'status',
        'attrs': {
          'aria-live': 'polite',
        },
        'children': ['Ready'],
      },
    ],
  },
  setup({ refs, api }) {
    for (const ref of ['undo', 'redo'])
      api.setProps(ref, {
        onAction: (detail: { value: string }) => {
          refs.status.textContent = detail.value + ' requested';
        },
      });
  },
} satisfies DemoSpec;
