import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
export default {
  'type': 'demo',
  'root': {
    'kind': 'box',
    'className': 'min-w-0 grid gap-4 p-4',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'bootstrap-2-3-2-toggle-group-root',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'bootstrap-2-3-2-toggle-group-item',
            'children': ['Bold'],
            'props': {
              'value': 'bold',
            },
          },
          {
            'kind': 'proto',
            'prototypeId': 'bootstrap-2-3-2-toggle-group-item',
            'children': ['Italic'],
            'props': {
              'value': 'italic',
            },
          },
          {
            'kind': 'proto',
            'prototypeId': 'bootstrap-2-3-2-toggle-group-item',
            'children': ['Unavailable'],
            'props': {
              'value': 'strike',
              'disabled': true,
            },
          },
        ],
        'props': {
          'multiple': true,
          'defaultValue': ['bold'],
          'a11yLabel': 'Text formatting',
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
    api.setProps('root', {
      onValueChange: (detail: { value: string[] }) => {
        refs.status.textContent = detail.value.join(', ') || 'No formatting';
      },
    });
  },
} satisfies DemoSpec;
