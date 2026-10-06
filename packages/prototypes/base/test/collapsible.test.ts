import { describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { definePrototype } from '@proto.ui/core';
import { createRuntimeSession } from '@proto.ui/runtime';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
  type AnatomyPort,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import {
  COLLAPSIBLE_CONTEXT,
  COLLAPSIBLE_FAMILY,
  asCollapsibleContent,
  asCollapsibleRoot,
  asCollapsibleTrigger,
  collapsibleContent,
  collapsibleRoot,
  collapsibleTrigger,
} from '../src/collapsible';

for (const [role, prototype] of [
  ['root', collapsibleRoot],
  ['trigger', collapsibleTrigger],
  ['content', collapsibleContent],
] as const) {
  AdaptToWebComponent(prototype, { registerAs: `x-collapsible-base-${role}` });
}

const InspectionRoot = definePrototype({
  name: 'x-collapsible-inspection-root',
  setup(def) {
    asCollapsibleRoot();
    let owner: any;
    def.lifecycle.onCreated((run) => {
      owner = run;
    });
    def.expose.method(
      'partCount',
      (role: string) => owner.anatomy.partsOf(COLLAPSIBLE_FAMILY, role).length
    );
    def.expose.method('contextOpen', () => owner.context.read(COLLAPSIBLE_CONTEXT).open);
  },
});
AdaptToWebComponent(InspectionRoot);

async function flush() {
  for (let index = 0; index < 8; index++) await Promise.resolve();
}

async function until(predicate: () => boolean) {
  for (let index = 0; index < 20; index++) {
    await flush();
    if (predicate()) return;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  throw new Error('Collapsible consumer did not reach the expected committed state.');
}

function fixture(
  rootProps: Record<string, unknown> = {},
  contentProps: Record<string, unknown> = {},
  rootName = 'x-collapsible-base-root'
) {
  const root = document.createElement(rootName) as any;
  const trigger = document.createElement('x-collapsible-base-trigger') as any;
  const content = document.createElement('x-collapsible-base-content') as any;
  const requests: Array<{ open: boolean; reason: string }> = [];
  root.addEventListener('openChange', (event: Event) => {
    requests.push((event as CustomEvent).detail);
  });
  setElementProps(root, rootProps);
  setElementProps(content, contentProps);
  trigger.textContent = 'Disclosure';
  content.textContent = 'Inline content';
  root.append(trigger, content);
  return { root, trigger, content, requests };
}

describe('Base Collapsible consumer contract', () => {
  it('commits uncontrolled requests, initializes defaultOpen once and emits no synchronization events', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-UNCONTROLLED
    const { root, trigger, content, requests } = fixture({ defaultOpen: true });
    try {
      document.body.append(root);
      await until(() => trigger.getAttribute('aria-expanded') === 'true');
      expect(requests).toEqual([]);
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await until(() => trigger.getAttribute('aria-expanded') === 'false');
      expect(root.getExposes().open.get()).toBe(false);
      expect(content.getExposes().hidden.get()).toBe(true);
      expect(requests).toEqual([{ open: false, reason: 'pointer' }]);

      setElementProps(root, { defaultOpen: false });
      setElementProps(root, { defaultOpen: true });
      await flush();
      expect(root.getExposes().open.get()).toBe(false);
      expect(requests).toHaveLength(1);

      root.getExposes().openCollapsible();
      await until(() => trigger.getAttribute('aria-expanded') === 'true');
      root.getExposes().openCollapsible();
      expect(requests).toEqual([
        { open: false, reason: 'pointer' },
        { open: true, reason: 'programmatic' },
      ]);
    } finally {
      root.remove();
      await flush();
    }
  });

  it('keeps controlled expansion and presence canonical until the owner accepts a request', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-CONTROLLED
    const { root, trigger, content, requests } = fixture({ open: false, defaultOpen: true });
    try {
      document.body.append(root);
      await until(() => trigger.getAttribute('aria-expanded') === 'false');
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      root.getExposes().toggle();
      await flush();
      expect(requests).toEqual([
        { open: true, reason: 'pointer' },
        { open: true, reason: 'programmatic' },
      ]);
      expect(root.getExposes().open.get()).toBe(false);
      expect(trigger.getExposes().expanded.get()).toBe(false);
      expect(content.getExposes().open.get()).toBe(false);
      expect(trigger.hasAttribute('aria-controls')).toBe(false);

      setElementProps(root, { open: true, defaultOpen: true });
      await until(() => !!trigger.getAttribute('aria-controls'));
      root.getExposes().close();
      await flush();
      expect(root.getExposes().open.get()).toBe(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(content.getExposes().hidden.get()).toBe(false);
      expect(requests).toHaveLength(3);
      expect(requests[2]).toEqual({ open: false, reason: 'programmatic' });
      setElementProps(root, { open: false });
      await until(() => !trigger.hasAttribute('aria-controls'));
      expect(requests).toHaveLength(3);
    } finally {
      root.remove();
      await flush();
    }
  });

  it('keeps every part canonical when the owner accepts synchronously inside openChange', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-CONTROLLED: nested owner acceptance.
    const { root, trigger, content, requests } = fixture({ open: false });
    root.addEventListener('openChange', (event: Event) => {
      setElementProps(root, { open: (event as CustomEvent).detail.open });
    });
    try {
      document.body.append(root);
      await until(() => trigger.tabIndex === 0);
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
      expect(root.getExposes().open.get()).toBe(true);
      expect(trigger.getExposes().expanded.get()).toBe(true);
      expect(content.getExposes().open.get()).toBe(true);
      expect(content.getExposes().hidden.get()).toBe(false);
      await until(() => trigger.getAttribute('aria-controls') === content.id && !!content.id);
      root.getExposes().close();
      await flush();
      expect(root.getExposes().open.get()).toBe(false);
      expect(trigger.getExposes().expanded.get()).toBe(false);
      expect(content.getExposes().open.get()).toBe(false);
      await until(() => !trigger.hasAttribute('aria-controls'));
      expect(requests).toEqual([
        { open: true, reason: 'pointer' },
        { open: false, reason: 'programmatic' },
      ]);
    } finally {
      root.remove();
      await flush();
    }
  });

  it('reconciles reused parts with the new domain instead of retaining the former Root facts', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-DOMAIN-ISOLATION: live logical reuse.
    const source = fixture({ defaultOpen: true });
    const destination = fixture({ open: false, disabled: true });
    const host = document.createElement('div');
    host.append(source.root, destination.root);
    try {
      document.body.append(host);
      await until(() => source.trigger.getAttribute('aria-expanded') === 'true');
      destination.trigger.remove();
      destination.content.remove();
      await flush();
      destination.root.append(source.trigger, source.content);
      await flush();
      expect(source.root.getExposes().open.get()).toBe(true);
      expect(destination.root.getExposes().open.get()).toBe(false);
      expect(source.trigger.getExposes().expanded.get()).toBe(false);
      expect(source.trigger.getExposes().disabled.get()).toBe(true);
      expect(source.trigger.tabIndex).toBe(-1);
      expect(source.content.getExposes().open.get()).toBe(false);
      expect(source.content.getExposes().hidden.get()).toBe(true);
      await until(() => !source.trigger.hasAttribute('aria-controls'));
      setElementProps(destination.root, { open: true, disabled: false });
      await until(() => !!source.trigger.getAttribute('aria-controls'));
      expect(source.trigger.getAttribute('aria-controls')).toBe(source.content.id);
      expect(source.trigger.tabIndex).toBe(0);
      expect(source.requests).toEqual([]);
      expect(destination.requests).toEqual([]);
    } finally {
      host.remove();
      await flush();
    }
  });

  it('withdraws a Trigger moved outside all Proto ancestors from its former logical domain', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-DOMAIN-ISOLATION
    const source = fixture({ defaultOpen: true }, {}, InspectionRoot.name);
    const outside = document.createElement('div');
    const host = document.createElement('div');
    host.append(source.root, outside);
    try {
      document.body.append(host);
      await until(() => !!source.trigger.getAttribute('aria-controls'));
      const expanded = source.trigger.getExposes().expanded;
      expect(source.root.getExposes().partCount('trigger')).toBe(1);
      expect(() => outside.append(source.trigger)).toThrowError(
        expect.objectContaining({ code: 'ANATOMY_CLAIM_INVALID' })
      );
      await flush();
      expect(source.root.getExposes().partCount('trigger')).toBe(0);
      expect(source.trigger.hasAttribute('aria-controls')).toBe(false);
      expect(source.trigger.getExposes().expanded).toBe(expanded);
      expect(source.root.getExposes().open.get()).toBe(true);
      expect(source.requests).toEqual([]);
    } finally {
      host.remove();
      await flush();
    }
  });

  it('preserves accepted Trigger membership after rejection and permits a later valid adoption', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-ANATOMY-CARDINALITY: reuse is not creation.
    const source = fixture({}, {}, InspectionRoot.name);
    const destination = fixture({}, {}, InspectionRoot.name);
    const host = document.createElement('div');
    host.append(source.root, destination.root);
    try {
      document.body.append(host);
      await until(() => source.trigger.tabIndex === 0 && destination.trigger.tabIndex === 0);
      const expanded = source.trigger.getExposes().expanded;
      expect(() => destination.root.append(source.trigger)).toThrowError(
        expect.objectContaining({ code: 'COLLAPSIBLE_DUPLICATE_PART' })
      );
      await flush();
      expect(source.root.getExposes().partCount('trigger')).toBe(1);
      expect(destination.root.getExposes().partCount('trigger')).toBe(1);
      expect(source.trigger.getExposes().expanded).toBe(expanded);
      expect(source.requests.concat(destination.requests)).toEqual([]);

      destination.trigger.remove();
      await flush();
      destination.root.append(source.trigger);
      await until(() => source.trigger.tabIndex === 0);
      expect(source.root.getExposes().partCount('trigger')).toBe(0);
      expect(destination.root.getExposes().partCount('trigger')).toBe(1);
      source.trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await until(() => expanded.get());
      expect(source.root.getExposes().open.get()).toBe(false);
      expect(destination.root.getExposes().open.get()).toBe(true);
      expect(destination.requests).toEqual([{ open: true, reason: 'pointer' }]);
      expect(source.requests).toEqual([]);
    } finally {
      source.trigger.remove();
      host.remove();
      await flush();
    }
  });

  it('wakes a detached reused Content when its new Root is already open', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-L1-LIFECYCLE: no mounted update can wake this view.
    const source = fixture();
    const destination = fixture({ defaultOpen: true });
    const host = document.createElement('div');
    host.append(source.root, destination.root);
    try {
      document.body.append(host);
      await until(() => !!destination.trigger.getAttribute('aria-controls'));
      const logicalOpen = source.content.getExposes().open;
      expect(logicalOpen.get()).toBe(false);
      destination.content.remove();
      await flush();
      destination.root.append(source.content);
      await until(
        () =>
          destination.trigger.getAttribute('aria-controls') === source.content.id &&
          !!source.content.id
      );
      expect(source.content.getExposes().open).toBe(logicalOpen);
      expect(logicalOpen.get()).toBe(true);
      expect(source.content.getExposes().hidden.get()).toBe(false);
      expect(source.root.getExposes().open.get()).toBe(false);
      expect(source.trigger.hasAttribute('aria-controls')).toBe(false);
      expect(source.requests).toEqual([]);
      expect(destination.requests).toEqual([]);
    } finally {
      host.remove();
      await flush();
    }
  });

  it('restores accepted Content membership after a rejected adoption without replacing its identity', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-ANATOMY-CARDINALITY: Content has its own lifetime.
    const source = fixture({ defaultOpen: true }, {}, InspectionRoot.name);
    const destination = fixture({}, {}, InspectionRoot.name);
    const host = document.createElement('div');
    host.append(source.root, destination.root);
    try {
      document.body.append(host);
      await until(
        () =>
          !!source.trigger.getAttribute('aria-controls') &&
          destination.content.hasAttribute('data-pui-view-detached')
      );
      const open = source.content.getExposes().open;
      expect(() => destination.root.append(source.content)).toThrowError(
        expect.objectContaining({ code: 'COLLAPSIBLE_DUPLICATE_PART' })
      );
      await flush();
      expect(source.root.getExposes().partCount('content')).toBe(1);
      expect(destination.root.getExposes().partCount('content')).toBe(1);
      expect(source.content.getExposes().open).toBe(open);
      expect(open.get()).toBe(true);
      expect(destination.content.getExposes().open.get()).toBe(false);
      expect(source.requests.concat(destination.requests)).toEqual([]);

      destination.content.remove();
      await flush();
      destination.root.append(source.content);
      await until(() => !open.get());
      expect(source.root.getExposes().partCount('content')).toBe(0);
      expect(destination.root.getExposes().partCount('content')).toBe(1);
      expect(source.content.getExposes().open).toBe(open);
      destination.root.getExposes().openCollapsible();
      await until(() => destination.trigger.getAttribute('aria-controls') === source.content.id);
      expect(open.get()).toBe(true);
      expect(destination.requests).toEqual([{ open: true, reason: 'programmatic' }]);
      expect(source.requests).toEqual([]);
    } finally {
      source.content.remove();
      host.remove();
      await flush();
    }
  });

  it('suppresses disabled requests and focus without rewriting open or blocking controlled input', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-DISABLED
    const { root, trigger, content, requests } = fixture({ open: true, disabled: true });
    try {
      document.body.append(root);
      await until(() => trigger.getAttribute('aria-disabled') === 'true');
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      root.getExposes().close();
      root.getExposes().toggle();
      expect(root.getExposes().open.get()).toBe(true);
      expect(content.getExposes().open.get()).toBe(true);
      expect(trigger.tabIndex).toBe(-1);
      expect(requests).toEqual([]);

      setElementProps(root, { open: false, disabled: true });
      await until(() => trigger.getAttribute('aria-expanded') === 'false');
      expect(requests).toEqual([]);
      setElementProps(trigger, { disabled: true });
      setElementProps(root, { open: false, disabled: false });
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(requests).toEqual([]);
      expect(trigger.tabIndex).toBe(-1);
      setElementProps(trigger, { disabled: false });
      await until(() => trigger.tabIndex === 0);
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(requests).toEqual([{ open: true, reason: 'pointer' }]);
      expect(root.getExposes().open.get()).toBe(false);
    } finally {
      root.remove();
      await flush();
    }
  });

  it('preserves settled focus admission across both disabled-observer owner reversals', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-DISABLED: notification cannot restore stale Focus policy.
    const { root, trigger, content, requests } = fixture({ open: true, disabled: true });
    let off: (() => void) | undefined;
    try {
      document.body.append(root);
      await until(() => trigger.getExposes().disabled.get() && trigger.tabIndex === -1);
      let disabledRestorations = 0;
      off = trigger.getExposes().disabled.subscribe((event: any) => {
        if (event.type === 'next' && event.next === false && disabledRestorations === 0) {
          disabledRestorations++;
          setElementProps(root, { open: true, disabled: true });
        }
      });
      setElementProps(root, { open: true, disabled: false });
      await flush();
      expect(disabledRestorations).toBe(1);
      expect(trigger.getExposes().disabled.get()).toBe(true);
      expect(trigger.tabIndex).toBe(-1);
      trigger.getExposes().focusSelf({ preventScroll: true });
      await flush();
      expect(document.activeElement).not.toBe(trigger);
      expect(root.getExposes().open.get()).toBe(true);
      expect(content.getExposes().open.get()).toBe(true);
      expect(requests).toEqual([]);
      off?.();
      off = undefined;

      setElementProps(root, { open: true, disabled: false });
      await until(() => trigger.tabIndex === 0);
      let enabledRestorations = 0;
      off = trigger.getExposes().disabled.subscribe((event: any) => {
        if (event.type === 'next' && event.next === true && enabledRestorations === 0) {
          enabledRestorations++;
          setElementProps(root, { open: true, disabled: false });
        }
      });
      setElementProps(root, { open: true, disabled: true });
      await flush();
      expect(enabledRestorations).toBe(1);
      expect(trigger.getExposes().disabled.get()).toBe(false);
      expect(trigger.tabIndex).toBe(0);
      trigger.getExposes().focusSelf({ preventScroll: true });
      await flush();
      expect(document.activeElement).toBe(trigger);
      expect(root.getExposes().open.get()).toBe(true);
      expect(content.getExposes().open.get()).toBe(true);
      expect(requests).toEqual([]);
    } finally {
      off?.();
      root.remove();
      await flush();
    }
  });

  it('keeps a newer reentrant request canonical when an older Trigger resumes context synchronization', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-UNCONTROLLED
    // T-BASE-COLLAPSIBLE-0001-CASE-DOMAIN-ISOLATION
    const source = fixture();
    const destination = fixture({ disabled: true }, {}, InspectionRoot.name);
    const host = document.createElement('div');
    let off: (() => void) | undefined;
    try {
      document.body.append(source.root);
      await until(() => source.trigger.getAttribute('aria-expanded') === 'false');
      host.append(destination.root);
      document.body.append(host);
      await until(() => destination.trigger.getExposes().disabled.get());
      destination.trigger.remove();
      await flush();
      destination.root.append(source.trigger);
      await until(() => source.trigger.getExposes().disabled.get());
      let requestsFromSubscriber = 0;
      off = source.trigger.getExposes().disabled.subscribe((event: any) => {
        if (event.type === 'next' && event.next === false) {
          requestsFromSubscriber++;
          destination.root.getExposes().openCollapsible();
        }
      });
      setElementProps(destination.root, { disabled: false });
      await until(() => destination.requests.length > 0);
      await flush();
      expect(requestsFromSubscriber).toBe(1);
      expect(destination.requests).toEqual([{ open: true, reason: 'programmatic' }]);
      expect(destination.root.getExposes().open.get()).toBe(true);
      expect(destination.root.getExposes().contextOpen()).toBe(true);
      expect(source.trigger.getExposes().expanded.get()).toBe(true);
      expect(destination.content.getExposes().open.get()).toBe(true);
      expect(source.requests).toEqual([]);
    } finally {
      off?.();
      source.trigger.remove();
      source.root.remove();
      host.remove();
      await flush();
    }
  });

  it('signals every accepted nested request without replaying it during later synchronization', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-UNCONTROLLED: signals are requests, not stale truth.
    const source = fixture();
    const destination = fixture({}, {}, InspectionRoot.name);
    const host = document.createElement('div');
    let off: (() => void) | undefined;
    try {
      document.body.append(source.root);
      await until(() => source.trigger.tabIndex === 0);
      host.append(destination.root);
      document.body.append(host);
      await until(() => destination.trigger.tabIndex === 0);
      destination.trigger.remove();
      await flush();
      destination.root.append(source.trigger);
      await until(() => source.trigger.tabIndex === 0);
      let nestedRequests = 0;
      off = source.trigger.getExposes().expanded.subscribe((event: any) => {
        if (event.type === 'next' && event.next === true) {
          nestedRequests++;
          destination.root.getExposes().close();
        }
      });
      source.trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
      expect(nestedRequests).toBe(1);
      // Callback order is not a portable guarantee; neither accepted envelope may disappear.
      expect(destination.requests).toEqual(
        expect.arrayContaining([
          { open: true, reason: 'pointer' },
          { open: false, reason: 'programmatic' },
        ])
      );
      expect(destination.requests).toHaveLength(2);
      expect(destination.root.getExposes().open.get()).toBe(false);
      expect(destination.root.getExposes().contextOpen()).toBe(false);
      expect(source.trigger.getExposes().expanded.get()).toBe(false);
      expect(destination.content.getExposes().open.get()).toBe(false);
      off?.();
      off = undefined;

      setElementProps(destination.root, { disabled: true });
      await flush();
      setElementProps(destination.root, { disabled: false });
      await flush();
      expect(destination.requests).toHaveLength(2);
      destination.root.getExposes().openCollapsible();
      await until(() => destination.content.getExposes().open.get());
      expect(destination.requests).toHaveLength(3);
      expect(destination.requests[2]).toEqual({ open: true, reason: 'programmatic' });
      expect(destination.root.getExposes().open.get()).toBe(true);
      expect(destination.root.getExposes().contextOpen()).toBe(true);
      expect(source.trigger.getExposes().expanded.get()).toBe(true);
      expect(source.requests).toEqual([]);
    } finally {
      off?.();
      source.trigger.remove();
      source.root.remove();
      host.remove();
      await flush();
    }
  });

  it('preserves accepted disclosure and future request signals across reentrant disabled props', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-UNCONTROLLED
    // T-BASE-COLLAPSIBLE-0001-CASE-DISABLED: synchronization cannot undo an accepted request.
    const source = fixture();
    const destination = fixture({}, {}, InspectionRoot.name);
    const host = document.createElement('div');
    let off: (() => void) | undefined;
    try {
      document.body.append(source.root);
      await until(() => source.trigger.tabIndex === 0);
      host.append(destination.root);
      document.body.append(host);
      await until(() => destination.trigger.tabIndex === 0);
      destination.trigger.remove();
      await flush();
      destination.root.append(source.trigger);
      await until(() => source.trigger.tabIndex === 0);
      let propUpdates = 0;
      off = source.trigger.getExposes().expanded.subscribe((event: any) => {
        if (event.type === 'next' && event.next === true) {
          propUpdates++;
          setElementProps(destination.root, { disabled: true });
        }
      });
      source.trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
      expect(propUpdates).toBe(1);
      expect(destination.root.getExposes().open.get()).toBe(true);
      expect(destination.root.getExposes().contextOpen()).toBe(true);
      expect(source.trigger.getExposes().expanded.get()).toBe(true);
      expect(source.trigger.getExposes().disabled.get()).toBe(true);
      expect(source.trigger.tabIndex).toBe(-1);
      expect(destination.content.getExposes().open.get()).toBe(true);
      expect(destination.requests).toEqual([{ open: true, reason: 'pointer' }]);
      destination.root.getExposes().close();
      expect(destination.requests).toEqual([{ open: true, reason: 'pointer' }]);
      off?.();
      off = undefined;

      setElementProps(destination.root, { disabled: false });
      await flush();
      expect(destination.requests).toEqual([{ open: true, reason: 'pointer' }]);
      destination.root.getExposes().close();
      await until(() => !destination.content.getExposes().open.get());
      destination.root.getExposes().openCollapsible();
      await until(() => destination.content.getExposes().open.get());
      expect(destination.root.getExposes().open.get()).toBe(true);
      expect(destination.root.getExposes().contextOpen()).toBe(true);
      expect(source.trigger.getExposes().expanded.get()).toBe(true);
      expect(destination.requests).toEqual([
        { open: true, reason: 'pointer' },
        { open: false, reason: 'programmatic' },
        { open: true, reason: 'programmatic' },
      ]);
      expect(source.requests).toEqual([]);
    } finally {
      off?.();
      source.trigger.remove();
      source.root.remove();
      host.remove();
      await flush();
    }
  });

  it('uses one Enter/Space activation route and does not add roving or content focus', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-ACTIVATION
    const { root, trigger, content, requests } = fixture();
    try {
      document.body.append(root);
      await until(() => trigger.tabIndex === 0);
      trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      trigger.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      await until(() => trigger.getAttribute('aria-expanded') === 'true');
      expect(requests).toEqual([{ open: true, reason: 'keyboard' }]);
      expect(document.activeElement).toBe(trigger);
      expect(content.hasAttribute('role')).toBe(false);
      expect(content.hasAttribute('tabindex')).toBe(false);
      for (const key of ['ArrowDown', 'Home', 'End']) {
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      }
      expect(requests).toHaveLength(1);
      const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      trigger.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(true);
      trigger.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
      await until(() => trigger.getAttribute('aria-expanded') === 'false');
      expect(requests).toEqual([
        { open: true, reason: 'keyboard' },
        { open: false, reason: 'keyboard' },
      ]);
      expect(document.activeElement).toBe(trigger);
    } finally {
      root.remove();
      await flush();
    }
  });

  it('withdraws detached controls, restores reserved identity and retains keepMounted content', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-RELATIONSHIP
    // T-BASE-COLLAPSIBLE-0001-CASE-L1-LIFECYCLE
    // T-BASE-COLLAPSIBLE-0001-CASE-KEEP-MOUNTED
    const { root, trigger, content, requests } = fixture({ defaultOpen: true });
    try {
      document.body.append(root);
      await until(() => !!trigger.getAttribute('aria-controls'));
      const identity = content.id;
      const openHandle = content.getExposes().open;
      expect(trigger.getAttribute('aria-controls')).toBe(identity);
      for (let cycle = 0; cycle < 2; cycle++) {
        root.getExposes().close();
        await until(() => !trigger.hasAttribute('aria-controls'));
        expect(openHandle.get()).toBe(false);
        root.getExposes().openCollapsible();
        await until(() => trigger.getAttribute('aria-controls') === identity);
        expect(content.id).toBe(identity);
        expect(content.getExposes().open).toBe(openHandle);
      }
      setElementProps(content, { keepMounted: true });
      root.getExposes().close();
      await until(() => content.getAttribute('aria-hidden') === 'true');
      expect(trigger.getAttribute('aria-controls')).toBe(identity);
      expect(content.textContent).toContain('Inline content');
      expect(content.getExposes().hidden.get()).toBe(true);
      const before = requests.length;
      setElementProps(content, { keepMounted: false });
      await until(() => !trigger.hasAttribute('aria-controls'));
      expect(requests).toHaveLength(before);
    } finally {
      root.remove();
      await flush();
    }
  });

  it('isolates nested and adjacent domains and removes terminal targets before replacement', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-DOMAIN-ISOLATION
    // T-BASE-COLLAPSIBLE-0001-CASE-TERMINAL-CLEANUP
    const outer = fixture({ defaultOpen: true });
    const nested = fixture({ defaultOpen: true });
    const adjacent = fixture({ defaultOpen: true });
    const host = document.createElement('div');
    outer.root.append(nested.root);
    host.append(outer.root, adjacent.root);
    try {
      document.body.append(host);
      await until(() =>
        [outer, nested, adjacent].every((part) => !!part.trigger.getAttribute('aria-controls'))
      );
      const identities = [outer, nested, adjacent].map(({ trigger, content }) => {
        expect(trigger.getAttribute('aria-controls')).toBe(content.id);
        return content.id;
      });
      expect(new Set(identities).size).toBe(3);
      nested.trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
      expect(nested.root.getExposes().open.get()).toBe(false);
      expect(outer.root.getExposes().open.get()).toBe(true);
      expect(adjacent.root.getExposes().open.get()).toBe(true);
      outer.content.remove();
      await until(() => !outer.trigger.hasAttribute('aria-controls'));
      const replacement = document.createElement('x-collapsible-base-content') as any;
      replacement.textContent = 'Replacement content';
      outer.root.append(replacement);
      await until(
        () => outer.trigger.getAttribute('aria-controls') === replacement.id && !!replacement.id
      );
      expect(replacement.getExposes().open.get()).toBe(true);
      const staleToggle = adjacent.root.getExposes().toggle;
      adjacent.root.remove();
      await flush();
      expect(() => staleToggle()).toThrow();
    } finally {
      host.remove();
      await flush();
    }
  });

  it('rejects a second same-domain part without enforcing minimum during construction', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-ANATOMY-CARDINALITY
    const root = document.createElement('x-collapsible-base-root') as any;
    const trigger = document.createElement('x-collapsible-base-trigger');
    const first = document.createElement('x-collapsible-base-content');
    const second = document.createElement('x-collapsible-base-content');
    try {
      document.body.append(root);
      root.append(trigger);
      await flush();
      root.append(first);
      await flush();
      expect(() => root.append(second)).toThrowError(
        expect.objectContaining({ code: 'COLLAPSIBLE_DUPLICATE_PART' })
      );
      second.remove();
    } finally {
      root.remove();
      await flush();
    }
  });

  it('preserves controlled and disabled requests while the same Root view is detached', async () => {
    const Root = definePrototype({
      name: 'x-collapsible-detached-request-root',
      setup(def) {
        asCollapsibleRoot();
        let owner: any;
        def.lifecycle.onCreated((run) => {
          owner = run;
        });
        def.expose.method('present', (present: boolean) => owner.lifecycle.setPresent(present));
      },
    });
    AdaptToWebComponent(Root);
    const { trigger, content, requests } = fixture();
    const root = document.createElement(Root.name) as any;
    root.addEventListener('openChange', (event: Event) => {
      requests.push((event as CustomEvent).detail);
    });
    setElementProps(root, { open: false });
    root.append(trigger, content);
    try {
      document.body.append(root);
      await until(() => trigger.getAttribute('aria-expanded') === 'false');
      const exposes = root.getExposes();
      exposes.present(false);
      await until(() => root.hasAttribute('data-pui-view-detached'));
      exposes.openCollapsible();
      expect(exposes.open.get()).toBe(false);
      exposes.toggle();
      expect(exposes.open.get()).toBe(false);
      expect(requests).toEqual([
        { open: true, reason: 'programmatic' },
        { open: true, reason: 'programmatic' },
      ]);

      setElementProps(root, { open: false, disabled: true });
      exposes.openCollapsible();
      exposes.toggle();
      expect(exposes.open.get()).toBe(false);
      expect(requests).toHaveLength(2);
      exposes.present(true);
      await until(() => !root.hasAttribute('data-pui-view-detached'));
      expect(exposes.open.get()).toBe(false);
    } finally {
      root.remove();
      await flush();
    }
  });

  it('clears held pointer facts before the same Trigger view rematerializes', async () => {
    const Trigger = definePrototype({
      name: 'x-collapsible-detached-transient-trigger',
      setup(def) {
        asCollapsibleTrigger();
        let owner: any;
        def.lifecycle.onCreated((run) => {
          owner = run;
        });
        def.expose.method('present', (present: boolean) => owner.lifecycle.setPresent(present));
      },
    });
    AdaptToWebComponent(Trigger);
    const { root, content } = fixture();
    const trigger = document.createElement(Trigger.name) as any;
    trigger.textContent = 'Repeatable disclosure';
    root.replaceChildren(trigger, content);
    try {
      document.body.append(root);
      await until(() => trigger.tabIndex === 0);
      trigger.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
      const exposes = trigger.getExposes();
      expect(exposes.hovered.get()).toBe(true);
      expect(exposes.pressed.get()).toBe(true);
      exposes.present(false);
      await until(() => trigger.hasAttribute('data-pui-view-detached'));
      expect(exposes.hovered.get()).toBe(false);
      expect(exposes.pressed.get()).toBe(false);
      exposes.present(true);
      await until(() => !trigger.hasAttribute('data-pui-view-detached'));
      expect(trigger.getExposes().hovered.get()).toBe(false);
      expect(trigger.getExposes().pressed.get()).toBe(false);
    } finally {
      root.remove();
      await flush();
    }
  });

  it('rejects an adopted over-maximum composition when the new Root is first created', async () => {
    const first = fixture();
    const second = fixture();
    const destination = document.createElement('x-collapsible-base-root');
    try {
      document.body.append(first.root, second.root);
      await until(
        () =>
          first.trigger.getAttribute('aria-expanded') === 'false' &&
          second.trigger.getAttribute('aria-expanded') === 'false' &&
          first.content.hasAttribute('data-pui-view-detached') &&
          second.content.hasAttribute('data-pui-view-detached')
      );
      // Adopt synchronously, before the existing owners' deferred disposal.
      destination.append(first.trigger, first.content, second.content);
      expect(() => document.body.append(destination)).toThrowError(
        expect.objectContaining({ code: 'COLLAPSIBLE_DUPLICATE_PART' })
      );
    } finally {
      destination.remove();
      first.root.remove();
      second.root.remove();
      await flush();
    }
  });

  it('rebinds a cold-adopted detached Trigger before its view rematerializes', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-DOMAIN-ISOLATION
    // T-BASE-COLLAPSIBLE-0001-CASE-L1-LIFECYCLE
    const Trigger = definePrototype({
      name: 'x-collapsible-cold-adopted-trigger',
      setup(def) {
        asCollapsibleTrigger();
        let owner: any;
        def.lifecycle.onCreated((run) => {
          owner = run;
        });
        def.expose.method('present', (present: boolean) => owner.lifecycle.setPresent(present));
      },
    });
    AdaptToWebComponent(Trigger);
    const source = fixture({ defaultOpen: true, disabled: true });
    const closed = fixture();
    const trigger = document.createElement(Trigger.name) as any;
    source.root.replaceChildren(trigger, source.content);
    const destination = document.createElement('x-collapsible-base-root') as any;
    const destinationRequests: Array<{ open: boolean; reason: string }> = [];
    destination.addEventListener('openChange', (event: Event) => {
      destinationRequests.push((event as CustomEvent).detail);
    });
    const host = document.createElement('div');
    host.append(source.root, closed.root);
    try {
      document.body.append(host);
      await until(
        () =>
          trigger.getAttribute('aria-expanded') === 'true' &&
          trigger.getExposes().disabled.get() &&
          closed.content.hasAttribute('data-pui-view-detached')
      );
      const exposes = trigger.getExposes();
      const expanded = exposes.expanded;
      exposes.present(false);
      await until(() => trigger.hasAttribute('data-pui-view-detached'));
      // Both parts already exist; the new Root starts with its default snapshot.
      destination.append(trigger, closed.content);
      host.append(destination);
      await flush();
      expect(destination.getExposes().open.get()).toBe(false);
      expect(expanded.get()).toBe(false);
      expect(exposes.disabled.get()).toBe(false);
      exposes.present(true);
      await until(() => !trigger.hasAttribute('data-pui-view-detached'));
      expect(trigger.getExposes().expanded).toBe(expanded);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.tabIndex).toBe(0);
      expect(source.requests.concat(closed.requests, destinationRequests)).toEqual([]);
    } finally {
      destination.remove();
      host.remove();
      await flush();
    }
  });

  it('rejects a reused detached Content while its destination Root view is detached', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-ANATOMY-CARDINALITY
    const Root = definePrototype({
      name: 'x-collapsible-detached-max-root',
      setup(def) {
        asCollapsibleRoot();
        let owner: any;
        def.lifecycle.onCreated((run) => {
          owner = run;
        });
        def.expose.method('present', (present: boolean) => owner.lifecycle.setPresent(present));
        def.expose.method(
          'partCount',
          (role: string) => owner.anatomy.partsOf(COLLAPSIBLE_FAMILY, role).length
        );
      },
    });
    AdaptToWebComponent(Root);
    const source = fixture({}, {}, InspectionRoot.name);
    const destination = fixture();
    const root = document.createElement(Root.name) as any;
    root.append(destination.trigger, destination.content);
    const host = document.createElement('div');
    host.append(source.root, root);
    try {
      document.body.append(host);
      await until(
        () =>
          source.content.hasAttribute('data-pui-view-detached') &&
          destination.content.hasAttribute('data-pui-view-detached')
      );
      const retainedOpen = destination.content.getExposes().open;
      root.getExposes().present(false);
      await until(() => root.hasAttribute('data-pui-view-detached'));
      // View withdrawal must not be mistaken for terminal child disposal.
      expect(destination.content.parentElement).toBe(root);
      expect(destination.content.getExposes().open).toBe(retainedOpen);
      expect(() => root.append(source.content)).toThrowError(
        expect.objectContaining({ code: 'COLLAPSIBLE_DUPLICATE_PART' })
      );
      await flush();
      expect(source.root.getExposes().partCount('content')).toBe(1);
      expect(root.getExposes().partCount('content')).toBe(1);
      expect(destination.content.getExposes().open).toBe(retainedOpen);
      root.getExposes().present(true);
      await until(() => !root.hasAttribute('data-pui-view-detached'));
      expect(root.getExposes().partCount('content')).toBe(1);
    } finally {
      source.content.remove();
      host.remove();
      await flush();
    }
  });

  it('reports absent required roles through conformance after actual Runtime mount readiness', async () => {
    const token = {};
    const target = document.createElement('div');
    const session = createRuntimeSession(collapsibleRoot, {
      prototypeName: collapsibleRoot.name,
      getRawProps: () => ({}),
      schedule: (task) => task(),
      commit: (_children, signal) => signal?.done(),
      onRuntimeReady(wiring) {
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, token],
          [ANATOMY_PARENT_CAP, () => null],
          [ANATOMY_GET_PROTO_CAP, () => collapsibleRoot],
          [ANATOMY_ROOT_TARGET_CAP, () => target],
        ]);
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, token],
          [CONTEXT_PARENT_CAP, () => null],
        ]);
      },
    });
    try {
      // The controlled test host acknowledges the real Runtime commit. This
      // is an explicit conformance query, never an all-child completion flag.
      await session.mount();
      expect(session.mountPhase).toBe('mounted');
      const missing = session.caps
        .getPort<AnatomyPort>('anatomy')!
        .getDiagnostics()
        .filter((diagnostic) => diagnostic.code === 'ANATOMY_FAMILY_MIN');
      expect(missing.map((diagnostic) => diagnostic.role).sort()).toEqual(['content', 'trigger']);
      expect(missing.every((diagnostic) => diagnostic.scope === 'family')).toBe(true);
      expect(missing.every((diagnostic) => diagnostic.level === 'error')).toBe(true);
    } finally {
      await session.dispose();
    }
  });

  it('composes all three authored asHooks without inheriting another Base protocol', async () => {
    // T-BASE-COLLAPSIBLE-0001-CASE-AUTHORING-CONSUMER
    // T-BASE-COLLAPSIBLE-0001-CASE-ANATOMY-CARDINALITY: minimum after readiness.
    const Root = definePrototype({
      name: 'x-collapsible-authored-root',
      setup(def) {
        asCollapsibleRoot();
        let run: any;
        def.lifecycle.onCreated((created) => {
          run = created;
        });
        def.expose.method('composition', () =>
          run.anatomy
            .parts(COLLAPSIBLE_FAMILY)
            .map((part: { role: string }) => part.role)
            .sort()
        );
      },
    });
    const Trigger = definePrototype({
      name: 'x-collapsible-authored-trigger',
      setup() {
        asCollapsibleTrigger();
      },
    });
    const Content = definePrototype({
      name: 'x-collapsible-authored-content',
      setup() {
        asCollapsibleContent();
      },
    });
    for (const prototype of [Root, Trigger, Content]) AdaptToWebComponent(prototype);
    const root = document.createElement(Root.name) as any;
    const trigger = document.createElement(Trigger.name) as any;
    const content = document.createElement(Content.name) as any;
    setElementProps(content, { keepMounted: true });
    trigger.textContent = 'Authored disclosure';
    content.textContent = 'Authored content';
    root.append(trigger, content);
    try {
      document.body.append(root);
      await until(() => trigger.tabIndex === 0);
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await until(() => trigger.getAttribute('aria-expanded') === 'true');
      expect(root.getExposes().open.get()).toBe(true);
      expect(content.getExposes().hidden.get()).toBe(false);
      expect(trigger.getAttribute('role')).toBe('button');
      expect(trigger.getAttribute('aria-controls')).toBe(content.id);
      expect(root.getExposes().composition()).toEqual(['content', 'root', 'trigger']);
    } finally {
      root.remove();
      await flush();
    }
  });
});
