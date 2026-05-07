const indicatorClass =
  'group relative grid h-5 w-5 place-items-center rounded-[4px] border border-slate-400 text-white ' +
  'data-[checked]:border-blue-600 data-[checked]:bg-blue-600 ' +
  'data-[indeterminate]:border-blue-600 data-[indeterminate]:bg-blue-600';

const checkMark = {
  kind: 'box',
  className: 'h-2.5 w-2.5 rounded-sm bg-current opacity-0 group-data-[checked]:opacity-100',
};

const indeterminateMark = {
  kind: 'box',
  className:
    'absolute h-0.5 w-2.5 rounded bg-current opacity-0 group-data-[indeterminate]:opacity-100',
};

function checkboxRow({
  ref,
  label,
  props,
}: {
  ref: string;
  label: string;
  props?: Record<string, unknown>;
}) {
  return {
    kind: 'proto',
    prototypeId: 'base-checkbox-root',
    ref,
    className:
      'inline-flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1 text-sm ' +
      'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
    props,
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-checkbox-indicator',
        className: indicatorClass,
        children: [checkMark, indeterminateMark],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-0.5',
        children: [
          label,
          {
            kind: 'box',
            ref: `${ref}-status`,
            className: 'text-xs text-slate-500',
            children: ['checked: false, indeterminate: false'],
          },
        ],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col items-start gap-3',
    children: [
      checkboxRow({ ref: 'unchecked', label: 'Unchecked' }),
      checkboxRow({ ref: 'checked', label: 'Checked', props: { defaultChecked: true } }),
      checkboxRow({
        ref: 'indeterminate',
        label: 'Indeterminate',
        props: { defaultIndeterminate: true },
      }),
      checkboxRow({ ref: 'disabled', label: 'Disabled', props: { disabled: true } }),
    ],
  },
  setup({ refs, api }: any) {
    const roots = ['unchecked', 'checked', 'indeterminate', 'disabled'];
    const cleanups: Array<() => void> = [];
    const subscribed = new Set<string>();
    const timers: ReturnType<typeof setTimeout>[] = [];

    const update = (ref: string) => {
      const exposes = api.getExposes(ref) as any;
      const status = refs[`${ref}-status`];
      if (!exposes || !status) return false;
      const checked = !!exposes.checked?.get?.();
      const indeterminate = !!exposes.indeterminate?.get?.();
      status.textContent = `checked: ${checked}, indeterminate: ${indeterminate}`;
      return true;
    };

    const updateSoon = (ref: string) => {
      requestAnimationFrame(() => requestAnimationFrame(() => update(ref)));
    };

    const bindState = (ref: string) => {
      if (subscribed.has(ref)) return true;
      const exposes = api.getExposes(ref) as any;
      if (!exposes) return false;

      const listener = () => updateSoon(ref);
      for (const key of ['checked', 'indeterminate']) {
        const handle = exposes[key];
        if (!handle || typeof handle.subscribe !== 'function') continue;
        const off = handle.subscribe(listener);
        cleanups.push(() => {
          if (typeof handle.unsubscribe === 'function') handle.unsubscribe(off);
          else if (typeof off === 'function') off();
        });
      }

      subscribed.add(ref);
      update(ref);
      return true;
    };

    const syncAll = (attempt = 0) => {
      roots.forEach((ref) => {
        bindState(ref);
        update(ref);
      });

      if (subscribed.size === roots.length || attempt >= 6) return;

      const timer = setTimeout(() => syncAll(attempt + 1), 50 * (attempt + 1));
      timers.push(timer);
    };

    requestAnimationFrame(() => requestAnimationFrame(() => syncAll()));

    roots.forEach((ref) => {
      const root = refs[ref];
      if (!root) return;
      const listener = () => updateSoon(ref);
      root.addEventListener('click', listener);
      root.addEventListener('checkedChange', listener);
      root.addEventListener('indeterminateChange', listener);
      cleanups.push(
        () => root.removeEventListener('click', listener),
        () => root.removeEventListener('checkedChange', listener),
        () => root.removeEventListener('indeterminateChange', listener)
      );
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      cleanups.forEach((cleanup) => cleanup());
    };
  },
};
