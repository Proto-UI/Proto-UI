import type {
  DemoChild,
  DemoNode,
  DemoSetupContext,
  DemoSpec,
} from '@/components/PrototypePreviewer/demo-types';

export type LabelExampleFamily = 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';

const LIQUID_GLASS_STAGE_CLASS = 'w-full max-w-md';
const LIQUID_GLASS_OVERVIEW_STAGE_CLASS = 'w-full max-w-xl';

function wrapFamilyStage(
  family: LabelExampleFamily,
  inner: DemoNode,
  stageClass = LIQUID_GLASS_STAGE_CLASS
): DemoNode {
  if (family !== 'liquid-glass') return inner;
  return {
    kind: 'box',
    className: stageClass,
    children: [inner],
  };
}

function proto(
  prototypeId: string,
  ref: string,
  props: Record<string, unknown> = {},
  children: DemoChild[] = [],
  key?: string,
  className?: string
): DemoNode {
  return {
    kind: 'proto',
    prototypeId,
    ref,
    props,
    children,
    ...(className ? { className } : {}),
    ...(key ? { associations: { controlLabel: key } } : {}),
  };
}

function setupStyledControlLabelOverview({ refs, api }: DemoSetupContext) {
  let active = true;
  let requests = 0;
  api.setProps('controlled', {
    checked: false,
    onCheckedChange: () => {
      if (!active) return;
      requests++;
      refs['controlled-requests'].textContent = `Requests: ${requests}`;
    },
  });
  return () => {
    active = false;
  };
}

/**
 * Styled overview recipe preserving the exact manifest prototype closure and
 * controlled-request refs without unstyled Off/On debug spans or ungrouped inputs.
 */
export function createStyledControlLabelDemo(family: LabelExampleFamily): DemoSpec {
  const labelPrototypeId = `${family}-label-root`;
  const label = (text: string, key: string, activation?: boolean) =>
    proto(
      labelPrototypeId,
      `label-${key}`,
      activation === undefined ? {} : { activation },
      [text],
      key
    );
  const row = (children: DemoChild[]): DemoNode => ({
    kind: 'box',
    className: 'flex flex-wrap items-center gap-2',
    children,
  });
  const fieldGroup = (children: DemoChild[]): DemoNode => ({
    kind: 'box',
    className: 'flex flex-col gap-2',
    children,
  });

  const stack: DemoNode = {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-4',
    children: [
      row([
        proto(
          `${family}-checkbox-root`,
          'checkbox',
          {},
          [proto(`${family}-checkbox-indicator`, 'checkbox-part')],
          'checkbox'
        ),
        label('Community updates', 'checkbox'),
      ]),
      row([
        proto(
          `${family}-switch-root`,
          'switch',
          {},
          [proto(`${family}-switch-thumb`, 'switch-part')],
          'switch'
        ),
        label('Enable notifications', 'switch'),
      ]),
      proto(
        `${family}-radio-group-root`,
        'radio',
        { defaultValue: 'email' },
        [
          row([
            proto(
              `${family}-radio-group-item`,
              'radio-email',
              { value: 'email' },
              [proto(`${family}-radio-group-indicator`, 'radio-email-part')],
              'radio-email'
            ),
            label('Email delivery', 'radio-email'),
          ]),
          row([
            proto(
              `${family}-radio-group-item`,
              'radio-push',
              { value: 'push' },
              [proto(`${family}-radio-group-indicator`, 'radio-push-part')],
              'radio-push'
            ),
            label('Push delivery', 'radio-push'),
          ]),
        ],
        undefined,
        'flex flex-col gap-2.5'
      ),
      fieldGroup([
        label('Project name', 'input'),
        proto(`${family}-input-root`, 'input', { defaultValue: 'Proto UI' }, [], 'input'),
      ]),
      fieldGroup([
        label('Project notes', 'textarea'),
        proto(
          `${family}-textarea-root`,
          'textarea',
          { defaultValue: 'Share a brief summary of your project.', rows: 3 },
          [],
          'textarea'
        ),
      ]),
      fieldGroup([
        label('Read-only project name', 'readonly-input'),
        proto(
          `${family}-input-root`,
          'readonly-input',
          { defaultValue: 'Published project', readOnly: true },
          [],
          'readonly-input'
        ),
      ]),
      fieldGroup([
        label('Read-only project notes', 'readonly-textarea'),
        proto(
          `${family}-textarea-root`,
          'readonly-textarea',
          { defaultValue: 'This note stays unchanged.', readOnly: true, rows: 2 },
          [],
          'readonly-textarea'
        ),
      ]),
      row([
        proto(
          `${family}-checkbox-root`,
          'disabled',
          { disabled: true },
          [proto(`${family}-checkbox-indicator`, 'disabled-part')],
          'disabled'
        ),
        label('Disabled option', 'disabled'),
      ]),
      row([
        proto(
          `${family}-checkbox-root`,
          'controlled',
          { checked: false },
          [proto(`${family}-checkbox-indicator`, 'controlled-part')],
          'controlled'
        ),
        label('Controlled preference', 'controlled'),
        {
          kind: 'box',
          tag: 'span',
          ref: 'controlled-requests',
          className: 'rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground',
          children: ['Requests: 0'],
        },
      ]),
      row([
        proto(
          `${family}-checkbox-root`,
          'passive',
          {},
          [proto(`${family}-checkbox-indicator`, 'passive-part')],
          'passive'
        ),
        label('Naming-only label (selectable text)', 'passive', false),
      ]),
      {
        kind: 'box',
        ref: 'description',
        className: 'text-sm text-muted-foreground',
        children: [
          'Helper descriptions remain independently selectable without activating controls.',
        ],
      },
    ],
  };

  return {
    type: 'demo',
    root: wrapFamilyStage(family, stack, LIQUID_GLASS_OVERVIEW_STAGE_CLASS),
    setup: setupStyledControlLabelOverview,
  };
}

/** Focused Checkbox + Label hero matching upstream LabelDemo. */
export function createLabelBasicDemo(family: LabelExampleFamily): DemoSpec {
  const inner: DemoNode = {
    kind: 'box',
    className: 'flex items-center gap-2',
    children: [
      proto(
        `${family}-checkbox-root`,
        'terms-checkbox',
        {},
        [proto(`${family}-checkbox-indicator`, 'terms-checkbox-indicator')],
        'terms'
      ),
      proto(`${family}-label-root`, 'terms-label', {}, ['Accept terms and conditions'], 'terms'),
    ],
  };
  return {
    type: 'demo',
    root: wrapFamilyStage(family, inner),
  };
}

/** Form composition contrasting FieldLabel with standalone Label. */
export function createLabelFieldDemo(family: LabelExampleFamily): DemoSpec {
  const inner: DemoNode = {
    kind: 'box',
    className: 'flex w-full max-w-md flex-col gap-5',
    children: [
      proto(
        `${family}-field-root`,
        'email-field-root',
        { required: true, validationMode: 'onBlur' },
        [
          proto(`${family}-field-label`, 'email-field-label', {}, ['Email address']),
          proto(`${family}-field-control`, 'email-field-control', {
            placeholder: 'name@example.com',
          }),
          proto(`${family}-field-description`, 'email-field-description', {}, [
            'We will use this address for account security notices.',
          ]),
          proto(`${family}-field-error`, 'email-field-error'),
        ]
      ),
      proto(`${family}-field-root`, 'name-field-root', {}, [
        proto(`${family}-field-label`, 'name-field-label', {}, ['Display name']),
        proto(`${family}-field-control`, 'name-field-control', {
          defaultValue: 'Alex Chen',
        }),
        proto(`${family}-field-description`, 'name-field-description', {}, [
          'Shown alongside your comments and reviews.',
        ]),
      ]),
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          proto(
            `${family}-checkbox-root`,
            'updates-checkbox',
            { defaultChecked: true },
            [proto(`${family}-checkbox-indicator`, 'updates-checkbox-indicator')],
            'updates'
          ),
          proto(
            `${family}-label-root`,
            'updates-label',
            {},
            ['Send me product release notes'],
            'updates'
          ),
        ],
      },
    ],
  };
  return {
    type: 'demo',
    root: wrapFamilyStage(family, inner),
  };
}

/** Demonstrates independent naming, activation, and text-selection policies. */
export function createLabelModesDemo(family: LabelExampleFamily): DemoSpec {
  const secondaryLabelProps: Record<string, unknown> =
    family === 'liquid-glass' ? { naming: false, tone: 'secondary' } : { naming: false };
  const inner: DemoNode = {
    kind: 'box',
    className: 'flex w-full max-w-md flex-col gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          proto(
            `${family}-checkbox-root`,
            'copyable-checkbox',
            {},
            [proto(`${family}-checkbox-indicator`, 'copyable-checkbox-indicator')],
            'copyable'
          ),
          proto(
            `${family}-label-root`,
            'copyable-label',
            { selection: 'text' },
            ['Weekly digest (clickable and selectable)'],
            'copyable'
          ),
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          proto(
            `${family}-checkbox-root`,
            'naming-only-checkbox',
            {},
            [proto(`${family}-checkbox-indicator`, 'naming-only-checkbox-indicator')],
            'naming-only'
          ),
          proto(
            `${family}-label-root`,
            'naming-only-label',
            { activation: false },
            ['Release policy notice (naming only)'],
            'naming-only'
          ),
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          proto(
            `${family}-label-root`,
            'activation-only-label',
            secondaryLabelProps,
            ['Quick filter (activation only)'],
            'activation-only'
          ),
          proto(
            `${family}-input-root`,
            'activation-only-input',
            {
              ariaLabel: 'Filter workspace items',
              placeholder: 'Filter workspace items...',
            },
            [],
            'activation-only'
          ),
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          proto(
            `${family}-checkbox-root`,
            'unavailable-checkbox',
            { disabled: true },
            [proto(`${family}-checkbox-indicator`, 'unavailable-checkbox-indicator')],
            'unavailable'
          ),
          proto(
            `${family}-label-root`,
            'unavailable-label',
            {},
            ['Unavailable option'],
            'unavailable'
          ),
        ],
      },
    ],
  };
  return {
    type: 'demo',
    root: wrapFamilyStage(family, inner),
  };
}

/** Right-to-left (RTL) Checkbox and Input pairing matching upstream LabelRtl. */
export function createLabelRtlDemo(family: LabelExampleFamily): DemoSpec {
  const inner: DemoNode = {
    kind: 'box',
    attrs: { dir: 'rtl' },
    className: 'flex w-full max-w-sm flex-col gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          proto(
            `${family}-checkbox-root`,
            'rtl-terms-checkbox',
            {},
            [proto(`${family}-checkbox-indicator`, 'rtl-terms-checkbox-indicator')],
            'rtl-terms'
          ),
          proto(
            `${family}-label-root`,
            'rtl-terms-label',
            {},
            ['قبول الشروط والأحكام'],
            'rtl-terms'
          ),
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          proto(`${family}-label-root`, 'rtl-email-label', {}, ['البريد الإلكتروني'], 'rtl-email'),
          proto(
            `${family}-input-root`,
            'rtl-email-input',
            { placeholder: 'name@example.com' },
            [],
            'rtl-email'
          ),
        ],
      },
    ],
  };
  return {
    type: 'demo',
    root: wrapFamilyStage(family, inner),
  };
}
