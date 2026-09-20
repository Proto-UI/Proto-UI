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
    throw invalidArtifact('object required');
  }

  const keys = Reflect.ownKeys(artifact);
  if (
    keys.length !== ARTIFACT_FIELDS.size ||
    keys.some((key) => typeof key !== 'string' || !ARTIFACT_FIELDS.has(key))
  ) {
    throw invalidArtifact('unexpected fields');
  }

  const candidate = artifact as Record<string, unknown>;
  if (candidate.kind !== SHADOW_STYLE_ARTIFACT_KIND) {
    throw invalidArtifact(`kind ${String(candidate.kind)} unsupported`);
  }
  if (candidate.version !== SHADOW_STYLE_ARTIFACT_VERSION) {
    throw invalidArtifact(`version ${String(candidate.version)} unsupported`);
  }
  if (typeof candidate.cssText !== 'string') {
    throw invalidArtifact('cssText string required');
  }
  if (candidate.environment !== SHADOW_STYLE_ARTIFACT_ENVIRONMENT) {
    throw invalidArtifact(`environment ${String(candidate.environment)} unsupported`);
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
  const selectors = stripShadowCssComments(cssText);
  const documentMarker = DOCUMENT_ENVIRONMENT_MARKERS.find((marker) => selectors.includes(marker));
  if (documentMarker) {
    throw invalidArtifact(`document selector ${documentMarker} forbidden`);
  }

  const hasUnscopedDarkToken = selectors.split(/[{},]/).some((selector) => {
    const normalized = selector.replace(/\s/g, '');
    return (
      /\[data-pui-style~=(['"])(?:[^'"]*:)?dark:[^'"]*\1\]/.test(normalized) &&
      !/^(?::where\()?:host\(\[data-pui-color-scheme=(['"])dark\1\]\)\)?(?=$|[>+~.#[:])/.test(
        normalized
      )
    );
  });
  if (hasUnscopedDarkToken) {
    throw invalidArtifact(`dark token CSS requires ${SHADOW_DARK_SELECTOR}`);
  }
}

export const stripShadowCssComments = (cssText: string) => cssText.replace(/\/\*[\s\S]*?\*\//g, '');

function invalidArtifact(reason: string): Error {
  return new Error(`[WC Adapter] invalid Shadow style artifact: ${reason}.`);
}
