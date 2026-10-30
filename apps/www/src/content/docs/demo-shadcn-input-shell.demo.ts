import type { DemoSetupContext, DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { bindInputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';

/** One real editor; the public binder owns the two-fact projection and its retirement. */
export default {
  type: 'demo',
  setup({ refs, api }: DemoSetupContext) {
    let current = true;
    const disposers = new Set<() => void>();
    // Demo setup and cleanup delimit the committed view. The normalized public
    // expose port remains live; no State values or subscriptions are copied.
    const control = { getExposes: () => api.getExposes('control') };
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
          api.setProps('shell', facts);
          refs.factState.textContent = `focusVisible=${facts.focusVisible} disabled=${facts.disabled}`;
        },
      },
      control
    );
    api.setProps('toggleDisabled', {
      onClick: () => {
        const disabled = api.getExposes('control')?.disabled as { get(): boolean };
        api.setProps('control', { disabled: !disabled.get() });
      },
    });
    return () => {
      current = false;
      binding.dispose();
      for (const dispose of disposers) dispose();
      disposers.clear();
    };
  },
  root: {
    kind: 'box',
    className: 'grid w-full min-w-0 max-w-full gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-input-shell',
        ref: 'shell',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-input-shell-control',
            ref: 'control',
            props: {
              placeholder: 'Search mail · 搜索邮件',
              ariaLabel: 'Search mail · 搜索邮件',
            },
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'toggleDisabled',
            children: ['Toggle control disabled · 切换禁用'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'font-mono text-xs text-muted-foreground',
        children: [
          'shell facts: ',
          { kind: 'box', ref: 'factState', className: 'inline', children: ['Waiting for control facts'] },
        ],
      },
      {
        kind: 'box',
        className: 'text-xs text-muted-foreground',
        children: ['The actual editor retains editing and focus ownership; the public binder projects only focus-visible and disabled facts. 控件保留编辑与焦点所有权。'],
      },
    ],
  },
} satisfies DemoSpec;
