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
    prototypeId: 'liquid-glass-collapsible-root',
    ref,
    props,
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-collapsible-trigger',
        children: [label],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-collapsible-content',
        props: { keepMounted },
        children: [
          'Content has no automatic role or focus entry. Close and reopen this disclosure. Long text stays readable: DisclosuresPreserveTheirOwnStateAcrossRepeatedOpeningAndClosingWithoutClippingLongWords.',
        ],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full min-w-0 max-w-lg gap-5 p-2',
    children: [
      disclosure(
        'uncontrolled',
        'Uncontrolled · default L1 detach · a long disclosure label that wraps safely within the available width'
      ),
      disclosure('retained', 'defaultOpen · keepMounted', { defaultOpen: true }, true),
      disclosure('disabled', 'Disabled · stays open', { defaultOpen: true, disabled: true }),
      disclosure('controlled', 'Controlled · request only', { open: false }),
      {
        kind: 'box',
        ref: 'requestStatus',
        attrs: { 'aria-live': 'polite' },
        className: 'text-sm break-words',
        children: ['No pending request. Controlled content stays closed until accepted.'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-button',
        ref: 'accept',
        props: {},
        children: ['Accept'],
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
