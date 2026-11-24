import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const COMMAND_LABELS: Record<string, string> = {
  undo: 'Undo last edit',
  redo: 'Redo edit',
  cut: 'Cut selection',
  copy: 'Copy selection',
  save: 'Document saved',
};

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid justify-items-center gap-3 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toolbar-root',
        ref: 'root',
        props: {
          a11yLabel: 'Document actions',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-button',
            ref: 'undo',
            props: { value: 'undo' },
            children: ['Undo'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-button',
            ref: 'redo',
            props: { value: 'redo' },
            children: ['Redo'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-button',
            ref: 'cut',
            props: { value: 'cut' },
            children: ['Cut'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-button',
            ref: 'copy',
            props: { value: 'copy' },
            children: ['Copy'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-button',
            props: { value: 'paste', disabled: true },
            children: ['Paste'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-button',
            ref: 'save',
            props: { value: 'save', variant: 'primary' },
            children: ['Save'],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'status',
        className: 'text-xs text-muted-foreground',
        attrs: {
          role: 'status',
          'aria-live': 'polite',
        },
        children: ['Use Arrow keys to navigate commands, or activate a button.'],
      },
    ],
  },
  setup({ refs, api }) {
    for (const ref of ['undo', 'redo', 'cut', 'copy', 'save']) {
      api.setProps(ref, {
        onAction: (detail: { value: string }) => {
          refs.status.textContent = COMMAND_LABELS[detail.value] ?? detail.value;
        },
      });
    }
  },
} satisfies DemoSpec;
