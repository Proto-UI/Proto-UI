export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col gap-8 p-8',
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-slider-root',
        className: 'w-full max-w-md',
        props: { defaultValue: 30, disabled: true },
      },
    ],
  },
};
