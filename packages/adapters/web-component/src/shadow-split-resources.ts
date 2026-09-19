import {
  createShadowColorSchemeEnvironmentOwner,
  type ShadowColorSchemeEnvironmentOwner,
  type ShadowColorSchemeSource,
} from './shadow-color-scheme-environment';
import { createShadowInnerSurface, type ShadowInnerSurface } from './shadow-inner-surface';
import type { ShadowOwnerShell } from './shadow-owner-shell';
import { createShadowSplitMetaGetter, type ShadowSplitMetaGetter } from './shadow-split-meta';
import {
  createShadowStyleArtifactOwner,
  type ShadowStyleArtifactOwner,
} from './shadow-style-artifact';

export type ShadowSplitResources = {
  readonly environment: ShadowColorSchemeEnvironmentOwner;
  readonly artifact: ShadowStyleArtifactOwner;
  readonly surface: ShadowInnerSurface;
  readonly getMeta: ShadowSplitMetaGetter;
  dispose(): void;
};

export type ShadowSplitResourceFactories = Readonly<{
  createEnvironment(
    host: HTMLElement,
    source?: ShadowColorSchemeSource
  ): ShadowColorSchemeEnvironmentOwner;
  createArtifact(shell: ShadowOwnerShell, artifact: unknown): ShadowStyleArtifactOwner;
  createSurface(shell: ShadowOwnerShell): ShadowInnerSurface;
}>;

export type ShadowSplitResourceOptions = Readonly<{
  host: HTMLElement;
  shell: ShadowOwnerShell;
  artifact: unknown;
  colorSchemeSource?: ShadowColorSchemeSource;
  baseGetMeta: ShadowSplitMetaGetter;
  factories?: Partial<ShadowSplitResourceFactories>;
}>;

const resourceGenerations = new WeakMap<ShadowRoot, ShadowSplitResources>();

const defaultFactories: ShadowSplitResourceFactories = {
  createEnvironment: createShadowColorSchemeEnvironmentOwner,
  createArtifact: createShadowStyleArtifactOwner,
  createSurface: createShadowInnerSurface,
};

/**
 * Atomically creates the private owner-generation resources needed by a
 * future split Shadow profile. Public profile normalization and Root routing
 * remain deliberately outside this coordinator.
 */
export function createShadowSplitResources({
  host,
  shell,
  artifact: artifactInput,
  colorSchemeSource,
  baseGetMeta,
  factories,
}: ShadowSplitResourceOptions): ShadowSplitResources {
  if (shell.root.host !== host) {
    throw new Error('[WC Adapter] Shadow split resource host does not own the supplied root.');
  }

  const current = resourceGenerations.get(shell.root);
  if (current) return current;

  const resolvedFactories = { ...defaultFactories, ...factories };

  let environment: ShadowColorSchemeEnvironmentOwner | undefined;
  let artifact: ShadowStyleArtifactOwner | undefined;
  let surface: ShadowInnerSurface | undefined;

  try {
    environment = resolvedFactories.createEnvironment(host, colorSchemeSource);
    artifact = resolvedFactories.createArtifact(shell, artifactInput);
    surface = resolvedFactories.createSurface(shell);
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    if (surface) disposeInto(rollbackErrors, surface);
    if (artifact) disposeInto(rollbackErrors, artifact);
    if (environment) disposeInto(rollbackErrors, environment);
    throw error;
  }

  const getMeta = createShadowSplitMetaGetter({ environment, baseGetMeta });
  let disposed = false;

  const resources: ShadowSplitResources = {
    environment,
    artifact,
    surface,
    getMeta,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (resourceGenerations.get(shell.root) === resources) {
        resourceGenerations.delete(shell.root);
      }

      const errors: unknown[] = [];
      disposeInto(errors, surface);
      disposeInto(errors, artifact);
      disposeInto(errors, environment);
      if (errors.length > 0) throw errors[0];
    },
  };

  resourceGenerations.set(shell.root, resources);
  return resources;
}

function disposeInto(errors: unknown[], resource: { dispose(): void }): void {
  try {
    resource.dispose();
  } catch (error) {
    errors.push(error);
  }
}
