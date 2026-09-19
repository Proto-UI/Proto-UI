import { describe, expect, it, vi } from 'vitest';

import {
  SHADOW_COLOR_SCHEME_ATTRIBUTE,
  type ShadowColorSchemeSource,
} from '../src/shadow-color-scheme-environment';
import { createShadowOwnerShell } from '../src/shadow-owner-shell';
import {
  createShadowSplitResources,
  type ShadowSplitResourceFactories,
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

function createSubject(tagName = 'x-shadow-split-resources') {
  const host = document.createElement(tagName);
  const shell = createShadowOwnerShell(host.attachShadow({ mode: 'open' }));
  return { host, shell };
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

describe('Shadow split resource coordinator', () => {
  it('creates one synchronous environment stylesheet surface and composed meta view', () => {
    const { host, shell } = createSubject();
    const source = trackedSource();
    const baseGetMeta = vi.fn((key: string) => `base:${key}`);
    const resources = createShadowSplitResources({
      host,
      shell,
      artifact: ARTIFACT,
      colorSchemeSource: source.source,
      baseGetMeta,
    });

    expect(host.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe('light');
    expect(Array.from(shell.root.childNodes)).toEqual([
      resources.artifact.stylesheet.element,
      resources.surface.element,
    ]);
    expect(resources.getMeta('colorScheme')).toBe('light');
    expect(resources.getMeta('reducedMotion')).toBe('base:reducedMotion');

    source.set('dark');
    expect(host.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe('dark');
    expect(resources.getMeta('colorScheme')).toBe('dark');

    const sameResources = createShadowSplitResources({
      host,
      shell,
      artifact: { ...ARTIFACT, cssText: 'ignored while generation is active' },
      colorSchemeSource: trackedSource('dark').source,
      baseGetMeta: () => 'ignored',
    });
    expect(sameResources).toBe(resources);
    expect(resources.artifact.artifact.cssText).toBe(ARTIFACT.cssText);

    resources.dispose();
  });

  it('rolls back the environment when artifact validation fails', () => {
    const { host, shell } = createSubject('x-shadow-split-invalid-artifact');
    const source = trackedSource();

    expect(() =>
      createShadowSplitResources({
        host,
        shell,
        artifact: { ...ARTIFACT, version: 2 },
        colorSchemeSource: source.source,
        baseGetMeta: () => undefined,
      })
    ).toThrow('invalid Shadow style artifact');

    expect(host.hasAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe(false);
    expect(source.listeners.size).toBe(0);
    expect(shell.root.childNodes).toHaveLength(0);
  });

  it('fails before artifact or surface creation when environment subscription is invalid', () => {
    const { host, shell } = createSubject('x-shadow-split-invalid-subscription');
    const source: ShadowColorSchemeSource = {
      get: () => 'light',
      subscribe: (() => undefined) as unknown as ShadowColorSchemeSource['subscribe'],
    };

    expect(() =>
      createShadowSplitResources({
        host,
        shell,
        artifact: ARTIFACT,
        colorSchemeSource: source,
        baseGetMeta: () => undefined,
      })
    ).toThrow('invalid Shadow color-scheme source subscription');

    expect(host.hasAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe(false);
    expect(shell.root.childNodes).toHaveLength(0);
  });

  it('rolls back stylesheet and environment when surface creation fails', () => {
    const { host, shell } = createSubject('x-shadow-split-surface-failure');
    const source = trackedSource();
    const factories: Partial<ShadowSplitResourceFactories> = {
      createSurface: vi.fn(() => {
        throw new Error('surface creation failed');
      }),
    };

    expect(() =>
      createShadowSplitResources({
        host,
        shell,
        artifact: ARTIFACT,
        colorSchemeSource: source.source,
        baseGetMeta: () => undefined,
        factories,
      })
    ).toThrow('surface creation failed');

    expect(host.hasAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe(false);
    expect(source.listeners.size).toBe(0);
    expect(shell.root.childNodes).toHaveLength(0);
  });

  it('disposes every resource in reverse order once and permits a fresh generation', () => {
    const { host, shell } = createSubject('x-shadow-split-disposal-order');
    const order: string[] = [];
    const firstFactories = recordingFactories(order);
    const first = createShadowSplitResources({
      host,
      shell,
      artifact: ARTIFACT,
      baseGetMeta: () => undefined,
      factories: firstFactories,
    });

    expect(order).toEqual(['create:environment', 'create:artifact', 'create:surface']);
    first.dispose();
    first.dispose();
    expect(order).toEqual([
      'create:environment',
      'create:artifact',
      'create:surface',
      'dispose:surface',
      'dispose:artifact',
      'dispose:environment',
    ]);

    const second = createShadowSplitResources({
      host,
      shell,
      artifact: ARTIFACT,
      baseGetMeta: () => undefined,
      factories: recordingFactories([]),
    });
    expect(second).not.toBe(first);
    second.dispose();
  });

  it('continues reverse disposal after one resource throws and remains idempotent', () => {
    const { host, shell } = createSubject('x-shadow-split-disposal-failure');
    const order: string[] = [];
    const factories: ShadowSplitResourceFactories = {
      ...recordingFactories(order),
      createSurface: () => {
        order.push('create:surface');
        return {
          element: document.createElement('div'),
          replaceRenderedChildren: () => {},
          clearRenderedChildren: () => {},
          hasOnlyRenderedNode: () => false,
          dispose: () => {
            order.push('dispose:surface');
            throw new Error('surface disposal failed');
          },
        };
      },
    };
    const resources = createShadowSplitResources({
      host,
      shell,
      artifact: ARTIFACT,
      baseGetMeta: () => undefined,
      factories,
    });

    expect(() => resources.dispose()).toThrow('surface disposal failed');
    expect(order.slice(-3)).toEqual(['dispose:surface', 'dispose:artifact', 'dispose:environment']);

    resources.dispose();
    expect(order.filter((step) => step.startsWith('dispose:'))).toHaveLength(3);
  });

  it('rejects a host and ShadowRoot from different owner identities before mutation', () => {
    const first = createSubject('x-shadow-split-owner-a');
    const second = createSubject('x-shadow-split-owner-b');

    expect(() =>
      createShadowSplitResources({
        host: first.host,
        shell: second.shell,
        artifact: ARTIFACT,
        baseGetMeta: () => undefined,
      })
    ).toThrow('host does not own the supplied root');
    expect(first.host.hasAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE)).toBe(false);
    expect(second.shell.root.childNodes).toHaveLength(0);
  });
});

function recordingFactories(order: string[]): ShadowSplitResourceFactories {
  return {
    createEnvironment: () => {
      order.push('create:environment');
      return {
        colorScheme: 'light',
        source: {
          get: () => 'light',
          subscribe: () => () => {},
        },
        subscribe: () => () => {},
        dispose: () => order.push('dispose:environment'),
      };
    },
    createArtifact: () => {
      order.push('create:artifact');
      return {
        artifact: ARTIFACT,
        stylesheet: {
          element: document.createElement('style'),
          cssText: ARTIFACT.cssText,
          update: () => {},
          dispose: () => {},
        },
        update: () => {},
        dispose: () => order.push('dispose:artifact'),
      };
    },
    createSurface: () => {
      order.push('create:surface');
      return {
        element: document.createElement('div'),
        replaceRenderedChildren: () => {},
        clearRenderedChildren: () => {},
        hasOnlyRenderedNode: () => false,
        dispose: () => order.push('dispose:surface'),
      };
    },
  };
}
