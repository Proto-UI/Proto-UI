import type {
  DemoSetupContext,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';
import {
  bindInputShellControl,
  type InputShellProps,
} from '@proto.ui/prototypes-shadcn/input-shell';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const INITIAL_SLUG = 'design-system';

/** Demonstrates value tracking, focusSelf(), and resetValue() on inputShellControl. */
export default withShadcnRheaDemo({
  type: 'demo',
  setup({ refs, api }: DemoSetupContext) {
    let current = true;
    const disposers = new Set<() => void>();
    const shellProps: InputShellProps = { focusIndicator: 'ring' };
    const binding = bindInputShellControl(
      {
        isCurrent: () => current,
        onDispose(dispose) {
          disposers.add(dispose);
          return () => disposers.delete(dispose);
        },
      },
      {
        instance: refs.shell,
        setFacts(facts) {
          api.setProps('shell', { ...shellProps, ...facts });
        },
      },
      { getExposes: () => api.getExposes('control') }
    );

    const renderPreview = (value: string) => {
      const normalized = value.trim() || 'untitled';
      refs.previewUrl.textContent = `Preview path: /projects/${normalized}`;
    };

    const valueState = api.getExposes('control')?.value as
      | {
          get(): string;
          subscribe(listener: (event: { type: string; next?: string }) => void): () => void;
        }
      | undefined;

    if (valueState && typeof valueState.subscribe === 'function') {
      renderPreview(valueState.get());
      const unsub = valueState.subscribe((event) => {
        if (!current || event.type === 'disconnect') return;
        renderPreview(typeof event.next === 'string' ? event.next : valueState.get());
      });
      disposers.add(unsub);
    }

    api.setProps('focusBtn', {
      variant: 'outline',
      size: 'sm',
      onClick: () => {
        const focusSelf = api.getExposes('control')?.focusSelf as (() => void) | undefined;
        focusSelf?.();
      },
    });

    api.setProps('resetBtn', {
      variant: 'outline',
      size: 'sm',
      onClick: () => {
        const resetValue = api.getExposes('control')?.resetValue as
          | ((next?: string) => boolean)
          | undefined;
        resetValue?.(INITIAL_SLUG);
        if (valueState) renderPreview(valueState.get());
      },
    });

    return () => {
      current = false;
      binding.dispose();
      for (const dispose of [...disposers]) dispose();
      disposers.clear();
    };
  },
  root: {
    kind: 'box',
    className: 'grid w-full min-w-0 max-w-sm gap-3 p-4',
    children: [
      {
        kind: 'box',
        className: 'text-sm font-medium text-foreground',
        children: ['Project slug'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-input-shell',
        ref: 'shell',
        props: {
          focusIndicator: 'ring',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-input-shell-control',
            ref: 'control',
            props: {
              defaultValue: INITIAL_SLUG,
              placeholder: 'project-slug',
              maxLength: 32,
              ariaLabel: 'Project slug',
            },
          },
        ],
      },
      {
        kind: 'box',
        ref: 'previewUrl',
        attrs: { 'aria-live': 'polite' },
        className: 'text-xs text-muted-foreground',
        children: [`Preview path: /projects/${INITIAL_SLUG}`],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'focusBtn',
            props: { variant: 'outline', size: 'sm' },
            children: ['Focus input'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'resetBtn',
            props: { variant: 'outline', size: 'sm' },
            children: ['Reset value'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
