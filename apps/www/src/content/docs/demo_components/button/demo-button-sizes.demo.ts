import { withShadcnRheaDemo } from '../../shadcn-demo-style';
export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { size: 'sm' },
        children: ['Small'],
      },
      { kind: 'proto', prototypeId: 'shadcn-button', children: ['Default'] },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { size: 'lg' },
        children: ['Large'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { size: 'icon', variant: 'outline' },
        children: [
          { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['+'] },
          { kind: 'box', tag: 'span', className: 'sr-only', children: ['Add'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { size: 'icon-compact', variant: 'outline' },
        children: [
          { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['+'] },
          { kind: 'box', tag: 'span', className: 'sr-only', children: ['Add'] },
        ],
      },
    ],
  },
});
