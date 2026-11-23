/** Actual authored Bootstrap parts through the same four public Demo renderers. */
import * as collapsible from '../../../packages/prototypes/bootstrap-2-3-2/src/collapsible';
import * as accordion from '../../../packages/prototypes/bootstrap-2-3-2/src/accordion';
import { renderDemo } from '../../../apps/www/src/components/PrototypePreviewer/demo-renderer';
import { registerPrototype } from '../../../apps/www/src/components/PrototypePreviewer/registry';
import type {
  DemoNode,
  DemoChild,
  DemoRuntimeApi,
  DemoRenderResult,
} from '../../../apps/www/src/components/PrototypePreviewer/demo-types';
import type { RuntimeId } from '../../../apps/www/src/components/PrototypePreviewer/runtimes/ids';
for (const library of [collapsible, accordion])
  for (const value of Object.values(library))
    if (value && typeof value === 'object' && 'setup' in value)
      registerPrototype(value.name, value);

let view: DemoRenderResult | undefined;
let api: DemoRuntimeApi | undefined;
let kind: 'collapsible' | 'accordion';
let requests: unknown[] = [];
let formerBody: Element | null = null;
let formerOwner: unknown;
const find = (ref: string) => document.querySelector<HTMLElement>(`[data-demo-ref="${ref}"]`);
export async function flush() {
  for (let i = 0; i < 24; i++) await Promise.resolve();
}
export async function settle() {
  await flush();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
const node = (
  part: string,
  ref: string,
  props: Record<string, unknown>,
  children: DemoChild[] = []
): DemoNode => ({
  kind: 'proto',
  prototypeId: `bootstrap-2-3-2-${kind}-${part}`,
  ref,
  props,
  children,
});
const copy = (rows: number): DemoNode => ({
  kind: 'box',
  className: 'collapse-copy',
  children: Array.from({ length: rows }, (_, i) => ({
    kind: 'box' as const,
    children: [`Line ${i + 1} — authored disclosure content`],
  })),
});
export async function mount(
  runtime: RuntimeId,
  nextKind: typeof kind,
  options: { controlled?: boolean; initialOpen?: boolean; keepMounted?: boolean } = {}
) {
  await dispose();
  kind = nextKind;
  requests = [];
  const open = !!options.initialOpen;
  const props =
    kind === 'collapsible'
      ? { [options.controlled ? 'open' : 'defaultOpen']: open }
      : { [options.controlled ? 'openItems' : 'defaultOpenItems']: open ? ['first'] : [] };
  const trigger = node('trigger', 'trigger', {}, ['Toggle content']);
  const content = node('content', 'content', { keepMounted: !!options.keepMounted }, [
    {
      kind: 'box',
      ref: 'body',
      children: [
        copy(6),
        { kind: 'box', ref: 'growth', dynamicChildren: { prototypeIds: [] }, children: [] },
      ],
    },
  ]);
  const children =
    kind === 'collapsible'
      ? [trigger, content]
      : [
          node('item', 'item', { value: 'first' }, [
            node('heading', 'heading', {}, [trigger]),
            content,
          ]),
        ];
  view = await renderDemo({
    runtime,
    host: document.querySelector<HTMLElement>('#fixture')!,
    demo: {
      type: 'demo',
      root: node('root', 'root', props, children),
      setup(context) {
        api = context.api;
        api.setProps('root', { onOpenChange: (value: unknown) => requests.push(value) });
      },
    },
  });
  await settle();
  formerBody = find('body');
  formerOwner = api?.getPublicInstance?.('content');
}
export function read(ref: string, path: string) {
  return api?.call(ref, path);
}
export async function accept(open: boolean) {
  api?.setProps('root', kind === 'collapsible' ? { open } : { openItems: open ? ['first'] : [] });
  await flush();
}
export async function grow(rows: number) {
  if (find('growth'))
    await api?.setChildren?.(
      'growth',
      rows > 6 ? [{ key: `rows-${rows}`, node: copy(rows - 6) }] : []
    );
  await flush();
}
export async function keepMounted(value: boolean) {
  api?.setProps('content', { keepMounted: value });
  await flush();
}
export async function spoofChildOpen(value: boolean) {
  api?.setProps('content', { open: value });
  await flush();
}
export function remember() {
  formerBody = find('body');
  formerOwner = api?.getPublicInstance?.('content');
}
export function snapshot() {
  const content = find('content');
  const body = find('body');
  return {
    time: performance.now(),
    height: content?.getBoundingClientRect().height ?? 0,
    naturalContent: find('body')?.getBoundingClientRect().height ?? 0,
    size: content?.style.getPropertyValue('block-size') ?? '',
    overflow: content?.style.overflow ?? '',
    hidden: read('content', 'hidden.get'),
    open: read('content', 'open.get'),
    phase: read('content', 'transitionState.get'),
    bodyPresent: !!body,
    bodyVisible: body?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) ?? false,
    bodySame: body === formerBody,
    viewDetached: content?.hasAttribute('data-pui-view-detached') ?? false,
    controls: find('trigger')?.getAttribute('aria-controls') ?? null,
    ownerSame: api?.getPublicInstance?.('content') === formerOwner,
    requests: requests.slice(),
  };
}
let trace: ReturnType<typeof snapshot>[] = [],
  recording = false;
export function startTrace() {
  trace = [snapshot()];
  recording = true;
  const frame = () => {
    if (!recording) return;
    trace.push(snapshot());
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
export function stopTrace() {
  recording = false;
  trace.push(snapshot());
  return trace.slice();
}
export async function dispose() {
  recording = false;
  const content = find('content');
  await view?.destroy();
  view = undefined;
  api = undefined;
  await flush();
  return {
    children: document.querySelector('#fixture')?.childElementCount ?? 0,
    oldSize: content?.style.getPropertyValue('block-size') ?? '',
    oldOverflow: content?.style.overflow ?? '',
    oldConnected: content?.isConnected ?? false,
  };
}
