import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-3 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-combobox-root',
        props: {
          defaultValue: 'europe-london',
          a11yLabel: 'Timezone',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-combobox-input',
            props: {
              placeholder: 'Select a timezone...',
              a11yLabel: 'Select a timezone',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-combobox-trigger',
            children: [
              { kind: 'proto', prototypeId: 'lucide-chevron-down-icon', props: { size: 14 } },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-combobox-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-combobox-item',
                children: ['(GMT-5) New York'],
                props: {
                  value: 'america-new-york',
                  textValue: '(GMT-5) New York',
                  keywords: 'americas us nyc est',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-combobox-item',
                children: ['(GMT+0) London'],
                props: {
                  value: 'europe-london',
                  textValue: '(GMT+0) London',
                  keywords: 'europe uk utc',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-combobox-item',
                children: ['(GMT+8) Shanghai'],
                props: {
                  value: 'asia-shanghai',
                  textValue: '(GMT+8) Shanghai',
                  keywords: 'asia china cst',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-combobox-item',
                children: ['(GMT+9) Tokyo'],
                props: {
                  value: 'asia-tokyo',
                  textValue: '(GMT+9) Tokyo',
                  keywords: 'asia japan jst',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-combobox-empty',
                children: ['No timezones found.'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
