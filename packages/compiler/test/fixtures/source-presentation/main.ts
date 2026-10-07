import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { createReactAdapter } from '@proto.ui/adapter-react';
import './presentation.css';

const side = new URL(location.href).searchParams.get('target') ?? 'reference';
const options = { schedule: (task: () => void) => task(), autoUpdateOnPropsChange: false };
let component: React.ComponentType<Record<string, unknown>>;
// URL-selected execution boundary: static imports would compile/load every profile
// (including the mutant) even when observing only the original Adapter oracle.
if (side === 'reference') {
  const { default: prototype } = await import('./presentation.proto');
  component = createReactAdapter(React)(prototype, options);
} else if (side === 'runtime') {
  const emitted = await import('virtual:presentation/runtime/Component.tsx');
  component = emitted.createComponent(options);
} else if (side === 'source' || side === 'source-duplicate-activation') {
  const emitted =
    side === 'source'
      ? await import('virtual:presentation/source/Component.tsx')
      : await import('virtual:presentation/source-duplicate-activation/Component.tsx');
  component = emitted.Presentation;
} else throw new Error(`Unknown target ${side}`);

type State<T> = { get(): T };
type Exposes = {
  count: State<number>;
  later: State<boolean>;
  pressed: State<boolean>;
  focused: State<boolean>;
  disabled: State<boolean>;
  setLater(value: boolean): void;
};
const ref = React.createRef<{
  getExposes(): Exposes;
  invokeInCallbackScope<T>(callback: () => T): T;
}>();
const host = document.getElementById('presentation-host')!;
const root = createRoot(host);
let present = true;
let disabled = false;
let accent = false;
let clicks = 0;
let updated = 0;
let step = 'initial';
let disposed = false;
let oldTarget: HTMLElement | null = null;
let held: Exposes | null = null;
const inputs: Array<{ step: string; type: string; key: string | null; trusted: boolean }> = [];
for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click']) {
  document.addEventListener(
    type,
    (event) => {
      inputs.push({
        step,
        type,
        key: event instanceof KeyboardEvent ? event.key : null,
        trusted: event.isTrusted,
      });
    },
    true
  );
}
function render() {
  flushSync(() =>
    root.render(
      React.createElement(component, {
        ref,
        present,
        disabled,
        accent,
        onClick: () => {
          clicks += 1;
        },
        onUpdated: () => {
          updated += 1;
        },
      })
    )
  );
  // Deliver props at an explicit callback-safe point; read() must not drive
  // pending presence, disabled or Rule changes while taking its snapshot.
  flushSync(() => ref.current!.invokeInCallbackScope(() => {}));
}
const target = () => host.querySelector<HTMLElement>('[data-pui-root]');
render();
(window as unknown as Record<string, unknown>).presentationProbe = {
  ready() {
    held ??= ref.current?.getExposes() ?? null;
    return Boolean(held?.count && target());
  },
  step(value: string) {
    step = value;
  },
  setLater(value: boolean) {
    flushSync(() => ref.current!.getExposes().setLater(value));
  },
  setPresent(value: boolean) {
    if (!value) oldTarget = target();
    present = value;
    render();
  },
  setDisabled(value: boolean) {
    disabled = value;
    render();
  },
  setAccent(value: boolean) {
    accent = value;
    render();
  },
  dispose() {
    oldTarget = target();
    flushSync(() => root.unmount());
    disposed = true;
  },
  read() {
    const node = target();
    const child = node?.querySelector<HTMLElement>('span') ?? null;
    const box = node?.getBoundingClientRect();
    const childBox = child?.getBoundingClientRect();
    const css = node ? getComputedStyle(node) : null;
    const childCss = child ? getComputedStyle(child) : null;
    const hit = box
      ? document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      : null;
    return {
      present: Boolean(node),
      disposed,
      refCleared: ref.current === null,
      clicks,
      updated,
      count: disposed ? null : held!.count.get(),
      later: disposed ? null : held!.later.get(),
      pressed: disposed ? null : held!.pressed.get(),
      focused: disposed ? null : held!.focused.get(),
      disabled: disposed ? null : held!.disabled.get(),
      sameHandles:
        !disposed &&
        held!.count === ref.current!.getExposes().count &&
        held!.setLater === ref.current!.getExposes().setLater,
      rootCount: host.querySelectorAll('[data-pui-root]').length,
      rootTokens: node?.getAttribute('data-pui-style')?.split(/\s+/).filter(Boolean).sort() ?? [],
      childTokens: (child?.getAttribute('data-pui-style') ?? child?.className ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .sort(),
      childProjection: child?.hasAttribute('data-pui-style')
        ? 'data-pui-style'
        : child?.className
          ? 'class'
          : null,
      text: node?.textContent ?? null,
      width: box?.width ?? null,
      height: box?.height ?? null,
      background: css?.backgroundColor ?? null,
      opacity: css?.opacity ?? null,
      childBackground: childCss?.backgroundColor ?? null,
      childPadding: childCss?.padding ?? null,
      childInsideRoot: Boolean(
        box &&
        childBox &&
        childBox.x >= box.x &&
        childBox.right <= box.right &&
        childBox.y >= box.y &&
        childBox.bottom <= box.bottom
      ),
      centerHitOwned: Boolean(node && hit && node.contains(hit)),
      centerHitIsChild: hit === child,
      active: document.activeElement === node,
      activeId: (document.activeElement as HTMLElement | null)?.id ?? null,
      oldTargetConnected: oldTarget?.isConnected ?? false,
      replacedTarget: Boolean(node && oldTarget && node !== oldTarget),
      scrollY: window.scrollY,
      inputs: [...inputs],
    };
  },
};
