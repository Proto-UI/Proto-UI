import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-field-root',
        props: { disabled: true },
        className: 'flex w-fit flex-row items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-switch',
            props: { defaultChecked: false },
            children: [{ kind: 'proto', prototypeId: 'shadcn-switch-thumb' }],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-label',
            children: ['Disabled (off)'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-field-root',
        props: { disabled: true },
        className: 'flex w-fit flex-row items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-switch',
            props: { defaultChecked: true },
            children: [{ kind: 'proto', prototypeId: 'shadcn-switch-thumb' }],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-label',
            children: ['Disabled (on)'],
          },
        ],
      },
    ],
  },
});
