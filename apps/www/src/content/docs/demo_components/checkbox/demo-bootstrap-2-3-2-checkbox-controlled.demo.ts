import type {
  DemoSetupContext,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';

function setupBootstrapControlled({ refs, api }: DemoSetupContext) {
  let active = true;
  let checked = false;
  let indeterminate = true;

  const sync = () => {
    api.setProps('bsControlled', {
      checked,
      indeterminate,
      onCheckedChange: (detail: unknown) => {
        if (!active || !detail || typeof detail !== 'object') return;
        const next = detail as { checked?: unknown; indeterminate?: unknown };
        if (typeof next.checked === 'boolean') checked = next.checked;
        if (typeof next.indeterminate === 'boolean') indeterminate = next.indeterminate;
        sync();
      },
      onIndeterminateChange: (detail: unknown) => {
        if (!active || !detail || typeof detail !== 'object') return;
        const next = detail as { indeterminate?: unknown };
        if (typeof next.indeterminate === 'boolean') indeterminate = next.indeterminate;
        sync();
      },
    });
    if (refs.bsStatus) {
      refs.bsStatus.textContent = indeterminate
        ? 'Current state: indeterminate (mixed)'
        : checked
          ? 'Current state: checked'
          : 'Current state: unchecked';
    }
  };

  const resetMixed = () => {
    if (!active) return;
    checked = false;
    indeterminate = true;
    sync();
  };

  sync();
  refs.bsMixedBtn?.addEventListener('click', resetMixed);
  return () => {
    active = false;
    refs.bsMixedBtn?.removeEventListener('click', resetMixed);
  };
}

const key = 'bs232-checkbox-controlled-pair';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm flex-col gap-3',
    children: [
      {
        kind: 'box',
        className: 'flex items-center gap-2.5',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-checkbox-root',
            ref: 'bsControlled',
            props: { checked: false, indeterminate: true },
            associations: { controlLabel: key },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-checkbox-indicator',
                ref: 'bsControlledInd',
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-label-root',
            ref: 'bsControlledLabel',
            props: { naming: true, activation: true },
            associations: { controlLabel: key },
            children: ['Sync workspace preferences'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center justify-between gap-3 rounded border border-border px-3 py-2',
        children: [
          {
            kind: 'box',
            ref: 'bsStatus',
            className: 'text-xs text-muted-foreground',
            children: ['Current state: indeterminate (mixed)'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-button',
            ref: 'bsMixedBtn',
            props: {},
            children: ['Set Mixed'],
          },
        ],
      },
    ],
  },
  setup: setupBootstrapControlled,
} satisfies DemoSpec;
