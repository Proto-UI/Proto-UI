import { createTextareaDemoSetup } from './demo-base-textarea.demo';

const primaryProps = {
  defaultValue: 'Lavender surface. Ink border. Hard shadow.',
  disabled: false,
  readOnly: false,
  required: true,
  name: 'poster-notes',
  placeholder: 'Write a poster note',
  autoComplete: 'off',
  minLength: 3,
  maxLength: 240,
  rows: 5,
  wrap: 'soft',
  ariaLabel: '',
  labelledBy: 'textarea-demo-label',
  describedBy: 'textarea-demo-help',
} as const;

export default {
  type: 'demo',
  setup: createTextareaDemoSetup(primaryProps),
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-3 font-mono',
    children: [
      {
        kind: 'box',
        ref: 'externalLabel',
        className: 'text-sm font-bold uppercase tracking-wide',
        children: ['Uncontrolled poster notes'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-textarea-root',
        ref: 'textarea',
        className: 'block w-full',
        props: { ...primaryProps },
      },
      {
        kind: 'box',
        ref: 'help',
        className: 'text-xs font-bold',
        children: ['TYPE, BLUR, OR USE IME. THE CONTROLS EXERCISE THE INHERITED BASE PROTOCOL.'],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap gap-2',
        children: [
          {
            kind: 'box',
            ref: 'toggleProps',
            className:
              'cursor-pointer select-none border-2 border-black bg-yellow-300 px-2 py-1 text-xs font-bold uppercase shadow-[2px_2px_0_0_#000]',
            children: ['Toggle live props'],
          },
          {
            kind: 'box',
            ref: 'focusButton',
            className:
              'cursor-pointer select-none border-2 border-black bg-white px-2 py-1 text-xs font-bold shadow-[2px_2px_0_0_#000]',
            children: ['focusSelf()'],
          },
          {
            kind: 'box',
            ref: 'blurButton',
            className:
              'cursor-pointer select-none border-2 border-black bg-white px-2 py-1 text-xs font-bold shadow-[2px_2px_0_0_#000]',
            children: ['blurSelf()'],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'stateLabel',
        className: 'break-words border-2 border-black bg-white p-2 text-xs',
        children: ['State exposes'],
      },
      {
        kind: 'box',
        ref: 'eventLog',
        className: 'min-h-8 break-words border-2 border-black bg-white p-2 text-xs',
        children: ['Event log: edit the textarea'],
      },
    ],
  },
};
