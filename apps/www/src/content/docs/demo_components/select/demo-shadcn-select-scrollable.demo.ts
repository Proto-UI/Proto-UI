import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const timezoneGroups = [
  {
    label: 'North America',
    items: [
      ['est', 'Eastern Standard Time (EST)'],
      ['cst', 'Central Standard Time (CST)'],
      ['mst', 'Mountain Standard Time (MST)'],
      ['pst', 'Pacific Standard Time (PST)'],
      ['akst', 'Alaska Standard Time (AKST)'],
      ['hst', 'Hawaii Standard Time (HST)'],
    ],
  },
  {
    label: 'Europe & Africa',
    items: [
      ['gmt', 'Greenwich Mean Time (GMT)'],
      ['cet', 'Central European Time (CET)'],
      ['eet', 'Eastern European Time (EET)'],
      ['west', 'Western European Summer Time (WEST)'],
      ['cat', 'Central Africa Time (CAT)'],
    ],
  },
  {
    label: 'Asia',
    items: [
      ['msk', 'Moscow Time (MSK)'],
      ['ist', 'India Standard Time (IST)'],
      ['cst_china', 'China Standard Time (CST)'],
      ['jst', 'Japan Standard Time (JST)'],
      ['kst', 'Korea Standard Time (KST)'],
    ],
  },
  {
    label: 'Australia & Pacific',
    items: [
      ['awst', 'Australian Western Standard Time (AWST)'],
      ['acst', 'Australian Central Standard Time (ACST)'],
      ['aest', 'Australian Eastern Standard Time (AEST)'],
      ['nzst', 'New Zealand Standard Time (NZST)'],
    ],
  },
] as const;

function tzGroup(label: string, items: readonly (readonly [string, string])[]): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'shadcn-select-group',
    children: [
      { kind: 'proto', prototypeId: 'shadcn-select-label', children: [label] },
      ...items.map(
        ([value, textValue]): DemoNode => ({
          kind: 'proto',
          prototypeId: 'shadcn-select-item',
          props: { value, textValue },
          children: [
            {
              kind: 'proto',
              prototypeId: 'shadcn-select-item-text',
              children: [textValue],
            },
          ],
        })
      ),
    ],
  };
}

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-select-root',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-select-trigger',
        className: 'w-64',
        props: { accessibleLabel: 'Timezone selector' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-select-value',
            props: { placeholder: 'Select a timezone' },
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-select-content',
        props: { position: 'popper', align: 'start' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-select-surface',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-select-viewport',
                surfaceStyle: { maxHeight: '220px', overflowY: 'auto' },
                children: timezoneGroups.flatMap((group, index) => [
                  ...(index > 0
                    ? [{ kind: 'proto' as const, prototypeId: 'shadcn-select-separator' }]
                    : []),
                  tzGroup(group.label, group.items),
                ]),
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
