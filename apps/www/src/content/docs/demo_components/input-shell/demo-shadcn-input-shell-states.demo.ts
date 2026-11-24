import type {
  DemoSetupContext,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';
import {
  bindInputShellControl,
  type InputShellProps,
} from '@proto.ui/prototypes-shadcn/input-shell';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Disabled, read-only, and invalid shell states under Shadcn Rhea. */
export default withShadcnRheaDemo({
  type: 'demo',
  setup({ refs, api }: DemoSetupContext) {
    let current = true;
    const disposers = new Set<() => void>();
    const owner = {
      isCurrent: () => current,
      onDispose(dispose: () => void) {
        disposers.add(dispose);
        return () => disposers.delete(dispose);
      },
    };

    const baseShellProps: InputShellProps = { focusIndicator: 'ring' };
    let invalidFacts = { focusVisible: false, disabled: false };
    let isInvalid = true;

    const applyInvalidShell = () => {
      api.setProps('invalidShell', {
        ...baseShellProps,
        invalid: isInvalid,
        ...invalidFacts,
      });
    };

    const disabledBinding = bindInputShellControl(
      owner,
      {
        instance: refs.disabledShell,
        setFacts(facts) {
          api.setProps('disabledShell', { ...baseShellProps, ...facts });
        },
      },
      { getExposes: () => api.getExposes('disabledControl') }
    );

    const readonlyBinding = bindInputShellControl(
      owner,
      {
        instance: refs.readonlyShell,
        setFacts(facts) {
          api.setProps('readonlyShell', { ...baseShellProps, ...facts });
        },
      },
      { getExposes: () => api.getExposes('readonlyControl') }
    );

    const invalidBinding = bindInputShellControl(
      owner,
      {
        instance: refs.invalidShell,
        setFacts(facts) {
          invalidFacts = facts;
          applyInvalidShell();
        },
      },
      { getExposes: () => api.getExposes('invalidControl') }
    );

    const valueState = api.getExposes('invalidControl')?.value as
      | {
          get(): string;
          subscribe(listener: (event: { type: string; next?: string }) => void): () => void;
        }
      | undefined;

    if (valueState && typeof valueState.subscribe === 'function') {
      const unsub = valueState.subscribe((event) => {
        if (!current || event.type === 'disconnect') return;
        const nextValue = typeof event.next === 'string' ? event.next : valueState.get();
        isInvalid = !EMAIL_PATTERN.test(nextValue.trim());
        refs.invalidHint.textContent = isInvalid
          ? 'Enter a valid email address.'
          : 'Email format looks good.';
        refs.invalidHint.className = isInvalid
          ? 'text-xs text-destructive'
          : 'text-xs text-muted-foreground';
        applyInvalidShell();
      });
      disposers.add(unsub);
    }

    return () => {
      current = false;
      disabledBinding.dispose();
      readonlyBinding.dispose();
      invalidBinding.dispose();
      for (const dispose of [...disposers]) dispose();
      disposers.clear();
    };
  },
  root: {
    kind: 'box',
    className: 'grid w-full min-w-0 max-w-sm gap-4 p-4',
    children: [
      {
        kind: 'box',
        className: 'grid gap-1.5',
        children: [
          {
            kind: 'box',
            className: 'text-sm font-medium text-foreground',
            children: ['Work email (invalid)'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-input-shell',
            ref: 'invalidShell',
            props: {
              focusIndicator: 'ring',
              invalid: true,
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-input-shell-control',
                ref: 'invalidControl',
                props: {
                  defaultValue: 'alex@company',
                  placeholder: 'name@company.com',
                  inputMode: 'email',
                  ariaLabel: 'Work email',
                },
              },
            ],
          },
          {
            kind: 'box',
            ref: 'invalidHint',
            className: 'text-xs text-destructive',
            children: ['Enter a valid email address.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'grid gap-1.5',
        children: [
          {
            kind: 'box',
            className: 'text-sm font-medium text-foreground',
            children: ['Share URL (read-only)'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-input-shell',
            ref: 'readonlyShell',
            props: {
              focusIndicator: 'ring',
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-input-shell-control',
                ref: 'readonlyControl',
                props: {
                  readOnly: true,
                  defaultValue: 'https://proto-ui.dev/docs',
                  ariaLabel: 'Share URL',
                },
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'grid gap-1.5',
        children: [
          {
            kind: 'box',
            className: 'text-sm font-medium text-muted-foreground',
            children: ['Organization ID (disabled)'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-input-shell',
            ref: 'disabledShell',
            props: {
              focusIndicator: 'ring',
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-input-shell-control',
                ref: 'disabledControl',
                props: {
                  disabled: true,
                  defaultValue: 'org_29a8f1c0',
                  ariaLabel: 'Organization ID',
                },
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
