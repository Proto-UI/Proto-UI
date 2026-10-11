import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';
export default {
  'type': 'demo',
  'root': {
    'kind': 'proto',
    'prototypeId': 'bootstrap-2-3-2-carousel-root',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'bootstrap-2-3-2-carousel-viewport',
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'bootstrap-2-3-2-carousel-slide',
            'children': ['First: plan the work'],
            'props': {
              'index': 0,
            },
            'className': 'p-8',
          },
          {
            'kind': 'proto',
            'prototypeId': 'bootstrap-2-3-2-carousel-slide',
            'children': ['Second: build the component'],
            'props': {
              'index': 1,
            },
            'className': 'p-8',
          },
          {
            'kind': 'proto',
            'prototypeId': 'bootstrap-2-3-2-carousel-slide',
            'children': ['Third: verify the result'],
            'props': {
              'index': 2,
            },
            'className': 'p-8',
          },
        ],
        'className': 'min-h-36 border border-slate-300',
      },
      {
        'kind': 'proto',
        'prototypeId': 'bootstrap-2-3-2-carousel-previous',
        'children': ['Previous'],
      },
      {
        'kind': 'proto',
        'prototypeId': 'bootstrap-2-3-2-carousel-next',
        'children': ['Next'],
      },
    ],
    'props': {
      'a11yLabel': 'Project stages',
    },
    'className': 'grid max-w-lg gap-3',
  },
} satisfies DemoSpec;
