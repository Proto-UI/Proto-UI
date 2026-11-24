import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center gap-2 text-sm md:gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-1',
        children: [
          { kind: 'box', tag: 'span', className: 'font-medium', children: ['Settings'] },
          {
            kind: 'box',
            tag: 'span',
            className: 'text-xs text-muted-foreground',
            children: ['Manage preferences'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-separator-root',
        props: { orientation: 'vertical' },
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-1',
        children: [
          { kind: 'box', tag: 'span', className: 'font-medium', children: ['Account'] },
          {
            kind: 'box',
            tag: 'span',
            className: 'text-xs text-muted-foreground',
            children: ['Profile & security'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-separator-root',
        className: 'hidden md:block',
        props: { orientation: 'vertical' },
      },
      {
        kind: 'box',
        className: 'hidden flex-col gap-1 md:flex',
        children: [
          { kind: 'box', tag: 'span', className: 'font-medium', children: ['Help'] },
          {
            kind: 'box',
            tag: 'span',
            className: 'text-xs text-muted-foreground',
            children: ['Support & docs'],
          },
        ],
      },
    ],
  },
});
