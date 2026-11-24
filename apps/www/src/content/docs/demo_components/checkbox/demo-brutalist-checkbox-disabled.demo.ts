import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function labeledRow(ref: string, text: string, props: Record<string, unknown>): DemoNode {
  const key = `brutalist-checkbox-${ref}`;
  return {
    kind: 'box',
    className: 'flex items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-checkbox-root',
        ref,
        props,
        associations: { controlLabel: key },
        children: [
          { kind: 'proto', prototypeId: 'brutalist-checkbox-indicator', ref: `${ref}Ind` },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-label-root',
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
    className: 'flex w-full max-w-sm flex-col gap-3.5',
    children: [
      labeledRow('disabledOff', 'Enable notifications', { disabled: true, defaultChecked: false }),
      labeledRow('disabledOn', 'Audit logging enabled (locked)', {
        disabled: true,
        defaultChecked: true,
      }),
      labeledRow('readOnlyOn', 'Read-only consent (focusable)', {
        readOnly: true,
        defaultChecked: true,
      }),
    ],
  },
} satisfies DemoSpec;
