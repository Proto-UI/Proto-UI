import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle',
        ref: 'sm',
        props: { variant: 'outline', size: 'sm' },
        children: ['Small'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle',
        ref: 'default',
        props: { variant: 'outline', size: 'default' },
        children: ['Default'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle',
        ref: 'lg',
        props: { variant: 'outline', size: 'lg' },
        children: ['Large'],
      },
    ],
  },
});
