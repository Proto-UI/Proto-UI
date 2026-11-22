import * as React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import Vue2 from '../../adapters/vue2/node_modules/vue';

type Target = 'react' | 'vue' | 'vue2' | 'wc';
type Kind = 'base' | 'shadcn' | 'brutalist' | 'text';
type Owner = { getExposes(): Record<string, any> };
type Driver = {
  host: HTMLElement;
  handle(): Owner;
  setProps(props: Record<string, unknown>): Promise<void>;
  close(): Promise<void>;
};
type Modules = Record<Target, Record<Kind, Record<string, any>>>;

function physicalRoot(host: HTMLElement, target: Target, kind: Kind): HTMLElement | null {
  return kind === 'text'
    ? host.querySelector<HTMLInputElement>('input')
    : target === 'wc'
      ? (host.firstElementChild as HTMLElement | null)
      : host.querySelector<HTMLElement>('[data-pui-root]');
}

/** A framework flush or animation frame does not acknowledge a deferred DOM commit. */
async function physicalPresence(host: HTMLElement, target: Target, kind: Kind, present: boolean) {
  const matches = () => {
    const root = physicalRoot(host, target, kind);
    return present ? root?.isConnected === true : root === null;
  };
  if (matches()) return;
  await new Promise<void>((resolve, reject) => {
    let finished = false;
    const observer = new MutationObserver(() => {
      if (matches()) finish();
    });
    const timeout = setTimeout(
      () =>
        finish(
          new Error(
            `${target}/${kind}: physical Root did not become ${present ? 'present' : 'absent'}`
          )
        ),
      5000
    );
    function finish(error?: Error) {
      if (finished) return;
      finished = true;
      observer.disconnect();
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    }
    try {
      observer.observe(host, { childList: true, subtree: true });
      if (matches()) finish();
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

async function settled(target: Target) {
  await Promise.resolve();
  if (target === 'vue') await Vue.nextTick();
  if (target === 'vue2') await Vue2.nextTick();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await Promise.resolve();
}

/** Only ordinary generated imports and the target frameworks execute in this page. */
export function createSprint2BrowserConsumer(modules: Modules) {
  let sequence = 0;
  let current:
    | {
        target: Target;
        kind: Kind;
        driver: Driver;
        api: Record<string, any>;
        initialOwner: Owner;
        initialRoot: HTMLElement | null;
        initialChild: Element | null;
        clicks: number;
        mode: 'sync' | 'queued' | 'reject';
        off?: () => void;
        retired?: HTMLInputElement;
      }
    | undefined;
  const physical = () =>
    current ? physicalRoot(current.driver.host, current.target, current.kind) : null;
  async function mount(target: Target, kind: Kind, mode: 'sync' | 'queued' = 'sync') {
    if (current) await dispose();
    const module = modules[target][kind],
      Component = target === 'react' ? module.CompiledComponent : module.default;
    const host = document.createElement('div');
    document.querySelector('#mount')!.append(host);
    let props: Record<string, unknown> =
      kind === 'text'
        ? { present: true }
        : { styleProfile: 'vega', variant: kind === 'shadcn' ? 'outline' : 'solid' };
    let clicks = 0;
    const signal = () => {
      clicks++;
      if (current) current.clicks = clicks;
    };
    let driver: Driver;
    if (target === 'react') {
      const root = createRoot(host),
        ref = React.createRef<Owner>();
      const update = async (next: Record<string, unknown>) => {
        props = next;
        flushSync(() =>
          root.render(
            React.createElement(
              Component,
              { ...props, ref, onClick: signal },
              kind === 'text' ? null : React.createElement('b', null, 'Ordinary child')
            )
          )
        );
        await settled(target);
      };
      await update(props);
      driver = {
        host,
        handle: () => ref.current!,
        setProps: update,
        close: async () => {
          flushSync(() => root.unmount());
          host.remove();
          await settled(target);
        },
      };
    } else if (target === 'vue') {
      const input = Vue.shallowRef(props),
        ref = Vue.shallowRef<Owner>();
      const app = Vue.createApp({
        render: () =>
          Vue.h(
            Component,
            { ...input.value, ref, onClick: signal },
            kind === 'text' ? undefined : { default: () => Vue.h('b', 'Ordinary child') }
          ),
      });
      app.config.errorHandler = (error) => {
        throw error;
      };
      app.mount(host);
      await settled(target);
      driver = {
        host,
        handle: () => ref.value!,
        setProps: async (next) => {
          input.value = next;
          await settled(target);
        },
        close: async () => {
          app.unmount();
          host.remove();
          await settled(target);
        },
      };
    } else if (target === 'vue2') {
      const vm = new Vue2({
        render(h) {
          return h(
            Component,
            { props, ref: 'owner', on: { click: signal } },
            kind === 'text' ? [] : [h('b', 'Ordinary child')]
          );
        },
      }).$mount();
      host.append(vm.$el);
      await settled(target);
      driver = {
        host,
        handle: () => vm.$refs.owner as unknown as Owner,
        setProps: async (next) => {
          props = next;
          vm.$forceUpdate();
          await settled(target);
        },
        close: async () => {
          vm.$destroy();
          host.remove();
          await settled(target);
        },
      };
    } else {
      const tag = 'sprint2-generated-' + kind + '-' + ++sequence;
      module.register(tag);
      const element = document.createElement(tag) as HTMLElement &
        Owner & { setProps(props: Record<string, unknown>): void; dispose(): void };
      if (kind !== 'text') {
        const child = document.createElement('b');
        child.textContent = 'Ordinary child';
        element.append(child);
      }
      element.addEventListener('click', (event) => {
        if (event instanceof CustomEvent) signal();
      });
      element.setProps(props);
      host.append(element);
      await settled(target);
      driver = {
        host,
        handle: () => element,
        setProps: async (next) => {
          element.setProps(next);
          await settled(target);
        },
        close: async () => {
          element.dispose();
          host.remove();
          await settled(target);
        },
      };
    }
    try {
      await physicalPresence(host, target, kind, true);
    } catch (error) {
      try {
        await driver.close();
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'Physical Root readiness and cleanup failed'
        );
      }
      throw error;
    }
    const owner = driver.handle(),
      api = owner.getExposes();
    current = {
      target,
      kind,
      driver,
      api,
      initialOwner: owner,
      initialRoot: null,
      initialChild: null,
      clicks,
      mode,
    };
    current.initialRoot = physical();
    current.initialChild = physical()?.querySelector('b') ?? null;
    if (kind === 'text') {
      const scope = current;
      current.off = api.candidate.subscribe((event: { next: string }) => {
        if (current !== scope || scope.mode === 'reject') return;
        const accept = () => {
          if (current === scope) api.accept(event.next);
        };
        if (scope.mode === 'queued') queueMicrotask(accept);
        else accept();
      });
    }
    physical()?.setAttribute('data-sprint2-target', '');
    return read();
  }
  function read() {
    if (!current) return null;
    const element = physical();
    return {
      kind: current.kind,
      clicks: current.clicks,
      rootIdentity: element === current.initialRoot,
      ownerIdentity: current.driver.handle() === current.initialOwner,
      childIdentity: (element?.querySelector('b') ?? null) === current.initialChild,
      childText: element?.textContent ?? null,
      role: element?.getAttribute('role') ?? null,
      disabled: current.kind === 'text' ? null : current.api.disabled.get(),
      ariaDisabled: element?.getAttribute('aria-disabled') ?? null,
      style: element?.getAttribute('data-pui-style')?.split(' ') ?? [],
      focused: element === document.activeElement,
      text: current.kind === 'text' ? current.api.read() : null,
      physicalValue: element instanceof HTMLInputElement ? element.value : null,
      physicalSelection: element instanceof HTMLInputElement ? element.selectionStart : null,
    };
  }
  async function setDisabled(disabled: boolean) {
    if (!current) throw new Error('Not mounted');
    await current.driver.setProps({
      styleProfile: 'vega',
      variant: current.kind === 'shadcn' ? 'outline' : 'solid',
      disabled,
    });
    return read();
  }
  async function setPresent(present: boolean) {
    if (!current || current.kind !== 'text') throw new Error('Text owner missing');
    if (!present) current.retired = physical() as HTMLInputElement;
    await current.driver.setProps({ present });
    await physicalPresence(current.driver.host, current.target, current.kind, present);
    physical()?.setAttribute('data-sprint2-target', '');
    return read();
  }
  function reject() {
    if (!current) throw new Error('Not mounted');
    current.mode = 'reject';
  }
  async function staleInput() {
    if (!current?.retired) throw new Error('No retired input');
    current.retired.value = 'stale';
    current.retired.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText' })
    );
    await settled(current.target);
    return read();
  }
  async function dispose() {
    if (!current) return null;
    const retired = current;
    current = undefined;
    retired.off?.();
    await retired.driver.close();
    let heldRejected = false;
    try {
      if (retired.kind === 'text') retired.api.read();
      else retired.api.disabled.get();
    } catch {
      heldRejected = true;
    }
    return { heldRejected, remainingHosts: document.querySelector('#mount')!.childElementCount };
  }
  return { mount, read, setDisabled, setPresent, reject, staleInput, dispose };
}
