import { withShadcnRheaDemo } from '../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-switch-root',
        props: { defaultChecked: false },
        children: [
          { kind: 'proto', prototypeId: 'shadcn-switch-thumb' },
          { kind: 'box', className: 'sr-only', children: ['Airplane Mode'] },
        ],
      },
      {
        kind: 'box',
        tag: 'span',
        className: 'text-sm font-medium leading-none text-foreground select-none',
        children: ['Airplane Mode'],
      },
    ],
  },
});
