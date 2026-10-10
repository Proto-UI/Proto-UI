import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
export default {
  'type': 'demo',
  'root': {
    'kind': 'box',
    'className': 'min-w-0 grid gap-4 p-4',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'base-command-root',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'base-command-input',
            'props': {
              'placeholder': 'Search fruit…',
              'a11yLabel': 'Choose fruit',
            },
            'ref': 'input',
          },
          {
            'kind': 'proto',
            'prototypeId': 'base-command-content',
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'base-command-item',
                'children': ['Apple'],
                'props': {
                  'value': 'apple',
                  'textValue': 'Apple',
                },
              },
              {
                'kind': 'proto',
                'prototypeId': 'base-command-item',
                'children': ['Pear'],
                'props': {
                  'value': 'pear',
                  'textValue': 'Pear',
                },
              },
              {
                'kind': 'proto',
                'prototypeId': 'base-command-item',
                'children': ['Orange'],
                'props': {
                  'value': 'orange',
                  'textValue': 'Orange',
                },
              },
              {
                'kind': 'proto',
                'prototypeId': 'base-command-item',
                'children': ['Unavailable'],
                'props': {
                  'value': 'locked',
                  'textValue': 'Unavailable',
                  'disabled': true,
                },
              },
              {
                'kind': 'proto',
                'prototypeId': 'base-command-empty',
                'children': ['No matching results'],
              },
            ],
          },
        ],
        'props': {
          'a11yLabel': 'Choose fruit',
        },
        'ref': 'root',
      },
      {
        'kind': 'box',
        'ref': 'status',
        'attrs': {
          'aria-live': 'polite',
        },
        'children': ['Type, then use arrows and Enter or select a result.'],
      },
    ],
  },
  setup({ refs, api }) {
    api.setProps('root', {
      onExecute: (detail: { value: string; textValue: string }) => {
        refs.status.textContent = detail.textValue + ' (' + detail.value + ')';
      },
    });
  },
} satisfies DemoSpec;
