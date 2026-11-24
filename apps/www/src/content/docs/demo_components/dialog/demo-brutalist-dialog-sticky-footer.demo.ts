const GUIDELINES = [
  '1. Raised controls carry a 4px hard black shadow and settle +4px on press.',
  '2. Raised panels such as Dialog Content stay stationary without press shift.',
  '3. High-contrast focus rings remain clearly visible in both light and dark themes.',
  '4. Close wrappers inherit Base dismissal semantics without forcing a second Tab stop.',
  '5. Footer actions stay pinned below the scrollable content region for quick confirmation.',
  '6. Keyboard navigation loops within the modal and returns focus to the trigger upon close.',
];

export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-dialog-root',
    children: [
      { kind: 'proto', prototypeId: 'brutalist-dialog-trigger', children: ['Sticky Footer'] },
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
                    children: ['Sticky Footer'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-dialog-description',
                    children: ['Footer actions stay visible while you read through the modal body.'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'box',
            className: 'max-h-[45vh] overflow-y-auto pr-2 grid gap-3 text-sm leading-relaxed',
            children: GUIDELINES.map((item) => ({
              kind: 'box' as const,
              children: [item],
            })),
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-dialog-footer',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-dialog-close',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-button',
                    props: { variant: 'neutral' },
                    children: ['Close'],
                  },
                ],
              },
            ],
          },
          { kind: 'proto', prototypeId: 'brutalist-dialog-close-icon' },
        ],
      },
    ],
  },
};
