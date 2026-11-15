import { withShadcnRheaDemo } from '../../shadcn-demo-style';
export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-3',
    children: [
      { kind: 'proto', prototypeId: 'shadcn-button', children: ['Default'] },
      {
        kind: 'box',
        children: [{ kind: 'proto', prototypeId: 'shadcn-button', children: ['Default2'] }],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'outline' },
        children: ['Outline'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'destructive' },
        children: ['Destructive'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'ghost', size: 'icon' },
        children: [
          { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['+'] },
          { kind: 'box', tag: 'span', className: 'sr-only', children: ['Add'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { disabled: true },
        children: ['Disabled'],
      },
    ],
  },
});
