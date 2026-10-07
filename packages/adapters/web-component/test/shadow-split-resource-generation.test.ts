import { createDeferredOwnerDisposal } from '@proto.ui/adapter-base';
import { describe, expect, it } from 'vitest';

import {
  SHADOW_COLOR_SCHEME_ATTRIBUTE,
  type ShadowColorSchemeSource,
} from '../src/shadow-color-scheme-environment';
import { createShadowOwnerShell } from '../src/shadow-owner-shell';
import {
  createShadowSplitResources,
  type ShadowSplitResources,
} from '../src/shadow-split-resources';
import {
  SHADOW_STYLE_ARTIFACT_ENVIRONMENT,
  SHADOW_STYLE_ARTIFACT_KIND,
  SHADOW_STYLE_ARTIFACT_VERSION,
} from '../src/shadow-style-artifact';

const ARTIFACT = {
  kind: SHADOW_STYLE_ARTIFACT_KIND,
  version: SHADOW_STYLE_ARTIFACT_VERSION,
  cssText: ':where([data-pui-style~="block"]) { display: block; }',
  environment: SHADOW_STYLE_ARTIFACT_ENVIRONMENT,
};

let harnessId = 0;

describe('Shadow split owner-generation lifecycle harness', () => {
  it('creates resources on first connection before runtime and view work', async () => {
    const source = trackedSource();
    const subject = defineHarness(source.source);
    const element = document.createElement(subject.tagName) as HarnessElement;

    expect(source.listeners.size).toBe(0);
    expect(element.shadowRoot?.childNodes).toHaveLength(0);
    expect(subject.events).toEqual(['constructor']);

    document.body.appendChild(element);

    expect(subject.events).toEqual([
      'constructor',
      'resources:ready',
      'runtime:initialize',
      'view:attach',
    ]);
    expect(source.listeners.size).toBe(1);
    expect(element.resourcesAtRuntimeInitialization).toBe(element.resources);
    expect(element.resourcesAtViewAttachment).toBe(element.resources);
    expect(element.resources?.artifact.stylesheet.element.parentNode).toBe(element.shadowRoot);
    expect(element.resources?.surface.element.parentNode).toBe(element.shadowRoot);

    element.remove();
    await flushMicrotasks();
  });

  it('retains one generation across view epochs and a synchronous DOM move', async () => {
    const source = trackedSource();
    const subject = defineHarness(source.source);
    const element = document.createElement(subject.tagName) as HarnessElement;
    const firstParent = document.createElement('section');
    const secondParent = document.createElement('section');
    document.body.append(firstParent, secondParent);
    firstParent.appendChild(element);

    const resources = element.resources;
    const stylesheet = resources?.artifact.stylesheet.element;
    const surface = resources?.surface.element;
    element.setViewPresent(false);
    element.setViewPresent(true);

    expect(element.resources).toBe(resources);
    expect(resources?.artifact.stylesheet.element).toBe(stylesheet);
    expect(resources?.surface.element).toBe(surface);

    secondParent.appendChild(element);
    await flushMicrotasks();

    expect(element.resources).toBe(resources);
    expect(source.listeners.size).toBe(1);
    expect(subject.events.filter((event) => event === 'resources:ready')).toHaveLength(1);
    expect(subject.events).not.toContain('generation:dispose');

    firstParent.remove();
    secondParent.remove();
    await flushMicrotasks();
  });

  it('disposes terminally and creates a fresh generation on later reconnect', async () => {
    const source = trackedSource();
    const subject = defineHarness(source.source);
    const element = document.createElement(subject.tagName) as HarnessElement;
    document.body.appendChild(element);

    const first = element.resources;
    const firstStylesheet = first?.artifact.stylesheet.element;
    const firstSurface = first?.surface.element;
    element.remove();
    await flushMicrotasks();

    expect(element.resources).toBeNull();
    expect(source.listeners.size).toBe(0);
    expect(element.hasAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe(false);
    expect(element.shadowRoot?.childNodes).toHaveLength(0);
    expect(subject.events.at(-1)).toBe('generation:dispose');

    source.set('dark');
    expect(element.hasAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe(false);

    document.body.appendChild(element);
    const second = element.resources;

    expect(second).not.toBe(first);
    expect(second?.artifact.stylesheet.element).not.toBe(firstStylesheet);
    expect(second?.surface.element).not.toBe(firstSurface);
    expect(source.listeners.size).toBe(1);
    expect(element.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe('dark');
    expect(subject.events.filter((event) => event === 'resources:ready')).toHaveLength(2);

    element.remove();
    await flushMicrotasks();
  });
});

type HarnessElement = HTMLElement & {
  readonly resources: ShadowSplitResources | null;
  readonly resourcesAtRuntimeInitialization: ShadowSplitResources | null;
  readonly resourcesAtViewAttachment: ShadowSplitResources | null;
  setViewPresent(present: boolean): void;
};

function defineHarness(source: ShadowColorSchemeSource) {
  const tagName = `x-shadow-split-generation-${++harnessId}`;
  const events: string[] = [];

  class ShadowSplitGenerationHarness extends HTMLElement implements HarnessElement {
    private readonly shell = createShadowOwnerShell(this.attachShadow({ mode: 'open' }));
    private readonly deferredDisposal = createDeferredOwnerDisposal(() => this.disposeGeneration());
    private currentResources: ShadowSplitResources | null = null;
    private runtimeResources: ShadowSplitResources | null = null;
    private viewResources: ShadowSplitResources | null = null;

    constructor() {
      super();
      events.push('constructor');
    }

    get resources() {
      return this.currentResources;
    }

    get resourcesAtRuntimeInitialization() {
      return this.runtimeResources;
    }

    get resourcesAtViewAttachment() {
      return this.viewResources;
    }

    connectedCallback() {
      this.deferredDisposal.retain();
      if (this.currentResources) return;

      const resources = createShadowSplitResources({
        host: this,
        shell: this.shell,
        artifact: ARTIFACT,
        colorSchemeSource: source,
        baseGetMeta: () => undefined,
      });
      this.currentResources = resources;
      events.push('resources:ready');

      this.runtimeResources = resources;
      events.push('runtime:initialize');

      this.viewResources = resources;
      resources.surface.replaceRenderedChildren([document.createTextNode('view')]);
      events.push('view:attach');
    }

    disconnectedCallback() {
      this.deferredDisposal.release();
    }

    setViewPresent(present: boolean) {
      const resources = this.currentResources;
      if (!resources) throw new Error('missing split resource generation');
      if (present) resources.surface.replaceRenderedChildren([document.createTextNode('view')]);
      else resources.surface.clearRenderedChildren();
    }

    private disposeGeneration() {
      const resources = this.currentResources;
      this.currentResources = null;
      this.runtimeResources = null;
      this.viewResources = null;
      resources?.dispose();
      events.push('generation:dispose');
    }
  }

  customElements.define(tagName, ShadowSplitGenerationHarness);
  return { tagName, events };
}

function trackedSource(initial: 'light' | 'dark' = 'light') {
  let colorScheme = initial;
  const listeners = new Set<() => void>();
  const source: ShadowColorSchemeSource = {
    get: () => colorScheme,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    source,
    listeners,
    set(next: 'light' | 'dark') {
      colorScheme = next;
      for (const listener of listeners) listener();
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}
