export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle',
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none',
            props: { name: 'bold', size: 16 },
          },
          { kind: 'box', className: 'sr-only', children: ['Bold'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle',
        props: { variant: 'outline', defaultActive: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none',
            props: { name: 'italic', size: 16 },
          },
          { kind: 'box', className: 'sr-only', children: ['Italic'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle',
        props: { size: 'sm' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none',
            props: { name: 'underline', size: 16 },
          },
          { kind: 'box', className: 'sr-only', children: ['Underline'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle',
        props: { disabled: true, defaultActive: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none',
            props: { name: 'strikethrough', size: 16 },
          },
          { kind: 'box', className: 'sr-only', children: ['Strikethrough'] },
        ],
      },
    ],
  },
};
