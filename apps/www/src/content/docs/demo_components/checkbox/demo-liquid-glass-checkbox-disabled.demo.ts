import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function row(ref: string, text: string, props: Record<string, unknown>): DemoNode {
  const key = `lg-disabled-${ref}`;
  return {
    kind: 'box',
    className: 'flex items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-checkbox-root',
        ref,
        props,
        associations: { controlLabel: key },
        children: [
          { kind: 'proto', prototypeId: 'liquid-glass-checkbox-indicator', ref: `${ref}Ind` },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-label-root',
        ref: `${ref}Label`,
        props: { naming: true, activation: true },
        associations: { controlLabel: key },
        children: [text],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-md',
    children: [
      {
        kind: 'box',
        className: 'grid gap-3.5',
        children: [
          row('lgDisabledOff', 'Enable notifications', { disabled: true, defaultChecked: false }),
          row('lgDisabledOn', 'Audit logging enabled (locked)', {
            disabled: true,
            defaultChecked: true,
          }),
          row('lgReadOnly', 'Read-only consent (focusable)', {
            readOnly: true,
            defaultChecked: true,
          }),
        ],
      },
    ],
  },
} satisfies DemoSpec;
