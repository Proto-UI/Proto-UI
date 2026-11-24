import type { DemoChild, DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export type FieldsetDemoFamily = 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';

type DemoProtoNode = Extract<DemoNode, { kind: 'proto' }>;

function proto(
  prototypeId: string,
  props: Record<string, unknown> = {},
  children: DemoChild[] = [],
  options: Omit<DemoProtoNode, 'kind' | 'prototypeId' | 'props' | 'children'> = {}
): DemoProtoNode {
  return {
    kind: 'proto',
    prototypeId,
    props,
    children,
    ...options,
  };
}

function wrapStage(
  family: FieldsetDemoFamily,
  children: DemoChild[],
  widthClass = 'max-w-sm'
): DemoNode {
  const inner: DemoNode = {
    kind: 'box',
    className: `mx-auto w-full ${widthClass} min-w-0`,
    children,
  };

  if (family === 'liquid-glass') {
    return {
      kind: 'box',
      className:
        'w-full rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
      children: [inner],
    };
  }

  return {
    kind: 'box',
    className: 'w-full p-4',
    children: [inner],
  };
}

function textField(
  family: FieldsetDemoFamily,
  label: string,
  placeholder: string,
  options: { required?: boolean; defaultValue?: string } = {}
): DemoProtoNode {
  const controlProps: Record<string, unknown> = { placeholder };
  if (options.defaultValue !== undefined) {
    controlProps.defaultValue = options.defaultValue;
  }
  return proto(`${family}-field-root`, options.required ? { required: true } : {}, [
    proto(`${family}-field-label`, {}, [label]),
    proto(`${family}-field-control`, controlProps),
    proto(`${family}-field-error`),
  ]);
}

/** Primary hero demo matching upstream FieldFieldset (Address Information). */
export function createFieldsetAddressDemo(family: FieldsetDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapStage(family, [
      proto(
        `${family}-fieldset-root`,
        {},
        [
          proto(`${family}-fieldset-legend`, {}, ['Address Information']),
          proto(`${family}-fieldset-description`, {}, [
            'We need your address to deliver your order.',
          ]),
          {
            kind: 'box',
            className: 'grid w-full min-w-0 gap-4',
            children: [
              textField(family, 'Street Address', '123 Main St', { required: true }),
              {
                kind: 'box',
                className: 'grid grid-cols-2 gap-4',
                children: [
                  textField(family, 'City', 'New York'),
                  textField(family, 'Postal Code', '90502'),
                ],
              },
            ],
          },
        ],
        { ref: 'group' }
      ),
    ]),
  };
}

/** Checkbox group inside Fieldset with optional label-scale legend. */
export function createFieldsetCheckboxGroupDemo(
  family: FieldsetDemoFamily,
  options: { legendVariant?: 'legend' | 'label' } = {}
): DemoSpec {
  const legendProps =
    options.legendVariant && family !== 'bootstrap-2-3-2' ? { variant: options.legendVariant } : {};

  return {
    type: 'demo',
    root: wrapStage(family, [
      proto(`${family}-fieldset-root`, {}, [
        proto(`${family}-fieldset-legend`, legendProps, ['Desktop items']),
        proto(`${family}-fieldset-description`, {}, [
          'Select the items you want to show on the desktop.',
        ]),
        proto(
          `${family}-checkbox-group-root`,
          {
            defaultValue: ['hard-disks', 'connected-servers'],
            ariaLabel: 'Desktop items',
          },
          [
            proto(`${family}-checkbox-group-all`, {}, ['Select all']),
            proto(`${family}-checkbox-group-item`, { value: 'hard-disks' }, ['Hard disks']),
            proto(`${family}-checkbox-group-item`, { value: 'external-disks' }, ['External disks']),
            proto(`${family}-checkbox-group-item`, { value: 'connected-servers' }, [
              'Connected servers',
            ]),
          ]
        ),
      ]),
    ]),
  };
}

/** Interactive 3-level nested Fieldset demonstrating cascading disabled policy. */
export function createFieldsetNestedDisabledDemo(family: FieldsetDemoFamily): DemoSpec {
  const buttonProps = family === 'shadcn' ? { variant: 'outline', size: 'sm' } : {};

  return {
    type: 'demo',
    root: wrapStage(
      family,
      [
        {
          kind: 'box',
          className: 'grid w-full min-w-0 gap-4',
          children: [
            {
              kind: 'box',
              className: 'flex flex-wrap items-center gap-2',
              children: [
                proto(`${family}-button`, buttonProps, ['Toggle outer disabled'], {
                  ref: 'toggleOuter',
                }),
                proto(`${family}-button`, buttonProps, ['Toggle middle disabled'], {
                  ref: 'toggleMiddle',
                }),
              ],
            },
            proto(
              `${family}-fieldset-root`,
              {},
              [
                proto(`${family}-fieldset-legend`, {}, ['Workspace Policy (Outer)']),
                proto(`${family}-fieldset-description`, {}, [
                  'Disabling an outer group cascades into every nested group and field.',
                ]),
                textField(family, 'Organization', 'Acme Corp', { defaultValue: 'Acme Corp' }),
                proto(
                  `${family}-fieldset-root`,
                  {},
                  [
                    proto(
                      `${family}-fieldset-legend`,
                      family !== 'bootstrap-2-3-2' ? { variant: 'label' } : {},
                      ['Billing Department (Middle)']
                    ),
                    textField(family, 'Billing email', 'billing@acme.dev', {
                      defaultValue: 'billing@acme.dev',
                    }),
                    proto(
                      `${family}-fieldset-root`,
                      {},
                      [
                        proto(
                          `${family}-fieldset-legend`,
                          family !== 'bootstrap-2-3-2' ? { variant: 'label' } : {},
                          ['Invoice Overrides (Inner)']
                        ),
                        textField(family, 'Purchase order', 'PO-2026-041', {
                          defaultValue: 'PO-2026-041',
                        }),
                      ],
                      { ref: 'inner' }
                    ),
                  ],
                  { ref: 'middle' }
                ),
              ],
              { ref: 'outer' }
            ),
            {
              kind: 'box',
              ref: 'status',
              className: 'text-xs text-muted-foreground',
              attrs: { role: 'status', 'aria-live': 'polite' },
              children: ['Effective disabled — Outer: false · Middle: false · Inner: false'],
            },
          ],
        },
      ],
      'max-w-md'
    ),
    setup({ api, refs }) {
      let outerDisabled = false;
      let middleDisabled = false;

      const sync = () => {
        api.setProps('outer', { disabled: outerDisabled });
        api.setProps('middle', { disabled: middleDisabled });
        const effectiveMiddle = outerDisabled || middleDisabled;
        const effectiveInner = effectiveMiddle;
        if (refs.status) {
          refs.status.textContent = `Effective disabled — Outer: ${outerDisabled} · Middle: ${effectiveMiddle} · Inner: ${effectiveInner}`;
        }
      };

      const onToggleOuter = () => {
        outerDisabled = !outerDisabled;
        sync();
      };
      const onToggleMiddle = () => {
        middleDisabled = !middleDisabled;
        sync();
      };

      refs.toggleOuter?.addEventListener('click', onToggleOuter);
      refs.toggleMiddle?.addEventListener('click', onToggleMiddle);

      return () => {
        refs.toggleOuter?.removeEventListener('click', onToggleOuter);
        refs.toggleMiddle?.removeEventListener('click', onToggleMiddle);
      };
    },
  };
}
