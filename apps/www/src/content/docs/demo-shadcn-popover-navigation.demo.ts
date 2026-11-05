import type { DemoSpec } from '../../components/PrototypePreviewer/demo-types';

// Explicit public navigation presentation; native anchors retain activation.
// The original default Popover demo remains separate and unchanged.
export default {
  'type': 'demo',
  'root': {
    'kind': 'box',
    'className': 'flex min-w-0 flex-wrap items-center gap-4 p-4',
    'children': [
      {
        'kind': 'proto',
        'prototypeId': 'shadcn-popover-root',
        'ref': 'navigation-root',
        'props': {
          'a11yLabel': 'Documentation navigation',
          'styleProfile': 'rhea',
        },
        'children': [
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-popover-trigger',
            'ref': 'navigation-trigger',
            'props': {
              'presentation': 'navigation',
            },
            'children': ['Menu'],
          },
          {
            'kind': 'proto',
            'prototypeId': 'shadcn-popover-content',
            'ref': 'navigation-content',
            'previewTheme': 'portal',
            'props': {
              'presentation': 'navigation',
            },
            'children': [
              {
                'kind': 'proto',
                'prototypeId': 'shadcn-popover-title',
                'children': ['Documentation navigation'],
              },
              {
                'kind': 'box',
                'className': 'flex min-w-0 flex-col',
                'children': [
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-01',
                    },
                    'children': ['Navigation section 01'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-02',
                    },
                    'children': ['Navigation section 02'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-03',
                    },
                    'children': ['Navigation section 03'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-04',
                    },
                    'children': ['Navigation section 04'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-05',
                    },
                    'children': ['Navigation section 05'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-06',
                    },
                    'children': ['Navigation section 06'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-07',
                    },
                    'children': ['Navigation section 07'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-08',
                    },
                    'children': ['Navigation section 08'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-09',
                    },
                    'children': ['Navigation section 09'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-10',
                    },
                    'children': ['Navigation section 10'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-11',
                    },
                    'children': ['Navigation section 11'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-12',
                    },
                    'children': ['Navigation section 12'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-13',
                    },
                    'children': ['Navigation section 13'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-14',
                    },
                    'children': ['Navigation section 14'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-15',
                    },
                    'children': ['Navigation section 15'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-16',
                    },
                    'children': ['Navigation section 16'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-17',
                    },
                    'children': ['Navigation section 17'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-18',
                    },
                    'children': ['Navigation section 18'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-19',
                    },
                    'children': ['Navigation section 19'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-20',
                    },
                    'children': ['Navigation section 20'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-21',
                    },
                    'children': ['Navigation section 21'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-22',
                    },
                    'children': ['Navigation section 22'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-23',
                    },
                    'children': ['Navigation section 23'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-24',
                    },
                    'children': ['Navigation section 24'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-25',
                    },
                    'children': ['Navigation section 25'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-26',
                    },
                    'children': ['Navigation section 26'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-27',
                    },
                    'children': ['Navigation section 27'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-28',
                    },
                    'children': ['Navigation section 28'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-29',
                    },
                    'children': ['Navigation section 29'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-30',
                    },
                    'children': ['Navigation section 30'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-31',
                    },
                    'children': ['Navigation section 31'],
                  },
                  {
                    'kind': 'box',
                    'tag': 'a',
                    'className': 'block px-3 py-2 underline underline-offset-4',
                    'attrs': {
                      'href': '#navigation-section-32',
                    },
                    'children': ['Navigation section 32'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        'kind': 'box',
        'tag': 'a',
        'ref': 'navigation-outside',
        'attrs': {
          'href': '#navigation-outside-destination',
          'id': 'navigation-outside-destination',
        },
        'children': ['Outside navigation link'],
      },
    ],
  },
} satisfies DemoSpec;
