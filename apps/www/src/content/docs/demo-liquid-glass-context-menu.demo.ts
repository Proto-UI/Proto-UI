import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
export default {
  'type': 'demo',
  'root': {
    'kind': 'box',
    'className': 'min-w-0 grid gap-4 p-4',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'liquid-glass-context-menu-root',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'liquid-glass-context-menu-trigger',
            'children': ['Right-click here, or focus and press Shift+F10.'],
          },
          {
            'kind': 'proto',
            'prototypeId': 'liquid-glass-context-menu-content',
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'liquid-glass-context-menu-item',
                'children': ['Copy'],
                'props': {
                  'value': 'copy',
                  'textValue': 'Copy',
                },
                'ref': 'copy',
              },
              {
                'kind': 'proto',
                'prototypeId': 'liquid-glass-context-menu-item',
                'children': ['Paste'],
                'props': {
                  'value': 'paste',
                  'textValue': 'Paste',
                },
                'ref': 'paste',
              },
              {
                'kind': 'proto',
                'prototypeId': 'liquid-glass-context-menu-item',
                'children': ['Unavailable'],
                'props': {
                  'value': 'disabled',
                  'disabled': true,
                },
              },
            ],
          },
        ],
        'ref': 'root',
      },
      {
        'kind': 'box',
        'ref': 'status',
        'attrs': {
          'aria-live': 'polite',
        },
        'children': ['Select a command.'],
      },
    ],
  },
  setup({ refs, api }) {
    for (const ref of ['copy', 'paste'])
      api.setProps(ref, {
        onSelect: (detail: { value: string }) => {
          refs.status.textContent = detail.value + ' selected';
        },
      });
  },
} satisfies DemoSpec;
