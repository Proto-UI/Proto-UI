import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

type OpenRequest = { open: boolean; reason: 'pointer' | 'keyboard' | 'programmatic' };

function disclosure(
  ref: string,
  label: string,
  props: Record<string, unknown> = {},
  keepMounted = false
): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'base-collapsible-root',
    ref,
    props,
    className: 'rounded border p-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-collapsible-trigger',
        className: 'inline-block rounded border px-3 py-2 cursor-pointer select-none',
        children: [label],
      },
      {
        kind: 'proto',
        prototypeId: 'base-collapsible-content',
        props: { keepMounted },
        className: 'mt-3 text-sm',
        children: [
          'Content has no automatic role or focus entry. Close and reopen this disclosure.',
        ],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-lg gap-3',
    children: [
      disclosure('uncontrolled', 'Uncontrolled · default L1 detach'),
      disclosure('retained', 'defaultOpen · keepMounted', { defaultOpen: true }, true),
      disclosure('disabled', 'Disabled · stays open', { defaultOpen: true, disabled: true }),
      disclosure('controlled', 'Controlled · request only', { open: false }),
      {
        kind: 'box',
        ref: 'requestStatus',
        attrs: { 'aria-live': 'polite' },
        className: 'text-sm',
        children: ['No pending request. Controlled content stays closed until accepted.'],
      },
      {
        kind: 'proto',
        prototypeId: 'base-button',
        ref: 'accept',
        props: {},
        className: 'inline-block rounded border px-3 py-2 cursor-pointer select-none',
        children: ['Accept pending controlled request'],
      },
    ],
  },
  setup({ refs, api }) {
    let open = false;
    let pending: OpenRequest | null = null;
    const propose = (request: OpenRequest) => {
      pending = request;
      refs.requestStatus.textContent = `Requested ${request.open ? 'open' : 'closed'} (${request.reason}); owner has not accepted it.`;
    };
    const setControlledProps = () => api.setProps('controlled', { open, onOpenChange: propose });
    const accept = () => {
      if (!pending) return;
      open = pending.open;
      pending = null;
      setControlledProps();
      refs.requestStatus.textContent = `Owner accepted: ${open ? 'open' : 'closed'}.`;
    };
    setControlledProps();
    api.setProps('accept', { onClick: accept });

    // WC exposes CustomEvents; React/Vue invoke the callback props above.
    const onRequest = (event: Event) => {
      if (event instanceof CustomEvent) propose(event.detail as OpenRequest);
    };
    const onAccept = (event: Event) => {
      if (event instanceof CustomEvent) accept();
    };
    refs.controlled.addEventListener('openChange', onRequest);
    refs.accept.addEventListener('click', onAccept);
    return () => {
      refs.controlled.removeEventListener('openChange', onRequest);
      refs.accept.removeEventListener('click', onAccept);
    };
  },
} satisfies DemoSpec;
