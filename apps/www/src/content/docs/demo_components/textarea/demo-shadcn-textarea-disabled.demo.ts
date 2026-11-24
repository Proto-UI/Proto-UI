import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-md',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-field-root',
        props: {
          disabled: true,
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-label',
            children: ['Message'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-textarea',
            props: {
              placeholder: 'Type your message here.',
              rows: 3,
            },
          },
        ],
      },
    ],
  },
});
