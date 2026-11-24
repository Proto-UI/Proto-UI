import { withShadcnRheaDemo } from '../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-md',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-textarea-root',
        props: {
          placeholder: 'Type your message here.',
          ariaLabel: 'Message',
          rows: 4,
        },
      },
    ],
  },
});
