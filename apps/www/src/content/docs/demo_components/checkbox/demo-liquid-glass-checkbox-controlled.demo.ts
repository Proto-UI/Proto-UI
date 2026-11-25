import type {
  DemoSetupContext,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';

function setupLiquidControlled({ refs, api }: DemoSetupContext) {
  let active = true;
  let checked = false;
  let indeterminate = true;

  const sync = () => {
    api.setProps('lgControlled', {
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
    if (refs.lgStatus) {
      refs.lgStatus.textContent = indeterminate
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
  refs.lgMixedBtn?.addEventListener('click', resetMixed);
  return () => {
    active = false;
    refs.lgMixedBtn?.removeEventListener('click', resetMixed);
  };
}

const key = 'lg-controlled-pair';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-md',
    children: [
      {
        kind: 'box',
        className: 'grid gap-3',
        children: [
          {
            kind: 'box',
            className: 'flex items-center gap-3',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-checkbox-root',
                ref: 'lgControlled',
                props: { checked: false, indeterminate: true },
                associations: { controlLabel: key },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-checkbox-indicator',
                    ref: 'lgControlledInd',
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-label-root',
                ref: 'lgControlledLabel',
                props: { naming: true, activation: true },
                associations: { controlLabel: key },
                children: ['Sync workspace preferences'],
              },
            ],
          },
          {
            kind: 'box',
            className: 'flex items-center justify-between gap-3 pt-1',
            children: [
              {
                kind: 'box',
                ref: 'lgStatus',
                className: 'text-xs text-muted-foreground',
                children: ['Current state: indeterminate (mixed)'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-button',
                ref: 'lgMixedBtn',
                props: { variant: 'regular' },
                children: ['Set Mixed'],
              },
            ],
          },
        ],
      },
    ],
  },
  setup: setupLiquidControlled,
} satisfies DemoSpec;
