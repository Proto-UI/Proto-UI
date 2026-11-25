import type { DemoChild, DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import type { FieldValidationRequest } from '@proto.ui/prototypes-base/field';

type ProtoNode = Extract<DemoNode, { kind: 'proto' }>;

function helpers(family: string) {
  const atom = (
    role: string,
    ref: string,
    props: Record<string, unknown> = {},
    children: DemoChild[] = []
  ): ProtoNode => ({
    kind: 'proto',
    prototypeId: `${family}-field-${role}`,
    ref,
    props,
    children,
  });

  const part = (
    role: string,
    ref: string,
    props: Record<string, unknown> = {},
    children: DemoChild[] = []
  ): ProtoNode => ({
    kind: 'proto',
    prototypeId: `${family}-${role}`,
    ref,
    props,
    children,
  });

  const wrap = (content: DemoNode): DemoNode =>
    family === 'liquid-glass'
      ? {
          kind: 'box',
          className: 'flex w-full justify-center',
          children: [
            {
              kind: 'box',
              className: 'w-full max-w-sm',
              children: [content],
            },
          ],
        }
      : {
          kind: 'box',
          className: 'flex w-full justify-center p-2',
          children: [{ kind: 'box', className: 'w-full max-w-sm', children: [content] }],
        };

  return { atom, part, wrap };
}

/** Input fields with helper text positioned below and above the editor. */
export function createFieldInputDemo(family: string): DemoSpec {
  const { atom, wrap } = helpers(family);
  return {
    type: 'demo',
    root: wrap({
      kind: 'box',
      className: 'grid gap-5',
      children: [
        atom('root', 'usernameRoot', { required: true }, [
          atom('label', 'usernameLabel', {}, ['Username']),
          atom('control', 'usernameControl', { placeholder: 'Max Leiter' }),
          atom('description', 'usernameDescription', {}, [
            'Choose a unique username for your account.',
          ]),
          atom('error', 'usernameError'),
        ]),
        atom('root', 'apiKeyRoot', { required: true, minLength: 8 }, [
          atom('label', 'apiKeyLabel', {}, ['Workspace token']),
          atom('description', 'apiKeyDescription', {}, ['Must be at least 8 characters long.']),
          atom('control', 'apiKeyControl', { placeholder: 'pui_live_••••••••' }),
          atom('error', 'apiKeyError'),
        ]),
      ],
    }),
  };
}

/** Multiline feedback textarea bound to Field validation. */
export function createFieldTextareaDemo(family: string): DemoSpec {
  const { atom, wrap } = helpers(family);
  return {
    type: 'demo',
    root: wrap(
      atom('root', 'feedbackRoot', { required: true, minLength: 10 }, [
        atom('label', 'feedbackLabel', {}, ['Feedback']),
        atom('textarea', 'feedbackControl', {
          rows: 4,
          placeholder: 'Your feedback helps us improve...',
        }),
        atom('description', 'feedbackDescription', {}, ['Share your thoughts about our service.']),
        atom('error', 'feedbackError'),
      ])
    ),
  };
}

/** Select trigger bound to Field labeling and validation. */
export function createFieldSelectDemo(family: string): DemoSpec {
  const { atom, part, wrap } = helpers(family);
  const departments = [
    ['engineering', 'Engineering'],
    ['design', 'Design'],
    ['marketing', 'Marketing'],
    ['support', 'Customer Support'],
    ['operations', 'Operations'],
  ] as const;

  return {
    type: 'demo',
    root: wrap(
      atom('root', 'deptRoot', { required: true }, [
        atom('label', 'deptLabel', {}, ['Department']),
        part('select-root', 'deptSelect', { defaultValue: 'engineering' }, [
          atom('select-trigger', 'deptTrigger', {}, [
            part('select-value', 'deptValue', { placeholder: 'Choose department' }),
          ]),
          part('select-content', 'deptContent', {}, [
            part('select-surface', 'deptSurface', {}, [
              part('select-viewport', 'deptViewport', {}, [
                part('select-group', 'deptGroup', {}, [
                  part('select-label', 'deptGroupLabel', {}, ['Departments']),
                  ...departments.map(([value, label]) =>
                    part('select-item', `dept-${value}`, { value, textValue: label }, [
                      part('select-item-text', `dept-${value}-text`, {}, [label]),
                    ])
                  ),
                ]),
              ]),
            ]),
          ]),
        ]),
        atom('description', 'deptDescription', {}, [
          'Select your department or primary area of work.',
        ]),
        atom('error', 'deptError'),
      ])
    ),
  };
}

/** Checkbox, RadioGroup, and Switch controls bound to Field (Shadcn / Brutalist). */
export function createFieldChoiceDemo(family: string): DemoSpec {
  const { atom, part, wrap } = helpers(family);
  const radioOption = (value: string, text: string): DemoNode => ({
    kind: 'box',
    className: 'flex items-center gap-2.5',
    children: [
      {
        ...part('radio-group-item', `plan-${value}`, { value }, [
          part('radio-group-indicator', `plan-${value}-indicator`),
        ]),
        associations: { controlLabel: `${family}-choice-plan-${value}` },
      },
      {
        ...part('label-root', `plan-${value}-label`, {}, [text]),
        associations: { controlLabel: `${family}-choice-plan-${value}` },
      },
    ],
  });

  return {
    type: 'demo',
    root: wrap({
      kind: 'box',
      className: 'grid gap-6',
      children: [
        atom('root', 'planRoot', { required: true }, [
          atom('label', 'planLabel', {}, ['Subscription plan']),
          atom('description', 'planDescription', {}, [
            'Yearly and team plans include priority support.',
          ]),
          atom('radio-group', 'planGroup', { defaultValue: 'pro' }, [
            radioOption('free', 'Free ($0/month)'),
            radioOption('pro', 'Pro ($12/month)'),
            radioOption('team', 'Team ($29/seat)'),
          ]),
          atom('error', 'planError'),
        ]),
        atom('root', 'syncRoot', { orientation: 'horizontal' }, [
          atom('label', 'syncLabel', {}, ['Sync desktop & documents']),
          atom('checkbox', 'syncCheckbox', { defaultChecked: true }, [
            part('checkbox-indicator', 'syncIndicator'),
          ]),
        ]),
        atom('root', 'twoFactorRoot', { orientation: 'horizontal' }, [
          atom('label', 'twoFactorLabel', {}, ['Multi-factor authentication']),
          atom('switch', 'twoFactorSwitch', { defaultChecked: true }, [
            part('switch-thumb', 'twoFactorThumb'),
          ]),
        ]),
      ],
    }),
  };
}

/** Validation states: built-in rules, async availability check, read-only, and disabled. */
export function createFieldValidationDemo(family: string): DemoSpec {
  const { atom, part, wrap } = helpers(family);
  return {
    type: 'demo',
    root: wrap({
      kind: 'box',
      className: 'grid gap-5',
      children: [
        atom('root', 'valUserRoot', { required: true, minLength: 4, validationMode: 'onBlur' }, [
          atom('label', 'valUserLabel', {}, ['Username']),
          atom('control', 'valUserControl', { placeholder: 'At least 4 characters' }),
          atom('description', 'valUserDescription', {}, ['Validated automatically on blur.']),
          atom('error', 'valUserError'),
        ]),
        atom('root', 'valAsyncRoot', { externalValidation: true, validationMode: 'onChange' }, [
          atom('label', 'valAsyncLabel', {}, ['Subdomain']),
          atom('control', 'valAsyncControl', {
            defaultValue: 'studio',
            placeholder: 'Try "taken"',
          }),
          atom('description', 'valAsyncDescription', {}, [
            'Type "taken" to trigger an async availability error.',
          ]),
          atom('error', 'valAsyncError'),
        ]),
        {
          kind: 'box',
          className: 'flex flex-wrap gap-2',
          children: [
            part('button', 'valSubmit', {}, ['Validate']),
            part('button', 'valReset', family === 'shadcn' ? { variant: 'outline' } : {}, [
              'Reset',
            ]),
          ],
        },
      ],
    }),
    setup({ api }) {
      let alive = true;
      const timers = new Set<ReturnType<typeof setTimeout>>();

      const onRequest = (request: FieldValidationRequest) => {
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (!alive) return;
          const taken = request.value === 'taken';
          api.call('valAsyncRoot', 'resolveValidation', request.requestId, {
            invalid: taken,
            errors: taken ? ['This subdomain is already reserved.'] : [],
          });
        }, 350);
        timers.add(timer);
      };

      api.setProps('valAsyncRoot', {
        externalValidation: true,
        validationMode: 'onChange',
        onValidationRequest: onRequest,
      });
      api.setProps('valSubmit', {
        onClick: () => {
          api.call('valUserRoot', 'validate');
          api.call('valAsyncRoot', 'validate');
        },
      });
      api.setProps('valReset', {
        onClick: () => {
          api.call('valUserRoot', 'resetValidation');
          api.call('valAsyncRoot', 'resetValidation');
        },
      });

      return () => {
        alive = false;
        for (const timer of timers) clearTimeout(timer);
      };
    },
  };
}

/** Contact form matching neobrutalism.dev/docs/field Default example. */
export function createBrutalistContactDemo(): DemoSpec {
  const { atom, part, wrap } = helpers('brutalist');
  return {
    type: 'demo',
    root: wrap({
      kind: 'box',
      className: 'grid gap-4',
      children: [
        atom('root', 'contactNameRoot', { required: true }, [
          atom('label', 'contactNameLabel', {}, ['Name']),
          atom('control', 'contactNameControl', { placeholder: 'Jane Doe' }),
          atom('error', 'contactNameError'),
        ]),
        atom('root', 'contactEmailRoot', { required: true }, [
          atom('label', 'contactEmailLabel', {}, ['Email']),
          atom('control', 'contactEmailControl', {
            inputMode: 'email',
            placeholder: 'jane@example.com',
          }),
          atom('description', 'contactEmailDescription', {}, [
            'We will never share your email with anyone.',
          ]),
          atom('error', 'contactEmailError'),
        ]),
        atom('root', 'contactMsgRoot', { required: true }, [
          atom('label', 'contactMsgLabel', {}, ['Message']),
          atom('textarea', 'contactMsgControl', {
            rows: 3,
            placeholder: 'Tell us about your project...',
          }),
          atom('error', 'contactMsgError'),
        ]),
        {
          kind: 'box',
          className: 'flex flex-wrap gap-2 pt-1',
          children: [
            part('button', 'contactSend', {}, ['Send message']),
            part('button', 'contactCancel', { variant: 'neutral' }, ['Cancel']),
          ],
        },
      ],
    }),
    setup({ api }) {
      api.setProps('contactSend', {
        onClick: () => {
          api.call('contactNameRoot', 'validate');
          api.call('contactEmailRoot', 'validate');
          api.call('contactMsgRoot', 'validate');
        },
      });
      api.setProps('contactCancel', {
        onClick: () => {
          api.call('contactNameRoot', 'resetValidation');
          api.call('contactEmailRoot', 'resetValidation');
          api.call('contactMsgRoot', 'resetValidation');
        },
      });
    },
  };
}

/** Horizontal switch and checkbox rows matching neobrutalism.dev / Apple Settings layout. */
export function createHorizontalSwitchesDemo(family: 'brutalist' | 'liquid-glass'): DemoSpec {
  const { atom, part, wrap } = helpers(family);
  return {
    type: 'demo',
    root: wrap({
      kind: 'box',
      className: 'grid gap-4',
      children: [
        atom('root', 'airplaneRoot', { orientation: 'horizontal' }, [
          atom('label', 'airplaneLabel', {}, ['Airplane Mode']),
          atom('switch', 'airplaneSwitch', { defaultChecked: false }, [
            part('switch-thumb', 'airplaneThumb'),
          ]),
        ]),
        atom('root', 'digestRoot', { orientation: 'horizontal' }, [
          atom('label', 'digestLabel', {}, ['Receive weekly product updates']),
          ...(family === 'brutalist'
            ? [
                atom('checkbox', 'digestCheckbox', { defaultChecked: true }, [
                  part('checkbox-indicator', 'digestIndicator'),
                ]),
              ]
            : [
                atom('switch', 'digestSwitch', { defaultChecked: true }, [
                  part('switch-thumb', 'digestThumb'),
                ]),
              ]),
        ]),
      ],
    }),
  };
}

/** Pre-populated error state matching neobrutalism.dev With Error example. */
export function createBrutalistErrorDemo(): DemoSpec {
  const { atom, wrap } = helpers('brutalist');
  return {
    type: 'demo',
    root: wrap(
      atom(
        'root',
        'errUserRoot',
        {
          required: true,
          minLength: 3,
          defaultInvalid: true,
          defaultErrors: ['Username must be at least 3 characters.'],
          validationMode: 'onChange',
        },
        [
          atom('label', 'errUserLabel', {}, ['Username']),
          atom('control', 'errUserControl', { defaultValue: 'ab', placeholder: 'Pick a username' }),
          atom('description', 'errUserDescription', {}, ['Pick a unique username.']),
          atom('error', 'errUserError'),
        ]
      )
    ),
  };
}
