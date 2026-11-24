import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

type DemoProtoNode = Extract<DemoNode, { kind: 'proto' }>;

function makeAtom(family: string) {
  return (
    name: string,
    part: string,
    props: Record<string, unknown> = {},
    children: DemoProtoNode['children'] = [],
    ref?: string
  ): DemoProtoNode => ({
    kind: 'proto',
    prototypeId: `${family}-${name}${part ? `-${part}` : ''}`,
    props,
    children,
    ref,
  });
}

function wrapBackdrop(family: string, content: DemoNode): DemoNode {
  if (family === 'liquid-glass') {
    return {
      kind: 'box',
      className:
        'flex w-full justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
      children: [
        {
          kind: 'box',
          className:
            'grid w-full max-w-md min-w-0 gap-4 rounded-2xl border border-border bg-background/85 p-5',
          children: [content],
        },
      ],
    };
  }
  return {
    kind: 'box',
    className: 'grid w-full max-w-md min-w-0 gap-4 p-4',
    children: [content],
  };
}

/** Focused profile form with Input + Textarea + Fieldset + Submit/Reset. */
export function createFormProfileDemo(family: string): DemoSpec {
  const atom = makeAtom(family);
  const actionRowClass =
    family === 'bootstrap-2-3-2'
      ? 'flex flex-wrap items-center gap-2 border-t border-border pt-3 mt-2'
      : 'flex flex-wrap items-center gap-2 pt-1';

  return {
    type: 'demo',
    root: wrapBackdrop(family, {
      kind: 'box',
      className: 'grid w-full min-w-0 gap-4',
      children: [
        atom(
          'form',
          'root',
          { ariaLabel: 'Profile settings' },
          [
            atom('fieldset', 'root', {}, [
              atom('fieldset', 'legend', {}, ['Profile']),
              atom('fieldset', 'description', {}, [
                'This information appears on your public profile and invoices.',
              ]),
              atom('form', 'field', { name: 'username', required: true }, [
                atom('field', 'label', {}, ['Username']),
                atom('field', 'control', { placeholder: 'ada_lovelace' }),
                atom('field', 'description', {}, ['Choose a unique username for your account.']),
                atom('field', 'error'),
              ]),
              atom('form', 'field', { name: 'bio' }, [
                atom('field', 'label', {}, ['Bio']),
                atom('field', 'textarea', {
                  placeholder: 'Tell us a little about yourself...',
                  rows: 3,
                }),
                atom('field', 'description', {}, ['Keep it brief and informative.']),
              ]),
            ]),
            {
              kind: 'box',
              className: actionRowClass,
              children: [
                atom('form', 'submit', {}, ['Save profile']),
                atom('form', 'reset', family === 'shadcn' ? { variant: 'outline' } : {}, ['Reset']),
              ],
            },
          ],
          'form'
        ),
        {
          kind: 'box',
          ref: 'status',
          className: 'text-xs text-muted-foreground',
          children: ['Enter a username and click Save profile.'],
        },
      ],
    }),
    setup({ api, refs }) {
      api.setProps('form', {
        onSubmit: (detail: { values: unknown }) => {
          refs.status.textContent = `Saved: ${JSON.stringify(detail.values)}`;
        },
        onInvalid: (detail: { names: string[] }) => {
          refs.status.textContent = `Required field missing: ${detail.names.join(', ')}`;
        },
        onReset: () => {
          refs.status.textContent = 'Profile form reset.';
        },
      });
    },
  };
}

/** Focused disabled fieldset & form cascading example. */
export function createFormDisabledDemo(family: string): DemoSpec {
  const atom = makeAtom(family);
  return {
    type: 'demo',
    root: wrapBackdrop(family, {
      kind: 'box',
      className: 'grid w-full min-w-0 gap-4',
      children: [
        atom(
          'form',
          'root',
          { ariaLabel: 'Billing form' },
          [
            atom('form', 'field', { name: 'email', required: true }, [
              atom('field', 'label', {}, ['Contact email']),
              atom('field', 'control', { defaultValue: 'ada@example.com' }),
              atom('field', 'error'),
            ]),
            atom(
              'fieldset',
              'root',
              { disabled: true },
              [
                atom('fieldset', 'legend', {}, ['Billing details']),
                atom('fieldset', 'description', {}, [
                  'Disabled fieldsets are automatically excluded from submitted payloads.',
                ]),
                atom('form', 'field', { name: 'company' }, [
                  atom('field', 'label', {}, ['Company']),
                  atom('field', 'control', { defaultValue: 'Analytical Engine Co.' }),
                ]),
              ],
              'billingGroup'
            ),
            {
              kind: 'box',
              className: 'flex flex-wrap items-center gap-2 pt-1',
              children: [
                atom('form', 'submit', {}, ['Submit']),
                atom('form', 'reset', family === 'shadcn' ? { variant: 'outline' } : {}, ['Reset']),
                atom(
                  'button',
                  '',
                  family === 'shadcn'
                    ? { variant: 'ghost', size: 'sm' }
                    : family === 'liquid-glass'
                      ? { material: 'opaque' }
                      : {},
                  ['Enable billing'],
                  'toggleBilling'
                ),
              ],
            },
          ],
          'form'
        ),
        {
          kind: 'box',
          ref: 'status',
          className: 'text-xs text-muted-foreground',
          children: ['Billing details are disabled and omitted from submit values.'],
        },
      ],
    }),
    setup({ api, refs }) {
      let billingDisabled = true;
      api.setProps('toggleBilling', {
        onClick: () => {
          billingDisabled = !billingDisabled;
          api.setProps('billingGroup', { disabled: billingDisabled });
          refs.toggleBilling.textContent = billingDisabled ? 'Enable billing' : 'Disable billing';
          refs.status.textContent = billingDisabled
            ? 'Billing details disabled — excluded on submit.'
            : 'Billing details enabled — included on submit.';
        },
      });
      api.setProps('form', {
        onSubmit: (detail: { values: unknown }) => {
          refs.status.textContent = `Submitted: ${JSON.stringify(detail.values)}`;
        },
        onReset: () => {
          refs.status.textContent = 'Form reset.';
        },
      });
    },
  };
}

/** Focused Brutalist Bug Report form matching neobrutalism.dev/docs/form. */
export function createBrutalistBugReportDemo(): DemoSpec {
  const atom = makeAtom('brutalist');
  return {
    type: 'demo',
    root: wrapBackdrop('brutalist', {
      kind: 'box',
      className: 'grid w-full min-w-0 gap-4',
      children: [
        atom(
          'form',
          'root',
          { ariaLabel: 'Bug report form' },
          [
            atom('fieldset', 'root', {}, [
              atom('fieldset', 'legend', {}, ['Bug Report']),
              atom('fieldset', 'description', {}, [
                'Help us improve by reporting issues you encounter.',
              ]),
              atom('form', 'field', { name: 'title', required: true }, [
                atom('field', 'label', {}, ['Bug title']),
                atom('field', 'control', { placeholder: 'Submit button alignment in narrow card' }),
                atom('field', 'error'),
              ]),
              atom('form', 'field', { name: 'description', required: true }, [
                atom('field', 'label', {}, ['Description']),
                atom('field', 'textarea', {
                  placeholder: 'Include steps to reproduce and expected behavior.',
                  rows: 3,
                }),
                atom('field', 'error'),
              ]),
              atom('form', 'field', { name: 'areas' }, [
                atom('field', 'label', {}, ['Affected areas']),
                atom('checkbox-group', 'root', { defaultValue: ['ui'] }, [
                  atom('checkbox-group', 'item', { value: 'ui' }, ['UI & Layout']),
                  atom('checkbox-group', 'item', { value: 'keyboard' }, ['Keyboard & Focus']),
                  atom('checkbox-group', 'item', { value: 'validation' }, ['Validation']),
                ]),
              ]),
            ]),
            {
              kind: 'box',
              className: 'flex flex-wrap items-center gap-2 pt-1',
              children: [
                atom('form', 'submit', {}, ['Submit report']),
                atom('form', 'reset', {}, ['Reset']),
              ],
            },
          ],
          'form'
        ),
        {
          kind: 'box',
          ref: 'status',
          className: 'text-xs text-muted-foreground',
          children: ['Complete the required fields and submit your report.'],
        },
      ],
    }),
    setup({ api, refs }) {
      api.setProps('form', {
        onSubmit: (detail: { values: unknown }) => {
          refs.status.textContent = `Report submitted: ${JSON.stringify(detail.values)}`;
        },
        onInvalid: (detail: { names: string[] }) => {
          refs.status.textContent = `Missing required fields: ${detail.names.join(', ')}`;
        },
        onReset: () => {
          refs.status.textContent = 'Bug report cleared.';
        },
      });
    },
  };
}

/** Focused Shadcn FormSubmit & FormReset action variants & sizes demo. */
export function createShadcnFormActionsDemo(): DemoSpec {
  const atom = makeAtom('shadcn');
  return {
    type: 'demo',
    root: wrapBackdrop('shadcn', {
      kind: 'box',
      className: 'grid w-full min-w-0 gap-5',
      children: [
        atom(
          'form',
          'root',
          { ariaLabel: 'Action variants form' },
          [
            atom('form', 'field', { name: 'project', required: true }, [
              atom('field', 'label', {}, ['Project name']),
              atom('field', 'control', { defaultValue: 'proto-ui-docs' }),
              atom('field', 'error'),
            ]),
            {
              kind: 'box',
              className: 'grid gap-3',
              children: [
                {
                  kind: 'box',
                  className: 'text-xs font-medium text-muted-foreground',
                  children: ['Default + Outline Reset'],
                },
                {
                  kind: 'box',
                  className: 'flex flex-wrap items-center gap-2',
                  children: [
                    atom('form', 'submit', { variant: 'default' }, ['Save']),
                    atom('form', 'reset', { variant: 'outline' }, ['Reset']),
                  ],
                },
                {
                  kind: 'box',
                  className: 'text-xs font-medium text-muted-foreground',
                  children: ['Compact (sm) + Destructive / Ghost'],
                },
                {
                  kind: 'box',
                  className: 'flex flex-wrap items-center gap-2',
                  children: [
                    atom('form', 'submit', { variant: 'destructive', size: 'sm' }, ['Delete']),
                    atom('form', 'reset', { variant: 'ghost', size: 'sm' }, ['Cancel']),
                  ],
                },
              ],
            },
          ],
          'form'
        ),
        {
          kind: 'box',
          ref: 'status',
          className: 'text-xs text-muted-foreground',
          children: ['Try submitting or resetting with any action variant above.'],
        },
      ],
    }),
    setup({ api, refs }) {
      api.setProps('form', {
        onSubmit: (detail: { values: unknown }) => {
          refs.status.textContent = `Submitted: ${JSON.stringify(detail.values)}`;
        },
        onReset: () => {
          refs.status.textContent = 'Form reset.';
        },
      });
    },
  };
}

/** Focused Bootstrap 2.3.2 classic action tones (.form-actions). */
export function createBootstrapFormActionsDemo(): DemoSpec {
  const atom = makeAtom('bootstrap-2-3-2');
  return {
    type: 'demo',
    root: wrapBackdrop('bootstrap-2-3-2', {
      kind: 'box',
      className: 'grid w-full min-w-0 gap-4',
      children: [
        atom(
          'form',
          'root',
          { ariaLabel: 'Deployment settings' },
          [
            atom('fieldset', 'root', {}, [
              atom('fieldset', 'legend', {}, ['Deployment actions']),
              atom('form', 'field', { name: 'environment', required: true }, [
                atom('field', 'label', {}, ['Target environment']),
                atom('field', 'control', { defaultValue: 'production' }),
                atom('field', 'error'),
              ]),
            ]),
            {
              kind: 'box',
              className: 'flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 p-3',
              children: [
                atom('form', 'submit', { variant: 'primary' }, ['Save changes']),
                atom('form', 'submit', { variant: 'danger' }, ['Purge cache']),
                atom('form', 'reset', { variant: 'default' }, ['Cancel']),
              ],
            },
          ],
          'form'
        ),
        {
          kind: 'box',
          ref: 'status',
          className: 'text-xs text-muted-foreground',
          children: ['Use primary, danger, or default Bootstrap 2.3.2 form actions.'],
        },
      ],
    }),
    setup({ api, refs }) {
      api.setProps('form', {
        onSubmit: (detail: { values: unknown }) => {
          refs.status.textContent = `Submitted: ${JSON.stringify(detail.values)}`;
        },
        onReset: () => {
          refs.status.textContent = 'Form reset.';
        },
      });
    },
  };
}

/** Focused Liquid Glass HIG material='auto' vs material='opaque' & prominence hierarchy. */
export function createLiquidGlassFormMaterialDemo(): DemoSpec {
  const atom = makeAtom('liquid-glass');
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className:
        'grid w-full gap-6 rounded-2xl bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-fuchsia-500/25 p-6',
      children: [
        {
          kind: 'box',
          className:
            'grid w-full max-w-md mx-auto min-w-0 gap-5 rounded-2xl border border-border bg-background/85 p-5',
          children: [
            atom(
              'form',
              'root',
              { ariaLabel: 'Liquid Glass material hierarchy form' },
              [
                atom('form', 'field', { name: 'workspace', required: true }, [
                  atom('field', 'label', {}, ['Workspace name']),
                  atom('field', 'control', { defaultValue: 'Design Systems' }),
                  atom('field', 'description', {}, [
                    'Form fields stay on a readable content surface; reserve glass for floating actions.',
                  ]),
                  atom('field', 'error'),
                ]),
                {
                  kind: 'box',
                  className: 'grid gap-3',
                  children: [
                    {
                      kind: 'box',
                      className: 'text-xs font-medium text-muted-foreground',
                      children: ['material="auto" — Prominent tinted glass + Regular glass'],
                    },
                    {
                      kind: 'box',
                      className: 'flex flex-wrap items-center gap-2',
                      children: [
                        atom('form', 'submit', { variant: 'prominent', material: 'auto' }, [
                          'Save workspace',
                        ]),
                        atom('form', 'reset', { variant: 'regular', material: 'auto' }, ['Reset']),
                      ],
                    },
                    {
                      kind: 'box',
                      className: 'text-xs font-medium text-muted-foreground',
                      children: [
                        'material="opaque" — Avoid glass-on-glass inside translucent sheets',
                      ],
                    },
                    {
                      kind: 'box',
                      className: 'flex flex-wrap items-center gap-2',
                      children: [
                        atom('form', 'submit', { variant: 'destructive', material: 'opaque' }, [
                          'Archive',
                        ]),
                        atom('form', 'reset', { variant: 'regular', material: 'opaque' }, [
                          'Cancel',
                        ]),
                      ],
                    },
                  ],
                },
              ],
              'form'
            ),
            {
              kind: 'box',
              ref: 'status',
              className: 'text-xs text-muted-foreground',
              children: ['Compare floating glass controls against opaque sheet controls.'],
            },
          ],
        },
      ],
    },
    setup({ api, refs }) {
      api.setProps('form', {
        onSubmit: (detail: { values: unknown }) => {
          refs.status.textContent = `Submitted: ${JSON.stringify(detail.values)}`;
        },
        onReset: () => {
          refs.status.textContent = 'Workspace form reset.';
        },
      });
    },
  };
}
