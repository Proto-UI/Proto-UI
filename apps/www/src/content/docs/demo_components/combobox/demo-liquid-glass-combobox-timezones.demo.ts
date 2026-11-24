import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'min-w-0 grid gap-3 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-combobox-root',
        props: {
          defaultValue: 'asia-tokyo',
          a11yLabel: 'Timezone',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-combobox-input',
            props: {
              placeholder: 'Select a timezone...',
              a11yLabel: 'Select a timezone',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-combobox-trigger',
            children: ['▾'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-combobox-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-item',
                children: ['(GMT-5) New York'],
                props: {
                  value: 'america-new-york',
                  textValue: '(GMT-5) New York',
                  keywords: 'americas us nyc est',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-item',
                children: ['(GMT+0) London'],
                props: {
                  value: 'europe-london',
                  textValue: '(GMT+0) London',
                  keywords: 'europe uk utc',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-item',
                children: ['(GMT+8) Shanghai'],
                props: {
                  value: 'asia-shanghai',
                  textValue: '(GMT+8) Shanghai',
                  keywords: 'asia china cst',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-item',
                children: ['(GMT+9) Tokyo'],
                props: {
                  value: 'asia-tokyo',
                  textValue: '(GMT+9) Tokyo',
                  keywords: 'asia japan jst',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-empty',
                children: ['No timezones found.'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
