import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
export default {
  'type': 'demo',
  'root': {
    'kind': 'box',
    'className': 'min-w-0 grid gap-4 p-4',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'base-navigation-menu-root',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'base-navigation-menu-trigger',
            'children': ['File'],
            'props': {
              'value': 'file',
            },
          },
          {
            'kind': 'proto',
            'prototypeId': 'base-navigation-menu-content',
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'base-navigation-menu-item',
                'children': ['New document'],
                'props': {
                  'value': 'new',
                  'textValue': 'New document',
                },
                'ref': 'new',
              },
              {
                'kind': 'proto',
                'prototypeId': 'base-navigation-menu-item',
                'children': ['Open document'],
                'props': {
                  'value': 'open',
                  'textValue': 'Open document',
                },
                'ref': 'open',
              },
              {
                'kind': 'proto',
                'prototypeId': 'base-navigation-menu-link',
                'children': ['Jump to demo destination'],
                'props': {
                  'href': '#base-navigation-demo-destination',
                  'current': true,
                },
                'ref': 'docs',
              },
            ],
            'props': {
              'value': 'file',
              'a11yLabel': 'File commands',
            },
          },
          {
            'kind': 'proto',
            'prototypeId': 'base-navigation-menu-trigger',
            'children': ['Edit'],
            'props': {
              'value': 'edit',
            },
          },
          {
            'kind': 'proto',
            'prototypeId': 'base-navigation-menu-content',
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'base-navigation-menu-item',
                'children': ['Undo'],
                'props': {
                  'value': 'undo',
                  'textValue': 'Undo',
                },
                'ref': 'undo',
              },
              {
                'kind': 'proto',
                'prototypeId': 'base-navigation-menu-item',
                'children': ['Redo'],
                'props': {
                  'value': 'redo',
                  'textValue': 'Redo',
                },
                'ref': 'redo',
              },
            ],
            'props': {
              'value': 'edit',
              'a11yLabel': 'Edit commands',
            },
          },
        ],
        'props': {
          'a11yLabel': 'Project commands',
        },
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
      {
        'kind': 'box',
        'attrs': { 'id': 'base-navigation-demo-destination' },
        'children': ['Native link destination within this demo.'],
      },
    ],
  },
  setup({ refs, api }) {
    for (const ref of ['new', 'open', 'undo', 'redo'])
      api.setProps(ref, {
        onSelect: (detail: { value: string }) => {
          refs.status.textContent = detail.value + ' selected';
        },
      });
    api.setProps('docs', {
      onNavigate: (detail: { href: string }) => {
        refs.status.textContent = 'Native navigation observed: ' + detail.href;
      },
    });
  },
} satisfies DemoSpec;
