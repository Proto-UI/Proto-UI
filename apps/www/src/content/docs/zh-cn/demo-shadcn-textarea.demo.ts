export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-md flex-col gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          {
            kind: 'box',
            className: 'text-sm font-medium',
            children: ['Release note'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-textarea-root',
            props: {
              defaultValue: 'Edit this note to exercise uncontrolled ownership.',
              placeholder: 'Write a release note',
              name: 'release-note',
              rows: 4,
              maxLength: 240,
            },
          },
          {
            kind: 'box',
            className: 'text-xs text-muted-foreground',
            children: ['Value, editing, and IME stay with Base Textarea.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          {
            kind: 'box',
            className: 'text-sm font-medium',
            children: ['Disabled'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-textarea-root',
            props: {
              defaultValue: 'This editor is disabled.',
              disabled: true,
              ariaLabel: 'Disabled release note',
              rows: 2,
            },
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          {
            kind: 'box',
            className: 'text-sm font-medium',
            children: ['Read only'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-textarea-root',
            props: {
              defaultValue: 'This editor is read only, and still focusable.',
              readOnly: true,
              ariaLabel: 'Read-only release note',
              rows: 2,
            },
          },
        ],
      },
    ],
  },
};
