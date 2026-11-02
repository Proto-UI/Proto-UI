import { withShadcnRheaDemo } from '../shadcn-demo-style';
export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-md flex-col gap-5',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['Name'] },
          {
            kind: 'proto',
            prototypeId: 'shadcn-input-root',
            props: { defaultValue: 'Guang', placeholder: 'Your name', ariaLabel: 'Name' },
          },
          {
            kind: 'box',
            className: 'text-xs text-muted-foreground',
            children: ['The Text Control value, editing events, and focus remain Base-owned.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['Disabled'] },
          {
            kind: 'proto',
            prototypeId: 'shadcn-input-root',
            props: { defaultValue: 'Unavailable', disabled: true, ariaLabel: 'Disabled example' },
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['Read only'] },
          {
            kind: 'proto',
            prototypeId: 'shadcn-input-root',
            props: {
              defaultValue: 'Base keeps this focusable.',
              readOnly: true,
              ariaLabel: 'Read-only example',
            },
          },
        ],
      },
    ],
  },
});
