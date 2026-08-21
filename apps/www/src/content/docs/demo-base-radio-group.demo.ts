import type { DemoNode, DemoSetupContext } from '../../components/PrototypePreviewer/demo-types';

function option(
  value: string,
  label: string,
  description: string,
  disabled = false
): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'base-radio-group-item',
    className:
      'group grid min-h-16 cursor-pointer grid-cols-[auto_1fr] items-center gap-x-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-left shadow-sm outline-none transition-colors ' +
      'data-[checked]:border-cyan-700 data-[checked]:bg-cyan-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 ' +
      'focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-950 dark:data-[checked]:border-cyan-400 dark:data-[checked]:bg-cyan-950/40',
    props: { value, disabled },
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-radio-group-indicator',
        className:
          'row-span-2 grid size-5 place-items-center rounded-full border-2 border-slate-400 text-cyan-700 ' +
          'group-data-[checked]:border-cyan-700 dark:border-slate-500 dark:text-cyan-300 dark:group-data-[checked]:border-cyan-300',
        children: [
          {
            kind: 'box',
            className:
              'size-2.5 rounded-full bg-current opacity-0 transition-opacity group-data-[checked]:opacity-100',
          },
        ],
      },
      {
        kind: 'box',
        className: 'text-sm font-semibold text-slate-950 dark:text-slate-50',
        children: [label],
      },
      {
        kind: 'box',
        className: 'text-xs leading-5 text-slate-600 dark:text-slate-400',
        children: [description],
      },
    ],
  };
}

export default {
  type: 'demo',
  setup({ host, refs, api }: DemoSetupContext) {
    const valueLabel = refs.valueLabel;
    if (!valueLabel) return;

    let frame = 0;
    const renderValue = () => {
      const exposed = api.getExposes('group')?.value;
      const get =
        exposed && typeof exposed === 'object'
          ? (exposed as { get?: () => unknown }).get
          : undefined;
      const value = typeof get === 'function' ? get() : '';
      valueLabel.textContent = typeof value === 'string' && value ? value : 'none';
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
    className: 'flex w-full max-w-lg flex-col gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex items-end justify-between gap-4',
        children: [
          {
            kind: 'box',
            children: [
              {
                kind: 'box',
                className:
                  'text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300',
                children: ['Dispatch window'],
              },
              {
                kind: 'box',
                className: 'mt-1 text-sm text-slate-600 dark:text-slate-400',
                children: ['Use Space, arrows, Home, or End.'],
              },
            ],
          },
          {
            kind: 'box',
            className:
              'rounded-full border border-slate-300 bg-slate-50 px-3 py-1 font-mono text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
            children: [
              'value: ',
              {
                kind: 'box',
                ref: 'valueLabel',
                className: 'inline font-semibold text-cyan-800 dark:text-cyan-300',
                children: ['none'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'base-radio-group-root',
        ref: 'group',
        className: 'grid gap-2',
        props: {
          defaultValue: 'express',
          a11yLabel: 'Dispatch window',
        },
        children: [
          option('express', 'Express', 'Today, before 18:00'),
          option('next-day', 'Next day', 'Tomorrow, before noon'),
          option('scheduled', 'Scheduled', 'Choose a future date — unavailable', true),
        ],
      },
    ],
  },
};
