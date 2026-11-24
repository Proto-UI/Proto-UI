import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-3 p-4 max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-combobox-root',
        props: {
          defaultValue: 'america-new-york',
          a11yLabel: 'Timezone',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-combobox-input',
            props: {
              placeholder: 'Select timezone...',
              a11yLabel: 'Select timezone',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-combobox-trigger',
            children: ['▾'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-combobox-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-item',
                children: ['(GMT-5) New York'],
                props: {
                  value: 'america-new-york',
                  textValue: '(GMT-5) New York',
                  keywords: 'americas us nyc est',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-item',
                children: ['(GMT+0) London'],
                props: {
                  value: 'europe-london',
                  textValue: '(GMT+0) London',
                  keywords: 'europe uk utc',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-item',
                children: ['(GMT+8) Shanghai'],
                props: {
                  value: 'asia-shanghai',
                  textValue: '(GMT+8) Shanghai',
                  keywords: 'asia china cst',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-item',
                children: ['(GMT+9) Tokyo'],
                props: {
                  value: 'asia-tokyo',
                  textValue: '(GMT+9) Tokyo',
                  keywords: 'asia japan jst',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-empty',
                children: ['No timezone found.'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
