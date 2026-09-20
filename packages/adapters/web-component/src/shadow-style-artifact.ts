import type { ShadowOwnerShell } from './shadow-owner-shell';
import { createShadowStylesheetOwner, type ShadowStylesheetOwner } from './shadow-stylesheet-owner';

export const SHADOW_STYLE_ARTIFACT_KIND = 'proto-ui.shadow-style' as const;
export const SHADOW_STYLE_ARTIFACT_VERSION = 1 as const;
export const SHADOW_STYLE_ARTIFACT_ENVIRONMENT = 'host-color-scheme-v1' as const;

const ARTIFACT_FIELDS = new Set(['kind', 'version', 'cssText', 'environment']);
const SHADOW_DARK_SELECTOR = ":host([data-pui-color-scheme='dark'])";
const DOCUMENT_ENVIRONMENT_MARKERS = [
  ':where(.dark)',
  ":where([data-theme='dark'])",
  ':root',
  '@media (prefers-color-scheme: dark)',
];

export type ShadowStyleArtifactV1 = Readonly<{
  kind: typeof SHADOW_STYLE_ARTIFACT_KIND;
  version: typeof SHADOW_STYLE_ARTIFACT_VERSION;
  cssText: string;
  environment: typeof SHADOW_STYLE_ARTIFACT_ENVIRONMENT;
}>;

export type ShadowStyleArtifactOwner = {
  readonly artifact: ShadowStyleArtifactV1;
  readonly stylesheet: ShadowStylesheetOwner;
  update(artifact: unknown): void;
  dispose(): void;
};

const artifactOwners = new WeakMap<ShadowRoot, ShadowStyleArtifactOwner>();

/**
 * Validates the semantic artifact before any physical stylesheet mutation and
 * returns an immutable Adapter-owned copy.
 */
export function validateShadowStyleArtifact(artifact: unknown): ShadowStyleArtifactV1 {
  if (!artifact || typeof artifact !== 'object') {
    throw invalidArtifact('expected an object');
  }

  const keys = Reflect.ownKeys(artifact);
  if (
    keys.length !== ARTIFACT_FIELDS.size ||
    keys.some((key) => typeof key !== 'string' || !ARTIFACT_FIELDS.has(key))
  ) {
    throw invalidArtifact('expected exactly kind, version, cssText, and environment fields');
  }

  const candidate = artifact as Record<string, unknown>;
  if (candidate.kind !== SHADOW_STYLE_ARTIFACT_KIND) {
    throw invalidArtifact(`unsupported kind ${String(candidate.kind)}`);
  }
  if (candidate.version !== SHADOW_STYLE_ARTIFACT_VERSION) {
    throw invalidArtifact(`unsupported version ${String(candidate.version)}`);
  }
  if (typeof candidate.cssText !== 'string') {
    throw invalidArtifact('cssText must be a string');
  }
  if (candidate.environment !== SHADOW_STYLE_ARTIFACT_ENVIRONMENT) {
    throw invalidArtifact(`unsupported environment ${String(candidate.environment)}`);
  }

  validateShadowSelectorAbi(candidate.cssText);

  return Object.freeze({
    kind: SHADOW_STYLE_ARTIFACT_KIND,
    version: SHADOW_STYLE_ARTIFACT_VERSION,
    cssText: candidate.cssText,
    environment: SHADOW_STYLE_ARTIFACT_ENVIRONMENT,
  });
}

/** Installs one validated artifact through the existing owner stylesheet. */
export function createShadowStyleArtifactOwner(
  shell: ShadowOwnerShell,
  artifact: unknown
): ShadowStyleArtifactOwner {
  const validated = validateShadowStyleArtifact(artifact);
  const current = artifactOwners.get(shell.root);
  if (current) {
    current.update(validated);
    return current;
  }

  const stylesheet = createShadowStylesheetOwner(shell, validated.cssText);
  let currentArtifact = validated;
  let disposed = false;

  const owner: ShadowStyleArtifactOwner = {
    get artifact() {
      return currentArtifact;
    },
    stylesheet,
    update(nextArtifact) {
      if (disposed) {
        throw new Error('[WC Adapter] cannot update a disposed Shadow style artifact owner.');
      }
      const next = validateShadowStyleArtifact(nextArtifact);
      stylesheet.update(next.cssText);
      currentArtifact = next;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stylesheet.dispose();
      if (artifactOwners.get(shell.root) === owner) artifactOwners.delete(shell.root);
    },
  };

  artifactOwners.set(shell.root, owner);
  return owner;
}

function validateShadowSelectorAbi(cssText: string): void {
  const selectors = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const documentMarker = DOCUMENT_ENVIRONMENT_MARKERS.find((marker) => selectors.includes(marker));
  if (documentMarker) {
    throw invalidArtifact(`cssText contains document environment selector ${documentMarker}`);
  }

  const hasUnscopedDarkToken = selectors
    .split(/[{},]/)
    .some(
      (selector) =>
        /data-pui-style~="(?:[^"]*:)?dark:/.test(selector) &&
        !/^\s*(?::where\()?:host\(\[data-pui-color-scheme='dark'\]\)\)?(?=$|[\s>+~.#[:])/.test(
          selector
        )
    );
  if (hasUnscopedDarkToken) {
    throw invalidArtifact(`dark token CSS requires ${SHADOW_DARK_SELECTOR}`);
  }
}

function invalidArtifact(reason: string): Error {
  return new Error(`[WC Adapter] invalid Shadow style artifact: ${reason}.`);
}
