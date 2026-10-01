import type { DemoNode, DemoSetupContext } from '../../../components/PrototypePreviewer/demo-types';

function option(group: string, value: string, label: string, disabled = false): DemoNode {
  return {
    kind: 'box',
    className: 'flex items-center gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-radio-group-item',
        ref: `${group}-${value}`,
        props: { value, disabled },
        children: [
          { kind: 'proto', prototypeId: 'shadcn-radio-group-indicator' },
          { kind: 'box', className: 'sr-only', children: [label] },
        ],
      },
      {
        kind: 'box',
        className: disabled ? 'text-sm leading-none opacity-50' : 'text-sm leading-none',
        children: [label],
      },
    ],
  };
}

function group(ref: string, title: string, defaultValue: string, disabled = false): DemoNode {
  return {
    kind: 'box',
    className: 'flex flex-col gap-3',
    children: [
      { kind: 'box', className: 'text-sm font-medium', children: [title] },
      {
        kind: 'proto',
        prototypeId: 'shadcn-radio-group-root',
        ref,
        props: { a11yLabel: title, defaultValue, disabled },
        children: [
          option(ref, 'default', 'Default'),
          option(ref, 'comfortable', 'Comfortable'),
          option(ref, 'compact', 'Compact (disabled)', true),
        ],
      },
    ],
  };
}

export default {
  type: 'demo',
  setup({ host, refs, api }: DemoSetupContext) {
    const label = refs.selectedValue;
    if (!label) return;

    let frame = 0;
    const renderValue = () => {
      const value = api.getExposes('density')?.value as { get(): string } | undefined;
      label.textContent = `Value: ${value?.get() || 'none'}`;
    };
    const scheduleValue = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(renderValue);
    };
    const observer = new MutationObserver(scheduleValue);
    observer.observe(host, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-checked'],
    });
    host.addEventListener('valueChange', scheduleValue);
    scheduleValue();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('valueChange', scheduleValue);
    };
  },
  root: {
    kind: 'box',
    className: 'flex w-full flex-col gap-4',
    children: [
      {
        kind: 'box',
        className: 'grid gap-6 sm:grid-cols-3',
        children: [
          group('density', 'Density preference', 'comfortable'),
          group('empty', 'No initial selection', ''),
          group('disabled', 'Disabled group', 'comfortable', true),
        ],
      },
      {
        kind: 'box',
        ref: 'selectedValue',
        className: 'text-sm text-muted-foreground',
        children: ['Value: —'],
      },
    ],
  },
};
