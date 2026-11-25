import type {
  DemoChild,
  DemoNode,
  DemoSpec,
} from '../../src/components/PrototypePreviewer/demo-types';
import type { FieldValidationRequest } from '@proto.ui/prototypes-base/field';

// Test-only consumer for scenarios no longer displayed by the public form demo.
// All validation, ownership, focus and editor behavior belongs to the public
// Field prototypes. This consumer only supplies normal owner props/callbacks.
export function createFieldCompanion(family: string): DemoSpec {
  const atom = (
    role: string,
    ref: string,
    props: Record<string, unknown> = {},
    children: DemoChild[] = []
  ): DemoNode => ({
    kind: 'proto',
    prototypeId: `${family}-field-${role}`,
    ref,
    props,
    children,
    ...(family === 'base' ? { className: `fixture-base-field-${role}` } : {}),
  });
  const button = (ref: string, text: string): DemoNode => ({
    kind: 'proto',
    prototypeId: `${family}-button`,
    ref,
    children: [text],
    ...(family === 'base' ? { className: 'fixture-base-button' } : {}),
  });
  const field = (
    id: string,
    label: string,
    props: Record<string, unknown>,
    controlProps: Record<string, unknown>,
    help: string,
    commands: DemoNode[] = []
  ): DemoNode =>
    atom('root', `${id}Root`, props, [
      atom('label', `${id}Label`, {}, [label]),
      atom('control', `${id}Control`, controlProps),
      atom('description', `${id}Description`, {}, [help]),
      ...commands,
      atom('error', `${id}Error`),
      atom('validity', `${id}Validity`),
    ]);

  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'fixture-fields',
      children: [
        field(
          'required',
          'Account name',
          { required: true, minLength: 3, validationMode: 'onBlur' },
          {},
          'Enter at least three characters.'
        ),
        field(
          'async',
          'Available handle',
          { externalValidation: true, validationMode: 'onChange' },
          {},
          'Try taken, then replace or cancel the request.',
          [button('cancel', 'Cancel validation')]
        ),
        { kind: 'box', ref: 'asyncStatus', attrs: { 'aria-live': 'polite' }, children: ['Ready'] },
        field(
          'controlled',
          'Owner controlled validity',
          { required: true, invalid: false, validationMode: 'manual' },
          {},
          'The owner decides whether to accept invalidity.'
        ),
        {
          kind: 'box',
          className: 'fixture-commands',
          children: [
            button('propose', 'Propose invalidity'),
            button('accept', 'Accept invalidity'),
          ],
        },
        field(
          'readonly',
          'Read-only account',
          { readOnly: true },
          { defaultValue: 'Read-only value' },
          'This editor remains focusable but cannot be edited.'
        ),
        field(
          'disabled',
          'Disabled account',
          { disabled: true },
          { defaultValue: 'Disabled value' },
          'This editor is disabled.'
        ),
        field(
          'long',
          'A longer account label that must wrap naturally at a narrow viewport and larger text size',
          {
            defaultInvalid: true,
            defaultErrors: [
              'The account could not be verified. Check the entered value and try again when it is available.',
            ],
          },
          {},
          'This longer description preserves complete readable text without forcing the field outside its available width.'
        ),
      ],
    },
    setup({ refs, api }) {
      let alive = true;
      let currentRequest = '';
      const timers = new Set<ReturnType<typeof setTimeout>>();
      api.setProps('asyncRoot', {
        onValidationRequest(request: FieldValidationRequest) {
          if (currentRequest === request.requestId) return;
          currentRequest = request.requestId;
          refs.asyncStatus.textContent = 'Checking';
          const timer = setTimeout(() => {
            timers.delete(timer);
            if (!alive) return;
            const invalid = request.value === 'taken';
            const accepted = api.call('asyncRoot', 'resolveValidation', request.requestId, {
              invalid,
              errors: invalid ? ['That handle is already taken.'] : [],
            });
            if (currentRequest === request.requestId) {
              refs.asyncStatus.textContent = accepted
                ? invalid
                  ? 'Unavailable'
                  : 'Available'
                : 'Superseded';
            }
          }, 400);
          timers.add(timer);
        },
      });
      api.setProps('cancel', {
        onClick() {
          api.call('asyncRoot', 'cancelValidation');
          currentRequest = '';
          refs.asyncStatus.textContent = 'Canceled';
        },
      });
      api.setProps('propose', { onClick: () => api.call('controlledRoot', 'validate') });
      api.setProps('accept', {
        onClick: () =>
          api.setProps('controlledRoot', {
            invalid: true,
            errors: ['The owner accepted this validation result.'],
          }),
      });
      return () => {
        alive = false;
        for (const timer of timers) clearTimeout(timer);
      };
    },
  };
}
