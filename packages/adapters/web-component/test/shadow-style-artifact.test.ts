import { describe, expect, it } from 'vitest';

import { renderProtoShadowStyleArtifact } from '../../../cli/src/services/proto-style-css';
import { createShadowOwnerShell } from '../src/shadow-owner-shell';
import {
  createShadowStyleArtifactOwner,
  SHADOW_STYLE_ARTIFACT_ENVIRONMENT,
  SHADOW_STYLE_ARTIFACT_KIND,
  SHADOW_STYLE_ARTIFACT_VERSION,
  validateShadowStyleArtifact,
} from '../src/shadow-style-artifact';

const SHADOW_CSS = `@layer proto-ui {
  :host([data-pui-color-scheme='dark']) :where([data-pui-style~="dark:bg-input/30"]) {
    background-color: color-mix(in oklab, var(--pui-input) 30%, transparent);
  }
}`;

function artifact(cssText = SHADOW_CSS) {
  return {
    kind: SHADOW_STYLE_ARTIFACT_KIND,
    version: SHADOW_STYLE_ARTIFACT_VERSION,
    cssText,
    environment: SHADOW_STYLE_ARTIFACT_ENVIRONMENT,
  };
}

function createShell() {
  const host = document.createElement('x-shadow-style-artifact');
  return createShadowOwnerShell(host.attachShadow({ mode: 'open' }));
}

describe('adapter-web-component Shadow style artifact', () => {
  it('accepts the exact v1 shape as a frozen canonical copy', () => {
    const input = artifact();
    const validated = validateShadowStyleArtifact(input);

    expect(validated).toEqual(input);
    expect(validated).not.toBe(input);
    expect(Object.isFrozen(validated)).toBe(true);
  });

  it('validates and copies the same accessor-backed CSS snapshot', () => {
    let reads = 0;
    const input = artifact();
    Object.defineProperty(input, 'cssText', {
      enumerable: true,
      get: () => (++reads < 3 ? SHADOW_CSS : `[data-pui-style~='dark:bg-primary'] {}`),
    });

    const validated = validateShadowStyleArtifact(input);

    expect(reads).toBe(1);
    expect(validated.cssText).toBe(SHADOW_CSS);
  });

  it('accepts the artifact produced by the CLI Shadow renderer', () => {
    const generated = renderProtoShadowStyleArtifact(['dark:bg-input/30']);
    const validated = validateShadowStyleArtifact(generated);

    expect(validated).toEqual(generated);
    expect(validated.cssText).toContain(
      `:where(:host([data-pui-color-scheme='dark'])) :where([data-pui-style~="dark:bg-input/30"])`
    );
  });

  it('accepts equivalent quoted dark token selectors under the positive host scope', () => {
    expect(() =>
      validateShadowStyleArtifact(
        artifact(
          `:host([data-pui-color-scheme="dark"]) [ data-pui-style ~= 'dark:bg-input/30' ] { color: red; }`
        )
      )
    ).not.toThrow();
  });

  it.each([
    ['missing', undefined],
    ['wrong kind', { ...artifact(), kind: 'proto-ui.document-style' }],
    ['wrong version', { ...artifact(), version: 2 }],
    ['wrong environment', { ...artifact(), environment: 'document-color-scheme-v1' }],
    ['non-string cssText', { ...artifact(), cssText: null }],
    ['extra field', { ...artifact(), nonce: 'not-part-of-v1' }],
    [
      'document dark selectors',
      artifact(`:where(.dark) :where([data-pui-style~="dark:bg-input/30"]) { color: red; }`),
    ],
    [
      'dark rule without the host marker',
      artifact(`:where([data-pui-style~="dark:bg-input/30"]) { color: red; }`),
    ],
    [
      'single-quoted dark rule without the host marker',
      artifact(`:where([data-pui-style~='dark:bg-input/30']) { color: red; }`),
    ],
    [
      'whitespace-normalized dark rule without the host marker',
      artifact(`:where([ data-pui-style ~= "dark:bg-input/30" ]) { color: red; }`),
    ],
    [
      'class descendant dark rule without the host marker',
      artifact(`.wrapper [data-pui-style~='dark:bg-input/30'] { color: red; }`),
    ],
    [
      'element descendant dark rule without the host marker',
      artifact(`section [data-pui-style~="dark:bg-input/30"] { color: red; }`),
    ],
    [
      'dark token after another token attribute',
      artifact(`[data-pui-style~="p-2"][data-pui-style~="dark:bg-input/30"] { color: red; }`),
    ],
    [
      'case-insensitive dark token selector',
      artifact(`[data-pui-style~="DARK:bg-input/30" i] { color: red; }`),
    ],
    [
      'escaped dark token selector',
      artifact(`[data-pui-style~='d\\000061rk:bg-input/30'] { color: red; }`),
    ],
    [
      'escaped style attribute selector',
      artifact(`[data-pui-st\\000079le~='dark:bg-input/30'] { color: red; }`),
    ],
    [
      'escaped hyphen in style attribute selector',
      artifact(`[data\\-pui-style~='dark:bg-input/30'] { color: red; }`),
    ],
    [
      'hex-escaped hyphen in style attribute selector',
      artifact(`[data\\2d pui-style~='dark:bg-input/30'] { color: red; }`),
    ],
    [
      'unscoped dark rule beside an unrelated host marker',
      artifact(`${SHADOW_CSS}\n:where([data-pui-style~="dark:bg-input/30"]) { color: red; }`),
    ],
    [
      'dark rule under a negated host marker',
      artifact(
        `:not(:host([data-pui-color-scheme='dark'])) :where([data-pui-style~="dark:bg-input/30"]) { color: red; }`
      ),
    ],
    [
      'dark rule beside a comment-only host marker',
      artifact(
        `/* :host([data-pui-color-scheme='dark']) */ :where([data-pui-style~="dark:bg-input/30"]) { color: red; }`
      ),
    ],
    [
      'dark rule beside a string-only host marker',
      artifact(
        `[data-proof=":host([data-pui-color-scheme='dark'])"] :where([data-pui-style~="dark:bg-input/30"]) { color: red; }`
      ),
    ],
    [
      'dark rule with an optional host-marker branch',
      artifact(
        `:is(:host([data-pui-color-scheme='dark']), :host) :where([data-pui-style~="dark:bg-input/30"]) { color: red; }`
      ),
    ],
  ])('rejects %s', (_label, input) => {
    expect(() => validateShadowStyleArtifact(input)).toThrow(
      '[WC Adapter] invalid Shadow style artifact:'
    );
  });

  it('installs and deterministically updates a stable owner stylesheet', () => {
    const shell = createShell();
    const owner = createShadowStyleArtifactOwner(shell, artifact());
    const element = owner.stylesheet.element;
    const nextCss = ':where([data-pui-style~="block"]) { display: block; }';
    const sameOwner = createShadowStyleArtifactOwner(shell, artifact(nextCss));

    expect(sameOwner).toBe(owner);
    expect(sameOwner.stylesheet.element).toBe(element);
    expect(sameOwner.artifact.cssText).toBe(nextCss);
    expect(sameOwner.stylesheet.cssText).toBe(nextCss);
    expect(element.textContent).toBe(nextCss);
    expect(shell.root.querySelectorAll('[data-pui-shadow-stylesheet]')).toHaveLength(1);
  });

  it('validates an update before mutating the installed artifact or stylesheet', () => {
    const shell = createShell();
    const owner = createShadowStyleArtifactOwner(shell, artifact());
    const previousArtifact = owner.artifact;
    const previousCss = owner.stylesheet.cssText;

    expect(() => owner.update({ ...artifact(), version: 2 })).toThrow(
      'invalid Shadow style artifact'
    );
    expect(owner.artifact).toBe(previousArtifact);
    expect(owner.stylesheet.cssText).toBe(previousCss);
  });

  it('survives view-epoch content replacement and disposes owner resources idempotently', () => {
    const shell = createShell();
    const owner = createShadowStyleArtifactOwner(shell, artifact());
    const first = document.createElement('div');
    const second = document.createElement('span');

    shell.replaceRenderedChildren([first]);
    shell.clearRenderedChildren();
    shell.replaceRenderedChildren([second]);

    expect(shell.root.firstChild).toBe(owner.stylesheet.element);
    expect(shell.root.lastChild).toBe(second);

    owner.dispose();
    owner.dispose();
    expect(owner.stylesheet.element.parentNode).toBeNull();
    expect(() => owner.update(artifact())).toThrow(/disposed Shadow style artifact owner/);

    const nextOwner = createShadowStyleArtifactOwner(shell, artifact());
    expect(nextOwner).not.toBe(owner);
    expect(nextOwner.stylesheet.element).not.toBe(owner.stylesheet.element);
  });
});
