import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

type OpenRequest = { open: boolean; reason: 'pointer' | 'keyboard' | 'programmatic' };

function disclosure(
  ref: string,
  label: string,
  body: string,
  props: Record<string, unknown> = {},
  keepMounted = false
): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'bootstrap-2-3-2-collapsible-root',
    ref,
    props,
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-collapsible-trigger',
        children: [label],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-collapsible-content',
        props: { keepMounted },
        children: [body],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full min-w-0 max-w-lg gap-4 p-2',
    children: [
      disclosure(
        'uncontrolled',
        'Order #4189 — Shipping & delivery details',
        '100 Market St, San Francisco, CA · 2x Studio Headphones · Standard Express (estimated arrival Friday).'
      ),
      disclosure(
        'retained',
        'Order summary (2 items)',
        'Studio Headphones (x2) — $398.00 · Free shipping applied. Panel remains mounted while collapsed.',
        { defaultOpen: true },
        true
      ),
      disclosure(
        'disabled',
        'Warranty coverage (locked)',
        '2-year hardware protection is included with this order and stays open while locked.',
        { defaultOpen: true, disabled: true }
      ),
      disclosure(
        'controlled',
        'Billing & invoice details',
        'Paid with Visa ending in 4242 · Invoice #INV-2026-4189 is ready to download.',
        { open: false }
      ),
      {
        kind: 'box',
        className: 'flex flex-wrap items-center justify-between gap-3 pt-1',
        children: [
          {
            kind: 'box',
            ref: 'requestStatus',
            attrs: { 'aria-live': 'polite' },
            className: 'text-sm break-words',
            children: ['Invoice details are collapsed. Select the trigger, then confirm below.'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-button',
            ref: 'accept',
            props: {},
            children: ['Accept'],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    let open = false;
    let pending: OpenRequest | null = null;
    const propose = (request: OpenRequest) => {
      pending = request;
      refs.requestStatus.textContent = `Pending request to ${request.open ? 'expand' : 'collapse'} (${request.reason}). Click Accept to apply.`;
    };
    const setControlledProps = () => api.setProps('controlled', { open, onOpenChange: propose });
    const accept = () => {
      if (!pending) return;
      open = pending.open;
      pending = null;
      setControlledProps();
      refs.requestStatus.textContent = `Invoice details are now ${open ? 'expanded' : 'collapsed'}.`;
    };
    setControlledProps();
    api.setProps('accept', { onClick: accept });
  },
} satisfies DemoSpec;
