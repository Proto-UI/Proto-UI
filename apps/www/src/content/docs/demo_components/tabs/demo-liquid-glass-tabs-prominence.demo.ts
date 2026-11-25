export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-[468px] gap-5',
    children: [
      {
        kind: 'box',
        className: 'grid gap-2',
        children: [
          {
            kind: 'box',
            className: 'text-xs font-medium text-muted-foreground',
            children: ['Prominent glass bar (prominence="prominent")'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-root',
            props: { defaultValue: 'overview' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-list',
                props: { prominence: 'prominent' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-tabs-trigger',
                    props: { value: 'overview' },
                    children: ['Overview'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-tabs-trigger',
                    props: { value: 'analytics' },
                    children: ['Analytics'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-tabs-trigger',
                    props: { value: 'reports' },
                    children: ['Reports'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-content',
                props: { value: 'overview' },
                children: [
                  'Prominent style tints the navigation track for higher visual emphasis.',
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-content',
                props: { value: 'analytics' },
                children: ['Active lens remains crisp without stacking glass-on-glass.'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-content',
                props: { value: 'reports' },
                children: ['Exports and audit digests.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'grid gap-2',
        children: [
          {
            kind: 'box',
            className: 'text-xs font-medium text-muted-foreground',
            children: ['Explicit opaque fallback (material="opaque")'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-root',
            props: { defaultValue: 'overview' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-list',
                props: { material: 'opaque' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-tabs-trigger',
                    props: { value: 'overview' },
                    children: ['Overview'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-tabs-trigger',
                    props: { value: 'analytics' },
                    children: ['Analytics'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-tabs-trigger',
                    props: { value: 'reports' },
                    children: ['Reports'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-content',
                props: { value: 'overview' },
                children: [
                  'Withdraws the backdrop glass candidate while preserving concentric geometry and readable contrast.',
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-content',
                props: { value: 'analytics' },
                children: ['Matches reduced-transparency fallback appearance predictably.'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-content',
                props: { value: 'reports' },
                children: ['Reports remain legible over any surface.'],
              },
            ],
          },
        ],
      },
    ],
  },
};
