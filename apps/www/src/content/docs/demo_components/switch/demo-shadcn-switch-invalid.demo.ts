import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-field-root',
    props: { invalid: true },
    className: 'flex w-full max-w-sm flex-row items-center justify-between gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex min-w-0 flex-1 flex-col gap-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-label',
            children: ['Accept terms and conditions'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-description',
            children: ['You must accept the terms and conditions to continue.'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-field-switch',
        props: { defaultChecked: false },
        children: [{ kind: 'proto', prototypeId: 'shadcn-switch-thumb' }],
      },
    ],
  },
});
