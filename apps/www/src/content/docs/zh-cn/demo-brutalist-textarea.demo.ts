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
              // Accent fills ship as a fixed background/foreground pair, so the chip
              // keeps ink text and an ink outline in both themes. Only its hard shadow,
              // which falls on the page surface, follows the theme.
              'cursor-pointer select-none border-2 border-[var(--pui-main-foreground)] bg-[var(--pui-main)] px-2 py-1 text-xs font-bold uppercase text-[var(--pui-main-foreground)] shadow-[2px_2px_0_0_var(--pui-foreground)]',
            children: ['Toggle live props'],
          },
          {
            kind: 'box',
            ref: 'focusButton',
            className:
              'cursor-pointer select-none border-2 border-[var(--pui-foreground)] bg-[var(--pui-secondary-background)] px-2 py-1 text-xs font-bold text-[var(--pui-foreground)] shadow-[2px_2px_0_0_var(--pui-foreground)]',
            children: ['focusSelf()'],
          },
          {
            kind: 'box',
            ref: 'blurButton',
            className:
              'cursor-pointer select-none border-2 border-[var(--pui-foreground)] bg-[var(--pui-secondary-background)] px-2 py-1 text-xs font-bold text-[var(--pui-foreground)] shadow-[2px_2px_0_0_var(--pui-foreground)]',
            children: ['blurSelf()'],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'stateLabel',
        className:
          'break-words border-2 border-[var(--pui-foreground)] bg-[var(--pui-secondary-background)] p-2 text-xs text-[var(--pui-foreground)]',
        children: ['State exposes'],
      },
      {
        kind: 'box',
        ref: 'eventLog',
        className:
          'min-h-8 break-words border-2 border-[var(--pui-foreground)] bg-[var(--pui-secondary-background)] p-2 text-xs text-[var(--pui-foreground)]',
        children: ['Event log: edit the textarea'],
      },
    ],
  },
};
