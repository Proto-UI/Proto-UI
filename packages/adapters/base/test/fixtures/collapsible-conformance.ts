import { describe, expect, it } from 'vitest';
import { definePrototype, type Prototype, type RunHandle } from '@proto.ui/core';
import {
  COLLAPSIBLE_FAMILY,
  asCollapsibleContent,
  asCollapsibleRoot,
  asCollapsibleTrigger,
} from '../../../../prototypes/base/src/collapsible';

export type CollapsibleTree = {
  key: string;
  proto: Prototype<any>;
  props: Record<string, unknown>;
  children?: CollapsibleTree[];
  onOpenChange?: (request: { open: boolean; reason: string }) => void;
};

export type CollapsibleMount = {
  host: HTMLElement;
  exposes(key: string): Record<string, any>;
  flush(action?: () => void): Promise<void>;
  click(target: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
};

export type CollapsibleDriver = (tree: CollapsibleTree[]) => Promise<CollapsibleMount>;
export type CollapsibleProjection = {
  collapsibleRoot: Prototype<any, any>;
  collapsibleTrigger: Prototype<any, any>;
  collapsibleContent: Prototype<any, any>;
};
let nextId = 0;

function createRecipe(
  name: string,
  props: Record<string, unknown> = {},
  keepMounted = false,
  projection?: CollapsibleProjection
) {
  const prefix = `collapsible-${name.replaceAll('/', '-')}-${++nextId}`;
  const requests: Array<{ open: boolean; reason: string }> = [];
  const lifecycle = { created: 0, mounted: 0, unmounted: 0, disposed: 0 };
  let rootRun!: RunHandle<any>;
  const root = definePrototype({
    name: `${prefix}-root`,
    setup(def) {
      if (projection) projection.collapsibleRoot.setup(def);
      else asCollapsibleRoot();
      def.lifecycle.onCreated((run) => {
        rootRun = run;
      });
      def.expose.method('composition', () =>
        rootRun.anatomy
          .parts(COLLAPSIBLE_FAMILY)!
          .map((part) => part.role)
          .sort()
      );
      return (renderer) => [renderer.el('span', `${prefix}-root`), renderer.slot()];
    },
  });
  const trigger = definePrototype({
    name: `${prefix}-trigger`,
    setup(def) {
      if (projection) projection.collapsibleTrigger.setup(def);
      else asCollapsibleTrigger();
      return (renderer) => [renderer.el('span', `${prefix}-trigger`), renderer.slot()];
    },
  });
  const content = definePrototype({
    name: `${prefix}-content`,
    setup(def) {
      if (projection) projection.collapsibleContent.setup(def);
      else asCollapsibleContent();
      def.lifecycle.onCreated(() => {
        lifecycle.created += 1;
      });
      def.lifecycle.onMounted(() => {
        lifecycle.mounted += 1;
      });
      def.lifecycle.onUnmounted(() => {
        lifecycle.unmounted += 1;
      });
      def.lifecycle.onBeforeDispose(() => {
        lifecycle.disposed += 1;
      });
      return (renderer) => [renderer.el('span', `${prefix}-content`), renderer.slot()];
    },
  });
  const triggerNode: CollapsibleTree = { key: `${prefix}-trigger`, proto: trigger, props: {} };
  const contentNode: CollapsibleTree = {
    key: `${prefix}-content`,
    proto: content,
    props: { keepMounted },
  };
  const rootNode: CollapsibleTree = {
    key: `${prefix}-root`,
    proto: root,
    props,
    children: [triggerNode, contentNode],
    onOpenChange: (request) => requests.push(request),
  };
  return { root: rootNode, trigger: triggerNode, content: contentNode, requests, lifecycle };
}

function element(view: CollapsibleMount, key: string): HTMLElement | null {
  const marker = Array.from(view.host.querySelectorAll('span')).find(
    (node) => node.textContent === key
  );
  return marker?.closest<HTMLElement>('[data-pui-root]') ?? null;
}

async function until(view: CollapsibleMount, predicate: () => boolean) {
  for (let frame = 0; frame < 20; frame++) {
    await view.flush();
    if (predicate()) return;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  throw new Error('Collapsible Adapter did not reach the expected committed condition.');
}

// Every driver mounts actual framework owners. These are simulated-DOM
// translation checks; browser paint/native Tab fidelity is separate evidence.
export function collapsibleAdapterConformance(
  name: string,
  mount: CollapsibleDriver,
  projection?: CollapsibleProjection
) {
  const recipe = (name: string, props: Record<string, unknown> = {}, keepMounted = false) =>
    createRecipe(name, props, keepMounted, projection);
  describe(`${name}: Collapsible compound translation`, () => {
    it('retains one logical instance across L1 epochs and cleans up terminal ownership', async () => {
      // T-BASE-COLLAPSIBLE-0001-CASE-UNCONTROLLED
      // T-BASE-COLLAPSIBLE-0001-CASE-L1-LIFECYCLE
      // T-BASE-COLLAPSIBLE-0001-CASE-RELATIONSHIP
      // T-BASE-COLLAPSIBLE-0001-CASE-TERMINAL-CLEANUP
      // T-BASE-COLLAPSIBLE-0001-CASE-ANATOMY-CARDINALITY
      // T-BASE-COLLAPSIBLE-0001-CASE-AUTHORING-CONSUMER
      const subject = recipe(name);
      const view = await mount([subject.root]);
      let identity: string | undefined;
      try {
        await until(view, () => element(view, subject.trigger.key)?.tabIndex === 0);
        const root = view.exposes(subject.root.key);
        const open = view.exposes(subject.content.key).open;
        expect(root.open.get()).toBe(false);
        expect(element(view, subject.content.key)).toBeNull();
        expect(subject.lifecycle).toEqual({ created: 1, mounted: 0, unmounted: 0, disposed: 0 });
        expect(root.composition()).toEqual(['content', 'root', 'trigger']);
        expect(subject.requests).toEqual([]);
        for (let epoch = 1; epoch <= 2; epoch++) {
          await view.click(element(view, subject.trigger.key)!);
          await until(
            view,
            () => !!element(view, subject.trigger.key)?.getAttribute('aria-controls')
          );
          const content = element(view, subject.content.key)!;
          identity ??= content.id;
          expect(element(view, subject.trigger.key)!.getAttribute('aria-controls')).toBe(identity);
          expect(content.id).toBe(identity);
          expect(open.get()).toBe(true);
          expect(view.exposes(subject.content.key).open).toBe(open);
          expect(subject.lifecycle.created).toBe(1);
          expect(subject.lifecycle.mounted).toBe(epoch);
          expect(content.hasAttribute('role')).toBe(false);
          expect(content.hasAttribute('tabindex')).toBe(false);
          await view.click(element(view, subject.trigger.key)!);
          await until(view, () => element(view, subject.content.key) === null);
          expect(element(view, subject.trigger.key)!.hasAttribute('aria-controls')).toBe(false);
          expect(open.get()).toBe(false);
          expect(subject.lifecycle.unmounted).toBe(epoch);
          expect(subject.lifecycle.disposed).toBe(0);
        }
        subject.root.props.defaultOpen = true;
        await view.flush();
        expect(root.open.get()).toBe(false);
        expect(subject.requests).toEqual([
          { open: true, reason: 'pointer' },
          { open: false, reason: 'pointer' },
          { open: true, reason: 'pointer' },
          { open: false, reason: 'pointer' },
        ]);
      } finally {
        await view.unmount();
      }
      expect(subject.lifecycle.disposed).toBe(1);
    });

    it('emits controlled requests without changing committed expansion or content', async () => {
      // T-BASE-COLLAPSIBLE-0001-CASE-CONTROLLED
      const subject = recipe(name, { open: false, defaultOpen: true });
      const view = await mount([subject.root]);
      try {
        await until(
          view,
          () => element(view, subject.trigger.key)?.getAttribute('aria-expanded') === 'false'
        );
        await view.click(element(view, subject.trigger.key)!);
        await view.flush(() => view.exposes(subject.root.key).toggle());
        expect(subject.requests).toEqual([
          { open: true, reason: 'pointer' },
          { open: true, reason: 'programmatic' },
        ]);
        expect(view.exposes(subject.root.key).open.get()).toBe(false);
        expect(view.exposes(subject.trigger.key).expanded.get()).toBe(false);
        expect(element(view, subject.content.key)).toBeNull();
        subject.root.props.open = true;
        await until(view, () => !!element(view, subject.content.key));
        expect(element(view, subject.trigger.key)!.getAttribute('aria-expanded')).toBe('true');
        expect(subject.requests).toHaveLength(2);
        await view.click(element(view, subject.trigger.key)!);
        expect(subject.requests.at(-1)).toEqual({ open: false, reason: 'pointer' });
        expect(view.exposes(subject.root.key).open.get()).toBe(true);
        expect(element(view, subject.content.key)).not.toBeNull();
        subject.root.props.open = false;
        await until(view, () => element(view, subject.content.key) === null);
        expect(subject.requests).toHaveLength(3);
      } finally {
        await view.unmount();
      }
    });

    it('retains hidden content and suppresses effectively disabled activation without closing', async () => {
      // T-BASE-COLLAPSIBLE-0001-CASE-KEEP-MOUNTED
      // T-BASE-COLLAPSIBLE-0001-CASE-DISABLED
      // T-BASE-COLLAPSIBLE-0001-CASE-ACTIVATION
      const subject = recipe(name, { defaultOpen: true, disabled: true }, true);
      const view = await mount([subject.root]);
      try {
        await until(
          view,
          () => element(view, subject.trigger.key)?.getAttribute('aria-disabled') === 'true'
        );
        let trigger = element(view, subject.trigger.key)!;
        const identity = element(view, subject.content.key)!.id;
        await view.click(trigger);
        await view.flush(() => view.exposes(subject.root.key).close());
        expect(view.exposes(subject.root.key).open.get()).toBe(true);
        expect(trigger.tabIndex).toBe(-1);
        expect(subject.requests).toEqual([]);
        subject.root.props.disabled = false;
        subject.trigger.props.disabled = true;
        await view.flush();
        await view.click(element(view, subject.trigger.key)!);
        expect(subject.requests).toEqual([]);
        subject.trigger.props.disabled = false;
        await until(view, () => element(view, subject.trigger.key)?.tabIndex === 0);
        trigger = element(view, subject.trigger.key)!;
        await view.flush(() => trigger.focus());
        await view.flush(() => {
          trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          trigger.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
        });
        await until(
          view,
          () => element(view, subject.content.key)?.getAttribute('aria-hidden') === 'true'
        );
        expect(subject.requests).toEqual([{ open: false, reason: 'keyboard' }]);
        expect(trigger.getAttribute('aria-controls')).toBe(identity);
        expect(element(view, subject.content.key)!.id).toBe(identity);
        expect(subject.lifecycle.unmounted).toBe(0);
        expect(document.activeElement).toBe(trigger);
        for (const key of ['ArrowDown', 'Home', 'End']) {
          await view.flush(() =>
            trigger.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
          );
        }
        expect(subject.requests).toHaveLength(1);
        await view.flush(() => {
          const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
          trigger.dispatchEvent(down);
          expect(down.defaultPrevented).toBe(true);
          trigger.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
        });
        await until(
          view,
          () => element(view, subject.content.key)?.getAttribute('aria-hidden') === 'false'
        );
        expect(subject.requests).toEqual([
          { open: false, reason: 'keyboard' },
          { open: true, reason: 'keyboard' },
        ]);
        expect(document.activeElement).toBe(trigger);
      } finally {
        await view.unmount();
      }
    });

    it('keeps adjacent and nested relationships and expansion requests in their own domains', async () => {
      // T-BASE-COLLAPSIBLE-0001-CASE-DOMAIN-ISOLATION
      const outer = recipe(name, { defaultOpen: true });
      const nested = recipe(name, { defaultOpen: true });
      const adjacent = recipe(name, { defaultOpen: true });
      outer.root.children!.push(nested.root);
      const view = await mount([outer.root, adjacent.root]);
      try {
        await until(view, () =>
          [outer, nested, adjacent].every(
            (part) => !!element(view, part.trigger.key)?.getAttribute('aria-controls')
          )
        );
        const identities = [outer, nested, adjacent].map((part) => {
          const content = element(view, part.content.key)!;
          expect(element(view, part.trigger.key)!.getAttribute('aria-controls')).toBe(content.id);
          return content.id;
        });
        expect(new Set(identities).size).toBe(3);
        await view.click(element(view, nested.trigger.key)!);
        await until(view, () => element(view, nested.content.key) === null);
        expect(view.exposes(outer.root.key).open.get()).toBe(true);
        expect(view.exposes(adjacent.root.key).open.get()).toBe(true);
        expect(outer.requests).toEqual([]);
        expect(adjacent.requests).toEqual([]);
        expect(nested.requests).toEqual([{ open: false, reason: 'pointer' }]);
      } finally {
        await view.unmount();
      }
    });

    it('rejects duplicate logical parts before committing an invalid composition', async () => {
      // T-BASE-COLLAPSIBLE-0001-CASE-ANATOMY-CARDINALITY
      const subject = recipe(name);
      subject.root.children!.push({ ...subject.content, key: `${subject.content.key}-duplicate` });
      await expect(mount([subject.root])).rejects.toMatchObject({
        code: 'COLLAPSIBLE_DUPLICATE_PART',
      });
    });
  });
}
