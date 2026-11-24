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
        ref: 'disabled-default',
        props: { disabled: true },
        children: ['Disabled'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle',
        ref: 'disabled-outline',
        props: { variant: 'outline', disabled: true },
        children: ['Disabled'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle',
        ref: 'disabled-active',
        props: { variant: 'outline', disabled: true, defaultActive: true },
        children: ['Active Disabled'],
      },
    ],
  },
});
