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
    prototypeId: 'liquid-glass-select-group',
    children: [
      { kind: 'proto', prototypeId: 'liquid-glass-select-label', children: [label] },
      ...items.map(
        ([value, textValue]): DemoNode => ({
          kind: 'proto',
          prototypeId: 'liquid-glass-select-item',
          props: { value, textValue },
          children: [
            {
              kind: 'proto',
              prototypeId: 'liquid-glass-select-item-text',
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
    kind: 'box',
    ref: 'scrollStage',
    className:
      'min-w-0 w-full rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    materialStage: { mountRef: 'scrollFlow', overlayRef: 'scrollOverlay' },
    children: [
      {
        kind: 'box',
        ref: 'scrollFlow',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-select-root',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-select-trigger',
                className: 'w-64',
                props: { accessibleLabel: 'Timezone selector' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-select-value',
                    props: { placeholder: 'Select a timezone' },
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-select-content',
                props: { align: 'start', sideOffset: 8, collisionPadding: 12 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-select-surface',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-select-viewport',
                        surfaceStyle: { maxHeight: '220px', overflowY: 'auto' },
                        children: timezoneGroups.flatMap((group, index) => [
                          ...(index > 0
                            ? [
                                {
                                  kind: 'proto' as const,
                                  prototypeId: 'liquid-glass-select-separator',
                                },
                              ]
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
        ],
      },
      { kind: 'box', ref: 'scrollOverlay', children: [] },
    ],
  },
} satisfies DemoSpec;
