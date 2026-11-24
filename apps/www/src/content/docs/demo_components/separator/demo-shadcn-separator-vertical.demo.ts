import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex h-5 items-center gap-4 text-sm',
    children: [
      { kind: 'box', children: ['Blog'] },
      {
        kind: 'proto',
        prototypeId: 'shadcn-separator-root',
        props: { orientation: 'vertical' },
      },
      { kind: 'box', children: ['Docs'] },
      {
        kind: 'proto',
        prototypeId: 'shadcn-separator-root',
        props: { orientation: 'vertical' },
      },
      { kind: 'box', children: ['Source'] },
    ],
  },
});
