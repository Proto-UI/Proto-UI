import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-3 p-4 max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-combobox-root',
        props: {
          a11yLabel: 'Timezone',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-combobox-input',
            props: {
              placeholder: 'Select a timezone...',
              a11yLabel: 'Select a timezone',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-combobox-trigger',
            children: ['▾'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-combobox-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-item',
                children: ['(GMT-5) New York'],
                props: {
                  value: 'america-new-york',
                  textValue: '(GMT-5) New York',
                  keywords: 'americas us est nyc',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-item',
                children: ['(GMT-8) Los Angeles'],
                props: {
                  value: 'america-los-angeles',
                  textValue: '(GMT-8) Los Angeles',
                  keywords: 'americas us pst california',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-item',
                children: ['(GMT+0) London'],
                props: {
                  value: 'europe-london',
                  textValue: '(GMT+0) London',
                  keywords: 'europe uk utc',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-item',
                children: ['(GMT+1) Berlin'],
                props: {
                  value: 'europe-berlin',
                  textValue: '(GMT+1) Berlin',
                  keywords: 'europe germany cet',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-item',
                children: ['(GMT+8) Shanghai'],
                props: {
                  value: 'asia-shanghai',
                  textValue: '(GMT+8) Shanghai',
                  keywords: 'asia china cst beijing',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-item',
                children: ['(GMT+9) Tokyo'],
                props: {
                  value: 'asia-tokyo',
                  textValue: '(GMT+9) Tokyo',
                  keywords: 'asia japan jst',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-empty',
                children: ['No timezones found.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'text-xs text-muted-foreground',
        children: ['Try typing a city, region, or abbreviation such as "Europe", "NYC", or "JST".'],
      },
    ],
  },
} satisfies DemoSpec);
