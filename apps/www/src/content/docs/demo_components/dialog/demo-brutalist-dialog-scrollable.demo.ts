const CHANGELOG_ITEMS = [
  'v0.3 — Added focus-trapping Dialog anatomy with independent Mask and Content transitions.',
  'v0.3 — Aligned Brutalist close icon pressed sink and offset focus ring with the family design contract.',
  'v0.3 — Adopted DM Sans medium/bold typography and 5px rounded corners across raised panels.',
  'v0.2 — Introduced high-contrast dark theme variables for panel surfaces and destructive accents.',
  'v0.2 — Added Escape and outside-press dismissal coordination with alertdialog mode support.',
  'v0.1 — Established portable Base Dialog state ownership across Web Components, React, and Vue.',
];

export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-dialog-root',
    children: [
      { kind: 'proto', prototypeId: 'brutalist-dialog-trigger', children: ['Scrollable Content'] },
      { kind: 'proto', prototypeId: 'brutalist-dialog-mask' },
      {
        kind: 'proto',
        prototypeId: 'brutalist-dialog-content',
        children: [
          {
            kind: 'box',
            className: 'min-w-0 pe-12',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-dialog-header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-dialog-title',
                    children: ['Scrollable Content'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-dialog-description',
                    children: ['Scroll through long changelog entries while keeping the header anchored.'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'box',
            className: 'max-h-[45vh] overflow-y-auto pr-2 grid gap-3 text-sm leading-relaxed',
            children: CHANGELOG_ITEMS.map((item) => ({
              kind: 'box' as const,
              className: 'rounded-base border-2 border-black bg-secondary-background p-3',
              children: [item],
            })),
          },
          { kind: 'proto', prototypeId: 'brutalist-dialog-close-icon' },
        ],
      },
    ],
  },
};
