import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';
export default {
  'type': 'demo',
  'root': {
    'kind': 'proto',
    'prototypeId': 'base-data-table-root',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'base-data-table-caption',
        'children': ['Service inventory'],
      },
      {
        'kind': 'proto',
        'prototypeId': 'base-data-table-row',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'base-data-table-header',
            'children': ['Name'],
            'props': {
              'headerKey': 'name',
              'headerKind': 'column',
            },
          },
          {
            'kind': 'proto',
            'prototypeId': 'base-data-table-header',
            'children': ['Requests'],
            'props': {
              'headerKey': 'requests',
              'headerKind': 'column',
            },
          },
        ],
        'props': {
          'header': true,
        },
        'className': 'grid grid-cols-2',
      },
      {
        'kind': 'proto',
        'prototypeId': 'base-data-table-row',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'base-data-table-cell',
            'props': {
              'columnKey': 'name',
              'headers': ['name'],
            },
          },
          {
            'kind': 'proto',
            'prototypeId': 'base-data-table-cell',
            'props': {
              'columnKey': 'requests',
              'headers': ['requests'],
            },
          },
        ],
        'props': {
          'index': 0,
        },
        'className': 'grid grid-cols-2',
      },
      {
        'kind': 'proto',
        'prototypeId': 'base-data-table-row',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'base-data-table-cell',
            'props': {
              'columnKey': 'name',
              'headers': ['name'],
            },
          },
          {
            'kind': 'proto',
            'prototypeId': 'base-data-table-cell',
            'props': {
              'columnKey': 'requests',
              'headers': ['requests'],
            },
          },
        ],
        'props': {
          'index': 1,
        },
        'className': 'grid grid-cols-2',
      },
      {
        'kind': 'proto',
        'prototypeId': 'base-data-table-row',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'base-data-table-cell',
            'props': {
              'columnKey': 'name',
              'headers': ['name'],
            },
          },
          {
            'kind': 'proto',
            'prototypeId': 'base-data-table-cell',
            'props': {
              'columnKey': 'requests',
              'headers': ['requests'],
            },
          },
        ],
        'props': {
          'index': 2,
        },
        'className': 'grid grid-cols-2',
      },
    ],
    'props': {
      'rows': [
        {
          'id': 'api',
          'name': 'API',
          'requests': 4200,
        },
        {
          'id': 'web',
          'name': 'Website',
          'requests': 8500,
        },
        {
          'id': 'docs',
          'name': 'Docs',
          'requests': 2300,
        },
      ],
      'pageSize': 3,
    },
    'className': 'grid w-full max-w-xl border border-slate-300',
  },
} satisfies DemoSpec;
