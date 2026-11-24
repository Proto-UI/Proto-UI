import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function labeledRow(ref: string, text: string, props: Record<string, unknown>): DemoNode {
  const key = `bs232-checkbox-${ref}`;
  return {
    kind: 'box',
    className: 'flex items-center gap-2.5',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-checkbox-root',
        ref,
        props,
        associations: { controlLabel: key },
        children: [
          { kind: 'proto', prototypeId: 'bootstrap-2-3-2-checkbox-indicator', ref: `${ref}Ind` },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-label-root',
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
    className: 'flex w-full max-w-sm flex-col gap-3',
    children: [
      labeledRow('bsDisabledOff', 'Enable notifications', {
        disabled: true,
        defaultChecked: false,
      }),
      labeledRow('bsDisabledOn', 'Audit logging enabled (locked)', {
        disabled: true,
        defaultChecked: true,
      }),
      labeledRow('bsReadOnly', 'Read-only consent (focusable)', {
        readOnly: true,
        defaultChecked: true,
      }),
    ],
  },
} satisfies DemoSpec;
