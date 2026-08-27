function checkboxRow({
  ref,
  label,
  props,
}: {
  ref: string;
  label: string;
  props: Record<string, unknown>;
}) {
  return {
    kind: 'box',
    className: 'flex items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-checkbox-root',
        ref,
        props,
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-checkbox-indicator',
          },
          { kind: 'box', className: 'sr-only', children: [label] },
        ],
      },
      { kind: 'box', className: 'font-bold', children: [label] },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col gap-4',
    children: [
      checkboxRow({
        ref: 'uncheckedCheckbox',
        label: 'Unchecked',
        props: { defaultChecked: false },
      }),
      checkboxRow({
        ref: 'checkedCheckbox',
        label: 'Checked',
        props: { defaultChecked: true },
      }),
      checkboxRow({
        ref: 'mixedCheckbox',
        label: 'Mixed',
        props: { defaultIndeterminate: true },
      }),
      checkboxRow({
        ref: 'disabledCheckbox',
        label: 'Disabled',
        props: { disabled: true, defaultChecked: true },
      }),
      checkboxRow({
        ref: 'focusCheckbox',
        label: 'Tab here for focus-visible',
        props: { defaultChecked: false },
      }),
      checkboxRow({
        ref: 'checkedIndeterminateCheckbox',
        label: 'Checked and indeterminate (mixed wins)',
        props: { defaultChecked: true, defaultIndeterminate: true },
      }),
    ],
  },
};
