import { withShadcnRheaDemo } from '@/content/docs/shadcn-demo-style';
export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-3',
    children: [
      { kind: 'proto', prototypeId: 'shadcn-button', children: ['Default'] },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'secondary' },
        children: ['Secondary'],
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
        props: { variant: 'ghost' },
        children: ['Ghost'],
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
        props: { variant: 'link' },
        children: ['Link'],
      },
    ],
  },
});
