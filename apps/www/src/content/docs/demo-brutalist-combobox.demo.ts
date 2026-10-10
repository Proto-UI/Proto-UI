import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
export default {
  'type': 'demo',
  'root': {
    'kind': 'box',
    'className': 'min-w-0 grid gap-4 p-4',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'brutalist-combobox-root',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'brutalist-combobox-input',
            'props': {
              'placeholder': 'Search fruit…',
              'a11yLabel': 'Choose fruit',
            },
            'ref': 'input',
          },
          {
            'kind': 'proto',
            'prototypeId': 'brutalist-combobox-trigger',
            'children': ['Show options'],
          },
          {
            'kind': 'proto',
            'prototypeId': 'brutalist-combobox-content',
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'brutalist-combobox-item',
                'children': ['Apple'],
                'props': {
                  'value': 'apple',
                  'textValue': 'Apple',
                },
              },
              {
                'kind': 'proto',
                'prototypeId': 'brutalist-combobox-item',
                'children': ['Pear'],
                'props': {
                  'value': 'pear',
                  'textValue': 'Pear',
                },
              },
              {
                'kind': 'proto',
                'prototypeId': 'brutalist-combobox-item',
                'children': ['Orange'],
                'props': {
                  'value': 'orange',
                  'textValue': 'Orange',
                },
              },
              {
                'kind': 'proto',
                'prototypeId': 'brutalist-combobox-item',
                'children': ['Unavailable'],
                'props': {
                  'value': 'locked',
                  'textValue': 'Unavailable',
                  'disabled': true,
                },
              },
              {
                'kind': 'proto',
                'prototypeId': 'brutalist-combobox-empty',
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
      onValueChange: (detail: { value: string; textValue: string }) => {
        refs.status.textContent = detail.textValue + ' (' + detail.value + ')';
      },
    });
  },
} satisfies DemoSpec;
