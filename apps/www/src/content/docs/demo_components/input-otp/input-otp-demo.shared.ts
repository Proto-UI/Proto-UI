import type {
  DemoChild,
  DemoNode,
  DemoSetupContext,
  DemoSpec,
} from '@/components/PrototypePreviewer/demo-types';

export type InputOtpDemoFamily = 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';

type DemoProtoNode = Extract<DemoNode, { kind: 'proto' }>;

function part(
  family: InputOtpDemoFamily,
  role: 'root' | 'input' | 'control' | 'slot' | 'separator',
  props: Record<string, unknown> = {},
  children: DemoChild[] = [],
  ref?: string
): DemoProtoNode {
  return {
    kind: 'proto',
    prototypeId: `${family}-input-otp-${role}`,
    ...(ref ? { ref } : {}),
    props,
    children,
  };
}

function slotGroup(
  family: InputOtpDemoFamily,
  indices: readonly number[],
  extraProps: Record<string, unknown> = {}
): DemoNode {
  const isShadcn = family === 'shadcn';
  return {
    kind: 'box',
    className: isShadcn ? 'inline-flex items-center' : 'inline-flex items-center gap-1.5',
    children: indices.map((index, pos) =>
      part(family, 'slot', {
        index,
        ...(isShadcn ? { first: pos === 0, last: pos === indices.length - 1 } : {}),
        ...extraProps,
      })
    ),
  };
}

function separator(family: InputOtpDemoFamily): DemoProtoNode {
  return part(family, 'separator', {}, ['–']);
}

function wrapStage(family: InputOtpDemoFamily, children: DemoChild[]): DemoNode {
  const inner: DemoNode = {
    kind: 'box',
    className:
      family === 'liquid-glass'
        ? 'grid w-full min-w-0 max-w-md gap-3'
        : 'grid w-full min-w-0 max-w-md gap-3 p-4',
    children,
  };
  if (family !== 'liquid-glass') return inner;
  return {
    kind: 'box',
    className: 'flex w-full min-w-0 items-center justify-center',
    children: [inner],
  };
}

function helperTextClass(family: InputOtpDemoFamily): string {
  if (family === 'bootstrap-2-3-2') return 'text-[13px] leading-[18px] text-[#666]';
  if (family === 'brutalist') return 'text-sm font-sans font-medium opacity-80';
  return 'text-sm text-muted-foreground';
}

export function createInputOtpHeroDemo(family: InputOtpDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapStage(family, [
      part(
        family,
        'root',
        {
          defaultValue: '123456',
          length: 6,
          ariaLabel: 'One-time verification code',
        },
        [part(family, 'input', { placeholder: '123456' }), slotGroup(family, [0, 1, 2, 3, 4, 5])],
        'control'
      ),
    ]),
  };
}

export function createInputOtpSeparatorDemo(family: InputOtpDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapStage(family, [
      part(
        family,
        'root',
        {
          defaultValue: '429183',
          length: 6,
          ariaLabel: 'Verification code with separators',
        },
        [
          part(family, 'input', { placeholder: '429183' }),
          slotGroup(family, [0, 1]),
          separator(family),
          slotGroup(family, [2, 3]),
          separator(family),
          slotGroup(family, [4, 5]),
        ],
        'otpSeparatorRoot'
      ),
    ]),
  };
}

export function createInputOtpAlphanumericDemo(family: InputOtpDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapStage(family, [
      part(
        family,
        'root',
        {
          length: 6,
          pattern: 'alphanumeric',
          ariaLabel: 'Alphanumeric security code',
        },
        [
          part(family, 'input', { placeholder: 'A1B2C3' }),
          slotGroup(family, [0, 1, 2]),
          separator(family),
          slotGroup(family, [3, 4, 5]),
        ],
        'otpAlphanumericRoot'
      ),
    ]),
  };
}

export function createInputOtpDisabledDemo(family: InputOtpDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapStage(family, [
      part(
        family,
        'root',
        {
          defaultValue: '123456',
          length: 6,
          disabled: true,
          ariaLabel: 'Disabled verification code',
        },
        [
          part(family, 'input', { placeholder: '123456' }),
          slotGroup(family, [0, 1, 2]),
          separator(family),
          slotGroup(family, [3, 4, 5]),
        ],
        'otpDisabledRoot'
      ),
    ]),
  };
}

export function createInputOtpInvalidDemo(family: InputOtpDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapStage(family, [
      part(
        family,
        'root',
        {
          defaultValue: '000000',
          length: 6,
          invalid: true,
          ariaLabel: 'Invalid verification code',
        },
        [
          part(family, 'input', { placeholder: '000000' }),
          slotGroup(family, [0, 1], { invalid: true }),
          separator(family),
          slotGroup(family, [2, 3], { invalid: true }),
          separator(family),
          slotGroup(family, [4, 5], { invalid: true }),
        ],
        'otpInvalidRoot'
      ),
    ]),
  };
}

export function createInputOtpControlledDemo(family: InputOtpDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapStage(family, [
      part(
        family,
        'root',
        {
          value: '',
          length: 6,
          ariaLabel: 'Controlled verification code',
        },
        [part(family, 'input', { placeholder: '000000' }), slotGroup(family, [0, 1, 2, 3, 4, 5])],
        'otpControlledRoot'
      ),
      {
        kind: 'box',
        ref: 'controlledStatus',
        className: helperTextClass(family),
        attrs: { 'aria-live': 'polite' },
        children: ['Enter your one-time password.'],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: `${family}-button`,
            ref: 'fillSampleBtn',
            props: family === 'shadcn' ? { variant: 'outline', size: 'sm' } : {},
            children: ['Fill 482910'],
          },
          {
            kind: 'proto',
            prototypeId: `${family}-button`,
            ref: 'clearBtn',
            props: family === 'shadcn' ? { variant: 'ghost', size: 'sm' } : {},
            children: ['Clear'],
          },
        ],
      },
    ]),
    setup({ refs, api }: DemoSetupContext) {
      const renderStatus = (val: string) => {
        if (!refs.controlledStatus) return;
        refs.controlledStatus.textContent =
          val === ''
            ? 'Enter your one-time password.'
            : val.length === 6
              ? `You entered: ${val} (Complete)`
              : `You entered: ${val}`;
      };
      const setCode = (next: string) => {
        api.setProps('otpControlledRoot', { value: next });
        renderStatus(next);
      };
      api.setProps('otpControlledRoot', {
        onValueChange: (event: { value: string }) => {
          setCode(event.value);
        },
      });
      api.setProps('fillSampleBtn', {
        onClick: () => setCode('482910'),
      });
      api.setProps('clearBtn', {
        onClick: () => setCode(''),
      });
    },
  };
}

export function createInputOtpFormDemo(family: InputOtpDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapStage(family, [
      {
        kind: 'proto',
        prototypeId: `${family}-field-root`,
        ref: 'otpFieldRoot',
        props: { required: true, validationMode: 'manual' },
        children: [
          {
            kind: 'proto',
            prototypeId: `${family}-field-label`,
            ref: 'otpFieldLabel',
            props: {},
            children: ['4-digit PIN'],
          },
          part(
            family,
            'root',
            {
              length: 4,
              name: 'pin',
              ariaLabel: '4-digit verification PIN',
            },
            [
              part(family, 'control', { placeholder: '0000' }, [], 'otpFormControl'),
              slotGroup(family, [0, 1, 2, 3]),
            ],
            'otpFormRoot'
          ),
          {
            kind: 'proto',
            prototypeId: `${family}-field-description`,
            ref: 'otpFieldDescription',
            props: {},
            children: ['Enter the 4-digit code sent to your device.'],
          },
          {
            kind: 'proto',
            prototypeId: `${family}-field-error`,
            ref: 'otpFieldError',
            props: {},
            children: [],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: `${family}-button`,
            ref: 'verifyBtn',
            props: {},
            children: ['Verify'],
          },
          {
            kind: 'proto',
            prototypeId: `${family}-button`,
            ref: 'resetBtn',
            props: family === 'shadcn' ? { variant: 'outline' } : {},
            children: ['Reset'],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'formStatus',
        className: helperTextClass(family),
        attrs: { 'aria-live': 'polite' },
        children: ['Enter all 4 digits and press Verify.'],
      },
    ]),
    setup({ refs, api }: DemoSetupContext) {
      const readCode = () => {
        const handle = api.getExposes('otpFormRoot')?.value as { get?: () => unknown } | undefined;
        const val = handle?.get?.();
        return typeof val === 'string' ? val : '';
      };
      const clearError = () => {
        api.setProps('otpFieldRoot', { invalid: false, errors: [] });
        api.setProps('otpFormRoot', { invalid: false });
      };
      api.setProps('otpFormRoot', {
        onValueChange: (event: { value: string }) => {
          if (event.value.length === 4) {
            clearError();
            if (refs.formStatus) {
              refs.formStatus.textContent = `Ready to verify: ${event.value}`;
            }
          }
        },
      });
      api.setProps('verifyBtn', {
        onClick: () => {
          const code = readCode();
          if (code.length < 4) {
            api.setProps('otpFieldRoot', {
              invalid: true,
              errors: ['Please enter all 4 digits.'],
            });
            api.setProps('otpFormRoot', { invalid: true });
            if (refs.formStatus) {
              refs.formStatus.textContent = 'Incomplete code: 4 digits required.';
            }
            return;
          }
          clearError();
          if (refs.formStatus) {
            refs.formStatus.textContent = `Verified code: ${code}`;
          }
        },
      });
      api.setProps('resetBtn', {
        onClick: () => {
          api.call('otpFormRoot', 'resetValue');
          clearError();
          if (refs.formStatus) {
            refs.formStatus.textContent = 'Enter all 4 digits and press Verify.';
          }
        },
      });
    },
  };
}
