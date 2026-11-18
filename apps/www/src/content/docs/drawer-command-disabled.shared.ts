import type { ExposedStateHandle } from '@proto.ui/core';
import type { DemoRuntimeApi } from '@/components/PrototypePreviewer/demo-types';

/** Drawer owns effective disabled, including Root inheritance. Each Button starts
 * disabled until its current public command snapshot reaches the same surface.
 * Only public exposed facts and authored props cross this consumer boundary.
 */
export function bindDrawerCommandDisabled(api: DemoRuntimeApi): () => void {
  if (!api.subscribePublicInstances || !api.getPublicInstance)
    throw new Error('Drawer command surfaces require public instance subscriptions.');
  let live = true;
  const cleanups: Array<() => void> = [];
  const dispose = () => {
    live = false;
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  };
  try {
    for (const [commandRef, buttonRef] of [
      ['trigger', 'trigger-action'],
      ['close', 'close-action'],
    ] as const) {
      let releaseFact = () => {};
      cleanups.push(() => releaseFact());
      const releaseInstances = api.subscribePublicInstances(
        [commandRef, buttonRef, 'panel'],
        (instances) => {
          releaseFact();
          const command = instances[commandRef];
          const button = instances[buttonRef];
          if (!live || !command || !button) return;
          // DemoRuntimeApi erases the typed Drawer expose map; check its methods.
          const disabled = command.getExposes()?.disabled as
            | ExposedStateHandle<boolean>
            | undefined;
          if (typeof disabled?.get !== 'function' || typeof disabled.subscribe !== 'function')
            throw new Error('Drawer command effective disabled state is unavailable.');
          // A retained command/Button identity is not a physical-view epoch.
          // Public presentation changes invalidate a previously delivered value.
          // They do not themselves certify native mount or portal readiness.
          const panel = instances.panel;
          const presentation = panel?.getExposes();
          const present = presentation?.isPresent as ExposedStateHandle<boolean> | undefined;
          const transition = presentation?.transitionState as ExposedStateHandle<string> | undefined;
          if (panel && (
            typeof present?.get !== 'function' || typeof present.subscribe !== 'function' ||
            typeof transition?.get !== 'function' || typeof transition.subscribe !== 'function'
          ))
            throw new Error('Drawer public presentation states are unavailable.');
          let active = true;
          let scheduled = false;
          let previous: boolean | undefined;
          const subscriptions: Array<() => void> = [];
          const release = () => {
            active = false;
            while (subscriptions.length) subscriptions.pop()!();
          };
          releaseFact = release;
          const current = () =>
            live &&
            active &&
            api.getPublicInstance!(commandRef) === command &&
            api.getPublicInstance!(buttonRef) === button &&
            api.getPublicInstance!('panel') === panel;
          const project = () => {
            if (!current()) return;
            const next = disabled.get();
            if (!current() || next === previous) return;
            previous = next;
            api.setProps(buttonRef, { disabled: next });
          };
          const requestProject = () => {
            if (!current() || scheduled) return;
            scheduled = true;
            // Facts can change inside a framework commit. Read the latest value
            // after it, keeping the direct Trigger group and its behavior intact.
            queueMicrotask(() => {
              scheduled = false;
              project();
            });
          };
          for (const fact of [disabled, present, transition]) {
            if (!fact || !current()) continue;
            const off = fact.subscribe((event) => {
              if (event.type === 'disconnect') release();
              else {
                if (fact !== disabled) previous = undefined;
                requestProject();
              }
            });
            if (current()) subscriptions.push(off);
            else off();
          }
          requestProject();
        }
      );
      cleanups.push(releaseInstances);
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
