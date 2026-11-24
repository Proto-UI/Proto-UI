import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const timezoneGroups = [
  {
    label: 'North America',
    items: [
      ['est', 'Eastern Standard Time (EST)'],
      ['cst', 'Central Standard Time (CST)'],
      ['mst', 'Mountain Standard Time (MST)'],
      ['pst', 'Pacific Standard Time (PST)'],
    ],
  },
  {
    label: 'Europe & Africa',
    items: [
      ['gmt', 'Greenwich Mean Time (GMT)'],
      ['cet', 'Central European Time (CET)'],
      ['eet', 'Eastern European Time (EET)'],
    ],
  },
  {
    label: 'Asia & Pacific',
    items: [
      ['ist', 'India Standard Time (IST)'],
      ['cst_china', 'China Standard Time (CST)'],
      ['jst', 'Japan Standard Time (JST)'],
      ['aest', 'Australian Eastern Standard Time (AEST)'],
    ],
  },
] as const;

function tzGroup(label: string, items: readonly (readonly [string, string])[]): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'bootstrap-2-3-2-select-group',
    children: [
      { kind: 'proto', prototypeId: 'bootstrap-2-3-2-select-label', children: [label] },
      ...items.map(
        ([value, textValue]): DemoNode => ({
          kind: 'proto',
          prototypeId: 'bootstrap-2-3-2-select-item',
          props: { value, textValue },
          children: [
            {
              kind: 'proto',
              prototypeId: 'bootstrap-2-3-2-select-item-text',
              children: [textValue],
            },
          ],
        })
      ),
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'bootstrap-2-3-2-select-root',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-select-trigger',
        className: 'w-64',
        props: { accessibleLabel: 'Timezone selector' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-select-value',
            props: { placeholder: 'Select a timezone' },
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-select-content',
        props: { align: 'start', sideOffset: 2, collisionPadding: 12 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-select-surface',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-select-viewport',
                surfaceStyle: { maxHeight: '220px', overflowY: 'auto' },
                children: timezoneGroups.flatMap((group, index) => [
                  ...(index > 0
                    ? [{ kind: 'proto' as const, prototypeId: 'bootstrap-2-3-2-select-separator' }]
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
} satisfies DemoSpec;
