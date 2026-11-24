import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm flex-col gap-2 text-sm',
    children: [
      {
        kind: 'box',
        className: 'flex items-center justify-between',
        children: [
          { kind: 'box', tag: 'span', children: ['Item 1'] },
          { kind: 'box', tag: 'span', className: 'text-muted-foreground', children: ['Value 1'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-separator-root',
        props: { decorative: false },
      },
      {
        kind: 'box',
        className: 'flex items-center justify-between',
        children: [
          { kind: 'box', tag: 'span', children: ['Item 2'] },
          { kind: 'box', tag: 'span', className: 'text-muted-foreground', children: ['Value 2'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-separator-root',
        props: { decorative: false },
      },
      {
        kind: 'box',
        className: 'flex items-center justify-between',
        children: [
          { kind: 'box', tag: 'span', children: ['Item 3'] },
          { kind: 'box', tag: 'span', className: 'text-muted-foreground', children: ['Value 3'] },
        ],
      },
    ],
  },
});
