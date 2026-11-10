import { AdaptToWebComponent } from '../../../adapters/web-component/src/adapt';
import { setElementProps } from '../../../adapters/web-component/src/props';
import baseRegion from '../src/async-region';
import baseLiveRegion from '../src/live-region';
import shadcnRegion from '../../shadcn/src/async-region';
import shadcnLiveRegion from '../../shadcn/src/live-region';
import { asyncRegionRoot as brutalistRegion } from '../../brutalist/src/async-region';
import { liveRegionRoot as brutalistLiveRegion } from '../../brutalist/src/live-region';
import bootstrapRegion from '../../bootstrap-2-3-2/src/async-region';
import bootstrapLiveRegion from '../../bootstrap-2-3-2/src/live-region';
import liquidGlassRegion from '../../liquid-glass/src/async-region';
import liquidGlassLiveRegion from '../../liquid-glass/src/live-region';

const projections = {
  base: { region: baseRegion, live: baseLiveRegion },
  shadcn: { region: shadcnRegion, live: shadcnLiveRegion },
  brutalist: { region: brutalistRegion, live: brutalistLiveRegion },
  'bootstrap-2-3-2': { region: bootstrapRegion, live: bootstrapLiveRegion },
  'liquid-glass': { region: liquidGlassRegion, live: liquidGlassLiveRegion },
} as const;

export type AsyncRegionFamily = keyof typeof projections;

type RegionElement = HTMLElement & {
  getExposes(): { busy: { get(): boolean } };
};

type NativeEvent = {
  type: string;
  target: string;
  trusted: boolean;
  key: string | null;
};

export interface AsyncRegionSnapshot {
  regionName: string;
  liveRegionName: string;
  regionConstructor: boolean;
  liveRegionConstructor: boolean;
  ariaBusy: string | null;
  busy: boolean;
  sameBusyHandle: boolean;
  exposes: string[];
  role: string | null;
  live: string | null;
  label: string | null;
  labelledBy: string | null;
  tabIndex: number;
  inert: boolean;
  ariaDisabled: string | null;
  sameInput: boolean;
  sameRetry: boolean;
  sameLiveRegion: boolean;
  samePayload: boolean;
  payload: string | null;
  liveRole: string | null;
  livePoliteness: string | null;
  liveAtomic: string | null;
  inputValue: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  inputDisabled: boolean;
  inputReadOnly: boolean;
  retryDisabled: boolean;
  retryCount: number;
  activeId: string;
  nativeEvents: NativeEvent[];
}

export interface AsyncRegionConsumer {
  setBusy(busy: boolean): void;
  resetBusy(): void;
  updatePayload(message: string): void;
  read(): AsyncRegionSnapshot;
}

/**
 * A real WC consumer, also retained as an executable HTML fixture for manual AT.
 * The input, retry action and payload belong to the application. Region props
 * are the only path used to change busy semantics; no ARIA answer is injected.
 */
export function mount(
  family: AsyncRegionFamily,
  initiallyBusy?: boolean
): AsyncRegionConsumer {
  const projection = projections[family];
  const Root = AdaptToWebComponent(projection.region);
  const Live = AdaptToWebComponent(projection.live);
  const root = new Root() as RegionElement;
  const live = new Live();
  root.id = 'region';
  live.id = 'announcements';
  if (initiallyBusy !== undefined) setElementProps(root, { busy: initiallyBusy });

  const main = document.createElement('main');
  const heading = document.createElement('h1');
  heading.textContent = `${family}: Async Region native consumer`;
  const boundary = document.createElement('p');
  boundary.textContent =
    family === 'bootstrap-2-3-2' || family === 'liquid-glass'
      ? 'Optional 0.4/WIP source sample. This fixture does not establish release, family visual or assistive-technology acceptance.'
      : 'Native editing and busy projection fixture. Actual screen-reader delivery and family visual acceptance require separate evidence.';
  const before = document.createElement('button');
  before.id = 'before';
  before.type = 'button';
  before.textContent = 'Before region';

  const label = document.createElement('label');
  label.textContent = 'Draft reply ';
  const input = document.createElement('input');
  input.id = 'draft';
  input.type = 'text';
  input.value = 'Draft';
  label.append(input);
  const retry = document.createElement('button');
  retry.id = 'retry';
  retry.type = 'button';
  retry.textContent = 'Retry';
  const payload = document.createTextNode('No new messages.');
  live.append(payload);
  root.append(label, retry, live);

  const after = document.createElement('button');
  after.id = 'after';
  after.type = 'button';
  after.textContent = 'After region';
  const busyLabel = document.createElement('p');
  const retryLabel = document.createElement('p');
  retryLabel.textContent = 'Retry count: 0';
  let retryCount = 0;
  retry.addEventListener('click', () => {
    retryCount += 1;
    retryLabel.textContent = `Retry count: ${retryCount}`;
  });

  const updateBusyLabel = () => {
    busyLabel.textContent = `Busy: ${root.getAttribute('aria-busy')}`;
  };
  const setBusy = (busy: boolean) => {
    setElementProps(root, { busy });
    updateBusyLabel();
  };
  const resetBusy = () => {
    setElementProps(root, {});
    updateBusyLabel();
  };
  const updatePayload = (message: string) => {
    payload.data = message;
  };
  const begin = document.createElement('button');
  begin.id = 'begin';
  begin.type = 'button';
  begin.textContent = 'Begin update';
  begin.addEventListener('click', () => {
    setBusy(true);
    updatePayload('Checking messages.');
  });
  const finish = document.createElement('button');
  finish.id = 'finish';
  finish.type = 'button';
  finish.textContent = 'Finish update';
  finish.addEventListener('click', () => {
    updatePayload('3 new messages.');
    setBusy(false);
  });
  const reset = document.createElement('button');
  reset.id = 'reset';
  reset.type = 'button';
  reset.textContent = 'Reset busy prop';
  reset.addEventListener('click', resetBusy);
  main.append(heading, boundary, before, root, after, busyLabel, retryLabel, begin, finish, reset);
  document.body.append(main);
  updateBusyLabel();

  const busyHandle = root.getExposes().busy;
  const nativeEvents: NativeEvent[] = [];
  for (const type of ['focusin', 'keydown', 'beforeinput', 'input', 'click']) {
    main.addEventListener(
      type,
      (event) => {
        nativeEvents.push({
          type: event.type,
          target: event.target instanceof HTMLElement ? event.target.id : '',
          trusted: event.isTrusted,
          key: event instanceof KeyboardEvent ? event.key : null,
        });
      },
      true
    );
  }

  return {
    setBusy,
    resetBusy,
    updatePayload,
    read() {
      return {
        regionName: root.localName,
        liveRegionName: live.localName,
        regionConstructor: customElements.get(root.localName) === Root,
        liveRegionConstructor: customElements.get(live.localName) === Live,
        ariaBusy: root.getAttribute('aria-busy'),
        busy: root.getExposes().busy.get(),
        sameBusyHandle: root.getExposes().busy === busyHandle,
        exposes: Object.keys(root.getExposes()).sort(),
        role: root.getAttribute('role'),
        live: root.getAttribute('aria-live'),
        label: root.getAttribute('aria-label'),
        labelledBy: root.getAttribute('aria-labelledby'),
        tabIndex: root.tabIndex,
        inert: root.inert,
        ariaDisabled: root.getAttribute('aria-disabled'),
        sameInput: document.getElementById('draft') === input && label.contains(input),
        sameRetry: document.getElementById('retry') === retry && root.contains(retry),
        sameLiveRegion:
          document.getElementById('announcements') === live && root.contains(live),
        samePayload: live.firstChild === payload,
        payload: live.textContent,
        liveRole: live.getAttribute('role'),
        livePoliteness: live.getAttribute('aria-live'),
        liveAtomic: live.getAttribute('aria-atomic'),
        inputValue: input.value,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
        inputDisabled: input.disabled,
        inputReadOnly: input.readOnly,
        retryDisabled: retry.disabled,
        retryCount,
        activeId: document.activeElement instanceof HTMLElement ? document.activeElement.id : '',
        nativeEvents: [...nativeEvents],
      };
    },
  };
}
