import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const RELEASE_NOTES = [
  '1. Focus management traps keyboard traversal inside the dialog while it is open and restores focus to the trigger when dismissed.',
  '2. Escape dismissal and outside pointer dismissal respect the active dialog mode so confirmation flows remain predictable.',
  '3. Live aria-labelledby and aria-describedby relations automatically track mounted Title and Description parts.',
  '4. Scrollable body sections stay contained inside the dialog frame while the header and footer remain pinned in view.',
  '5. Leave transitions keep both the modal surface and backdrop mounted until their configured fade completes.',
  '6. Consumer style scopes can switch between Shadcn style profiles without duplicating dialog state or command logic.',
];

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-dialog-root',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-dialog-trigger',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { variant: 'outline' },
            children: ['Sticky Footer'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-dialog-mask',
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-dialog-content',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-dialog-header',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-dialog-title',
                children: ['Sticky Footer'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-dialog-description',
                children: ['This dialog keeps its footer actions visible while the content scrolls.'],
              },
            ],
          },
          {
            kind: 'box',
            className: 'max-h-[45vh] overflow-y-auto pr-2 grid gap-3 text-sm leading-relaxed text-muted-foreground',
            children: RELEASE_NOTES.map((paragraph) => ({
              kind: 'box' as const,
              children: [paragraph],
            })),
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-dialog-footer',
            children: [
              {
                kind: 'box',
                className: 'min-w-0 max-w-full',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-dialog-close',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-button',
                        props: { variant: 'outline', wrap: true },
                        children: ['Close'],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-dialog-close-icon',
          },
        ],
      },
    ],
  },
});
