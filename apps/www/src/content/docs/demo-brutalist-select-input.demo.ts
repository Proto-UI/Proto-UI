import type { DemoNode, DemoSpec } from '../../components/PrototypePreviewer/demo-types';

const timezones = [
  ['est', 'Eastern Standard Time (EST)'],
  ['cst', 'Central Standard Time (CST)'],
  ['mst', 'Mountain Standard Time (MST)'],
  ['pst', 'Pacific Standard Time (PST)'],
  ['gmt', 'Greenwich Mean Time (GMT)'],
  ['cet', 'Central European Time (CET)'],
  ['ist', 'India Standard Time (IST)'],
  ['cst_china', 'China Standard Time (CST)'],
  ['jst', 'Japan Standard Time (JST)'],
  ['kst', 'Korea Standard Time (KST)'],
  ['aest', 'Australian Eastern Standard Time (AEST)'],
  ['nzst', 'New Zealand Standard Time (NZST)'],
] as const;

function tzItem(value: string, textValue: string): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'brutalist-select-item',
    props: { value, textValue },
    children: [textValue],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-select-root',
        ref: 'timezoneSelect',
        props: { value: 'jst' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-trigger',
            className: 'w-64',
            props: { accessibleLabel: 'Timezone selector' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-select-value',
                props: { placeholder: 'Select a timezone' },
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-content',
            props: { position: 'popper', align: 'start' },
            surfaceStyle: { maxHeight: '200px', overflowY: 'auto' },
            children: timezones.map(([value, label]) => tzItem(value, label)),
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        ref: 'resetTimezone',
        props: { size: 'sm' },
        children: ['Reset'],
      },
    ],
  },
  setup({ api }) {
    let alive = true;
    const sync = (next: string) => {
      if (!alive) return;
      api.setProps('timezoneSelect', {
        value: next,
        onValueChange: (event: { value: string }) => sync(event.value),
      });
    };
    sync('jst');
    api.setProps('resetTimezone', {
      onClick: () => sync('jst'),
    });
    return () => {
      alive = false;
    };
  },
} satisfies DemoSpec;
