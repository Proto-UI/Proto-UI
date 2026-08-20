import type { DemoSetupContext } from '../../../components/PrototypePreviewer/demo-types';

const primaryProps = {
  defaultValue: 'Edit this native textarea to exercise uncontrolled ownership.',
  disabled: false,
  readOnly: false,
  required: true,
  name: 'protocol-notes',
  placeholder: 'Write a protocol note',
  autoComplete: 'off',
  minLength: 3,
  maxLength: 240,
  rows: 5,
  wrap: 'soft',
  ariaLabel: '',
  labelledBy: 'textarea-demo-label',
  describedBy: 'textarea-demo-help',
} as const;

const alternateProps = {
  disabled: true,
  readOnly: true,
  required: false,
  name: 'locked-protocol-notes',
  placeholder: 'Temporarily locked',
  autoComplete: 'on',
  minLength: 1,
  maxLength: 120,
  rows: 3,
  wrap: 'hard',
  ariaLabel: 'Locked protocol notes',
  labelledBy: '',
  describedBy: 'textarea-demo-help',
} as const;

const stateKeys = [
  'value',
  'disabled',
  'readOnly',
  'focused',
  'focusVisible',
  'composing',
] as const;

const eventNames = [
  'valueChange',
  'change',
  'compositionStart',
  'compositionUpdate',
  'compositionEnd',
] as const;

let textareaDemoSequence = 0;

export function createTextareaDemoSetup(resetProps: Readonly<Record<string, unknown>>) {
  return ({ host, refs, api }: DemoSetupContext) => {
    const stateLabel = refs.stateLabel;
    const eventLog = refs.eventLog;
    const externalLabel = refs.externalLabel;
    const help = refs.help;
    if (!stateLabel || !eventLog || !externalLabel || !help) return;

    const demoId = ++textareaDemoSequence;
    externalLabel.id = `textarea-demo-${demoId}-label`;
    help.id = `textarea-demo-${demoId}-help`;

    for (const ref of ['toggleProps', 'focusButton', 'blurButton']) {
      const control = refs[ref];
      if (!control) continue;
      control.setAttribute('role', 'button');
      control.tabIndex = 0;
    }

    let stateFrame = 0;
    const readState = (ref: string, key: (typeof stateKeys)[number]) => {
      const exposed = api.getExposes(ref)?.[key];
      if (!exposed || typeof exposed !== 'object') return undefined;
      const get = (exposed as { get?: () => unknown }).get;
      return typeof get === 'function' ? get() : undefined;
    };
    const renderState = () => {
      stateLabel.textContent = stateKeys
        .map((key) => `${key}=${String(readState('textarea', key))}`)
        .join(' · ');
    };
    const scheduleState = () => {
      cancelAnimationFrame(stateFrame);
      stateFrame = requestAnimationFrame(renderState);
    };
    const record = (source: string, eventName: string, detail: unknown) => {
      eventLog.textContent = `${source}.${eventName}: ${JSON.stringify(detail)}`;
      scheduleState();
    };
    const eventProps = (source: string) => ({
      onValueChange: (detail: unknown) => record(source, 'valueChange', detail),
      onChange: (detail: unknown) => record(source, 'change', detail),
      onCompositionStart: (detail: unknown) => record(source, 'compositionStart', detail),
      onCompositionUpdate: (detail: unknown) => record(source, 'compositionUpdate', detail),
      onCompositionEnd: (detail: unknown) => record(source, 'compositionEnd', detail),
    });
    const uncontrolledEventProps = eventProps('uncontrolled');

    api.setProps('textarea', {
      ...resetProps,
      ...uncontrolledEventProps,
      labelledBy: externalLabel.id,
      describedBy: help.id,
    });

    const onExposedEvent = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const source =
        (event.target as HTMLElement | null)
          ?.closest('[data-demo-ref]')
          ?.getAttribute('data-demo-ref') ?? 'textarea';
      record(source, event.type, event.detail);
    };
    for (const eventName of eventNames) host.addEventListener(eventName, onExposedEvent);

    let alternate = false;
    const activate = (target: HTMLElement) => {
      if (target.closest('[data-demo-ref="toggleProps"]')) {
        alternate = !alternate;
        api.setProps('textarea', {
          ...(alternate ? alternateProps : resetProps),
          ...uncontrolledEventProps,
          labelledBy: alternate ? '' : externalLabel.id,
          describedBy: help.id,
        });
        scheduleState();
        return true;
      }
      if (target.closest('[data-demo-ref="focusButton"]')) {
        api.call('textarea', 'focusSelf');
        scheduleState();
        return true;
      }
      if (target.closest('[data-demo-ref="blurButton"]')) {
        api.call('textarea', 'blurSelf');
        scheduleState();
        return true;
      }
      return false;
    };
    const onHostClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target) activate(target);
    };
    const onHostKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target as HTMLElement | null;
      if (target && activate(target)) event.preventDefault();
    };
    const onFocusChange = () => scheduleState();
    host.addEventListener('click', onHostClick);
    host.addEventListener('keydown', onHostKeyDown);
    host.addEventListener('focusin', onFocusChange);
    host.addEventListener('focusout', onFocusChange);
    host.addEventListener('input', onFocusChange);
    host.addEventListener('compositionstart', onFocusChange);
    host.addEventListener('compositionend', onFocusChange);
    scheduleState();

    return () => {
      cancelAnimationFrame(stateFrame);
      for (const eventName of eventNames) host.removeEventListener(eventName, onExposedEvent);
      host.removeEventListener('click', onHostClick);
      host.removeEventListener('keydown', onHostKeyDown);
      host.removeEventListener('focusin', onFocusChange);
      host.removeEventListener('focusout', onFocusChange);
      host.removeEventListener('input', onFocusChange);
      host.removeEventListener('compositionstart', onFocusChange);
      host.removeEventListener('compositionend', onFocusChange);
    };
  };
}

export const setupTextareaDemo = createTextareaDemoSetup(primaryProps);

export default {
  type: 'demo',
  setup: setupTextareaDemo,
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-3',
    children: [
      {
        kind: 'box',
        ref: 'externalLabel',
        className: 'text-sm font-medium',
        children: ['Uncontrolled protocol notes'],
      },
      {
        kind: 'proto',
        prototypeId: 'base-textarea-root',
        ref: 'textarea',
        className:
          'block w-full border-2 border-slate-500 bg-white p-3 text-sm text-slate-950 outline-none focus:border-slate-950',
        props: { ...primaryProps },
      },
      {
        kind: 'box',
        ref: 'help',
        className: 'text-xs text-muted-foreground',
        children: [
          'Type, blur, or use IME to inspect normalized events. Live controls exercise props and exposes.',
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap gap-2',
        children: [
          {
            kind: 'box',
            ref: 'toggleProps',
            className:
              'cursor-pointer select-none border border-slate-500 px-2 py-1 text-xs font-medium',
            children: ['Toggle live props'],
          },
          {
            kind: 'box',
            ref: 'focusButton',
            className:
              'cursor-pointer select-none border border-slate-500 px-2 py-1 text-xs font-medium',
            children: ['focusSelf()'],
          },
          {
            kind: 'box',
            ref: 'blurButton',
            className:
              'cursor-pointer select-none border border-slate-500 px-2 py-1 text-xs font-medium',
            children: ['blurSelf()'],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'stateLabel',
        className: 'break-words font-mono text-xs text-muted-foreground',
        children: ['State exposes'],
      },
      {
        kind: 'box',
        ref: 'eventLog',
        className: 'min-h-5 break-words font-mono text-xs text-muted-foreground',
        children: ['Event log: edit the textarea'],
      },
    ],
  },
};
