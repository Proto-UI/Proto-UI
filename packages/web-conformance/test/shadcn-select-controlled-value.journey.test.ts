import * as React from 'react';
import { createPortal, flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Vue2Any } from '../../adapters/vue2/test/utils/vue2';

import { renderDemo } from '../../../apps/www/src/components/PrototypePreviewer/demo-renderer';
import { loadPrototypes } from '../../../apps/www/src/components/PrototypePreviewer/prototype-modules';
import {
  AdapterIds,
  type RuntimeId,
} from '../../../apps/www/src/components/PrototypePreviewer/runtimes/registry';
import type {
  DemoRuntimeApi,
  DemoSpec,
} from '../../../apps/www/src/components/PrototypePreviewer/demo-types';

vi.mock('../../../apps/www/src/components/PrototypePreviewer/runtimes/react-runtime', () => ({
  loadReact: vi.fn(async () => ({
    React,
    ReactDOM: { createPortal, createRoot, flushSync },
  })),
}));

vi.mock('../../../apps/www/src/components/PrototypePreviewer/runtimes/vue-runtime', () => ({
  loadVue: vi.fn(async () => Vue),
}));

vi.mock('../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime', async () => {
  const actual = await vi.importActual<
    typeof import('../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime')
  >('../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime');
  return { ...actual, loadVue2: vi.fn(async () => Vue2Any) };
});

const WEB_ADAPTERS = ['wc', 'react', 'vue', 'vue2'] as const satisfies readonly RuntimeId[];
const SELECT_PROTOTYPES = [
  'shadcn-select-root',
  'shadcn-select-trigger',
  'shadcn-select-value',
  'shadcn-select-content',
  'shadcn-select-item',
] as const;

/**
 * A fixture rather than a documentation demo, because the published Select demo
 * has no control that drives `value` from outside. `setup` hands the runtime API
 * to the test, which is how a controlled owner would push a new value in.
 */
let runtimeApi: DemoRuntimeApi | null = null;

const controlledSelectFixture: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-select-root',
    ref: 'root',
    props: { value: 'react' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-select-trigger',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-select-value',
            ref: 'value',
            props: { placeholder: 'Select an adapter' },
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-select-content',
        props: { position: 'popper', align: 'start' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-select-item',
            props: { value: 'react', textValue: 'React' },
            children: ['React'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-select-item',
            props: { value: 'vue', textValue: 'Vue' },
            children: ['Vue'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-select-item',
            props: { value: 'wc', textValue: 'Web Components' },
            children: ['Web Components'],
          },
        ],
      },
    ],
  },
  setup: (ctx) => {
    runtimeApi = ctx.api;
    return () => {
      runtimeApi = null;
    };
  },
};

async function settle(): Promise<void> {
  await Promise.resolve();
  await Vue.nextTick();
  await Vue2Any.nextTick();
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await Promise.resolve();
}

/** Reports the text it actually saw, so a timeout still names the defect. */
async function waitForText(
  target: HTMLElement,
  expected: string,
  label: string,
  timeoutMs = 1_500
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await settle();
    if (target.textContent?.trim() === expected) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  expect(target.textContent?.trim(), label).toBe(expected);
}

function requireRef(host: HTMLElement, ref: string): HTMLElement {
  const target = host.querySelector<HTMLElement>(`[data-demo-ref="${ref}"]`);
  expect(target, `expected demo ref "${ref}"`).toBeTruthy();
  return target!;
}

function requireApi(): DemoRuntimeApi {
  expect(runtimeApi, 'the fixture must publish its runtime API').toBeTruthy();
  return runtimeApi!;
}

beforeAll(async () => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
  expect([...WEB_ADAPTERS]).toEqual(AdapterIds);
  await loadPrototypes([...SELECT_PROTOTYPES]);
});

afterAll(() => {
  delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

describe('Web adapter conformance / Shadcn Select controlled value journey', () => {
  it.each(WEB_ADAPTERS)(
    '%s resolves a controlled value that never opens the Content',
    async (runtime) => {
      const host = document.createElement('div');
      document.body.append(host);
      const session = await renderDemo({
        runtime,
        demo: controlledSelectFixture as any,
        host,
      });

      try {
        await settle();
        const value = requireRef(host, 'value');

        // The Content has never been open, so the authored labels live in a
        // subtree the host only keeps because it stays mounted and detached.
        await waitForText(value, 'React', `${runtime}/initial-label`);
        expect(value.dataset.displayValue, `${runtime}/initial-fact`).toBe('React');

        // A controlled owner pushes a new value in without any open ever
        // happening. Both the painted label and the exposed fact must follow.
        requireApi().setProps('root', { value: 'wc' });
        await waitForText(value, 'Web Components', `${runtime}/updated-label`);
        expect(value.dataset.displayValue, `${runtime}/updated-fact`).toBe('Web Components');

        requireApi().setProps('root', { value: 'vue' });
        await waitForText(value, 'Vue', `${runtime}/second-update-label`);
        expect(value.dataset.displayValue, `${runtime}/second-update-fact`).toBe('Vue');
      } finally {
        await session.destroy();
        host.remove();
      }
    }
  );
});
