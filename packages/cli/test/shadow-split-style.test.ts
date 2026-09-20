import { describe, expect, it } from 'vitest';
import {
  renderProtoShadowSplitStyleArtifact,
  renderProtoShadowStyleArtifact,
  renderProtoStyleTokenCss,
} from '../src/services/proto-style-css';
import { validateShadowStyleArtifact } from '../../adapters/web-component/src/shadow-style-artifact';

// D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001 I/J: one declaration source, no second visible box.
describe('private generated Shadow split sizing', () => {
  it('keeps native editors out of div compensation and provides a bounded native receipt', () => {
    const css = renderProtoShadowSplitStyleArtifact([
      'w-full',
      'min-h-16',
      'px-3',
      'hidden',
    ]).cssText;
    expect(css).toContain('--pui-split-native-text-recipe: l1;');
    expect(css).toContain('[data-pui-split-surface]:not(input, textarea)');
    expect(css).toContain(
      ':host([data-pui-split-root-style][data-pui-split-text-control]) {\n  display: block;\n  padding: 0;\n  border-width: 0;'
    );
    expect(css).toContain(
      ':host([data-pui-split-root-style~="hidden"]):host([data-pui-split-text-control]) { display: none; }'
    );
    expect(css).toContain('min-height: 4rem;');
    for (const stable of [
      renderProtoStyleTokenCss(['w-full']),
      renderProtoShadowStyleArtifact(['w-full']).cssText,
    ])
      expect(stable).not.toContain('pui-split-native-text');
  });
  // D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001 S/T: explicit geometry completion
  // must retain the canonical rest transform, including an absent transform.
  it('emits an explicit enter endpoint sourced from the condition-matched rest transform', () => {
    const tokens = ['animate-in', 'animate-out', '-translate-x-1/2', 'data-[active]:scale-[0.98]'];
    const css = renderProtoShadowSplitStyleArtifact(tokens).cssText;
    expect(css).toContain('--pui-split-rest-transform: initial;');
    expect(css).toContain('to {\n      transform: var(--pui-split-rest-transform, none);');
    const canonical =
      'translate(var(--pui-translate-x, 0), var(--pui-translate-y, 0)) scale(var(--pui-scale-x, 1), var(--pui-scale-y, 1))';
    for (const token of ['-translate-x-1/2', 'data-[active]:scale-[0.98]']) {
      const selector = `:host([data-pui-split-root-style~="${token}"]${token.startsWith('data-') ? '[data-active]' : ''})`;
      const declarations = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
      expect(declarations).toContain(`transform: ${canonical};`);
      expect(declarations).toContain(`--pui-split-rest-transform: ${canonical};`);
    }
    // Only the existing transform token owns the rest value; animation alone
    // must not invent a resting transform declaration.
    const animation = css
      .slice(css.indexOf(':host([data-pui-split-root-style~="animate-in"]) {'))
      .split('}')[0];
    expect(animation).not.toContain('--pui-split-rest-transform:');
    for (const unchanged of [
      renderProtoStyleTokenCss(tokens),
      renderProtoShadowStyleArtifact(tokens).cssText,
    ])
      expect(unchanged).not.toContain('pui-split-rest-transform');
  });
  // C-HOST-SURFACE-PROJECTION-0001 C/D: one painted focus surface,
  // even when the focus target remains the boundary.
  it('suppresses the boundary outline only for explicit, condition-matched outline-none', () => {
    const css = renderProtoShadowSplitStyleArtifact([
      'outline-none',
      'focus-visible:outline-none',
      'dark:data-[active]:outline-none',
      'ring-3',
      'outline-1',
    ]).cssText;
    for (const selector of [
      ':host([data-pui-split-root-style~="outline-none"])',
      ':host([data-pui-split-root-style~="focus-visible:outline-none"]:focus-visible)',
      ':where(:host([data-pui-color-scheme=\'dark\'])):host([data-pui-split-root-style~="dark:data-[active]:outline-none"][data-active])',
    ]) {
      expect(css).toContain(`${selector} {\n    outline: none;`);
    }
    // Keep the existing transparent surface outline for forced-colors;
    // duplicating it onto the host would paint two outlines in that mode.
    expect(css).toContain('outline: 2px solid transparent;');
    expect(css).not.toContain(':host([data-pui-split-root-style]) {\n    outline: none;');
    const hostRules = [...css.matchAll(/(:host[^{}]+)\{([^{}]+)\}/g)].filter(
      (m) =>
        m[1].includes('data-pui-split-root-style') &&
        !m[1].includes(' > ') &&
        m[2].includes('outline:')
    );
    expect(hostRules).toHaveLength(3);
    expect(
      hostRules.every((m) => m[1].includes('outline-none') && m[2].trim() === 'outline: none;')
    ).toBe(true);
    expect(renderProtoShadowSplitStyleArtifact(['ring-3']).cssText).not.toContain('outline: none;');
    expect(renderProtoShadowStyleArtifact(['outline-none']).cssText).not.toContain(
      'outline: none;'
    );
  });

  it('emits H1 motion, hit control and no-paint marker receipts on the boundary', () => {
    const css = renderProtoShadowSplitStyleArtifact([
      'peer',
      'group/button',
      'pointer-events-none',
      'translate-y-px',
      'scale-[0.98]',
      'will-change-transform',
    ]).cssText;
    expect(css).toContain('--pui-split-motion-recipe: h1;');
    expect(css).toContain('--pui-scale-x: initial;');
    for (const token of ['peer', 'group/button'])
      expect(css).toContain(
        `:host([data-pui-split-root-style~="${token}"]) {\n    --pui-split-compiled-marker: 1;`
      );
    expect(css).toContain(
      ':host([data-pui-split-root-style~="pointer-events-none"]) {\n    pointer-events: none;'
    );
    expect(css).toContain(
      ':host([data-pui-split-root-style~="translate-y-px"]) {\n    --pui-translate-y: 1px;'
    );
    expect(css).toContain(
      ':host([data-pui-split-root-style~="will-change-transform"]) {\n    will-change: transform;'
    );
  });
  it('keeps explicit timing overrides after defaults for both physical targets', () => {
    const css = renderProtoShadowSplitStyleArtifact([
      'duration-200',
      'ease-in-out',
      'transition-all',
    ]).cssText;
    expect(css.indexOf(':host([data-pui-split-root-style~="duration-200"]) {')).toBeGreaterThan(
      css.indexOf(':host([data-pui-split-root-style~="transition-all"]) {')
    );
  });
  it('retains v1 ABI and keeps the existing artifact renderer unchanged', () => {
    const tokens = ['border-2', 'p-2', 'text-xs', 'dark:p-4'];
    const artifact = renderProtoShadowSplitStyleArtifact(tokens);
    expect(validateShadowStyleArtifact(artifact)).toEqual(artifact);
    expect(Object.isFrozen(artifact)).toBe(true);
    expect(Object.keys(artifact).sort()).toEqual(['cssText', 'environment', 'kind', 'version']);
    expect(renderProtoShadowStyleArtifact(tokens).cssText).not.toContain('--pui-split-padding');
    expect(artifact).toEqual(renderProtoShadowSplitStyleArtifact(tokens));
  });

  it('generates decoration and font metrics without painting host backgrounds or borders', () => {
    const css = renderProtoShadowSplitStyleArtifact([
      'p-2',
      'border-2',
      'bg-primary',
      'text-xs',
    ]).cssText;
    expect(css).toContain('--pui-split-padding-left: 0.5rem;');
    expect(css).toContain('--pui-split-border-left: 2px;');
    expect(css).toContain('border-color: transparent;');
    expect(css).toContain('background-color: var(--pui-primary);');
    expect(css).toContain(
      'margin-left: calc(0px - var(--pui-split-padding-left) - var(--pui-split-border-left));'
    );
    expect(css).toContain(
      ':host([data-pui-split-root-style~="text-xs"]) {\n    font-size: 0.75rem;'
    );
    const hostRules = [...css.matchAll(/(:host[^{}]+)\{([^{}]+)\}/g)].filter(
      (m) => !m[1].includes(' > ')
    );
    expect(hostRules.some((m) => m[2].includes('background-color:'))).toBe(false);
    expect(hostRules.some((m) => m[2].includes('border-color: #'))).toBe(false);
  });

  it('preserves logical padding axes in host sizing and surface compensation', () => {
    const css = renderProtoShadowSplitStyleArtifact(['border', 'px-2', 'py-1']).cssText;
    expect(css).toContain('--pui-split-border-uniform: 0px;');
    expect(css).toContain(
      ':host([data-pui-split-root-style~="border"]) {\n    --pui-split-border-uniform: 1px;'
    );
    expect(css).toContain(
      ':host([data-pui-split-root-style~="px-2"]) {\n    padding-inline: 0.5rem;'
    );
    expect(css).toContain(
      ':host([data-pui-split-root-style~="px-2"]) > [data-pui-split-surface]:not(input, textarea) {\n    margin-inline-start: calc(0px - 0.5rem - var(--pui-split-border-uniform));\n    margin-inline-end: calc(0px - 0.5rem - var(--pui-split-border-uniform));'
    );
    expect(css).toContain(
      ':host([data-pui-split-root-style~="py-1"]) > [data-pui-split-surface]:not(input, textarea) {\n    margin-block-start: calc(0px - 0.25rem - var(--pui-split-border-uniform));\n    margin-block-end: calc(0px - 0.25rem - var(--pui-split-border-uniform));'
    );
  });

  it('uses the same host state/meta condition for sizing and painting', () => {
    const css = renderProtoShadowSplitStyleArtifact(['dark:data-[checked]:p-4']).cssText;
    const selector =
      ':where(:host([data-pui-color-scheme=\'dark\'])):host([data-pui-split-root-style~="dark:data-[checked]:p-4"][data-checked])';
    expect(css).toContain(`${selector} {\n    padding: 1rem;\n    --pui-split-padding-top: 1rem;`);
    expect(css).toContain(
      `${selector} > [data-pui-split-surface][data-pui-style~="dark:data-[checked]:p-4"]`
    );
    expect(css).not.toContain(':where(.dark)');
  });

  it('keeps conditional native text-control padding off the host box', () => {
    const css = renderProtoShadowSplitStyleArtifact(['data-[invalid]:p-4']).cssText;
    const selector = ':host([data-pui-split-root-style~="data-[invalid]:p-4"][data-invalid])';
    expect(css).toContain(`${selector} {\n    padding: 1rem;`);
    expect(css).toContain(
      `${selector}:host([data-pui-split-text-control]) {\n    padding: 0;\n  }`
    );
    expect(css).toContain(
      `${selector} > [data-pui-split-surface][data-pui-style~="data-[invalid]:p-4"]`
    );
  });

  it('rejects unverified percentage/variable padding rather than double-evaluating it', () => {
    expect(() => renderProtoShadowSplitStyleArtifact(['p-[10%]'])).toThrow(
      /verified length recipe/
    );
    expect(() => renderProtoShadowSplitStyleArtifact(['p-[var(--space)]'])).toThrow(
      /verified length recipe/
    );
  });

  it('rejects font-relative em padding until its font-size basis is preserved', () => {
    // Split rendering routes the Root font-size token to the inner surface, so
    // host padding and surface compensation would resolve the same em against
    // different font bases.
    expect(() => renderProtoShadowSplitStyleArtifact(['text-2xl', 'p-[1em]'])).toThrow(
      /font-relative padding/
    );
    expect(() => renderProtoShadowSplitStyleArtifact(['p-[0.5em]'])).toThrow(
      /font-relative padding/
    );
    expect(() => renderProtoShadowSplitStyleArtifact(['px-[1em]'])).toThrow(
      /font-relative padding/
    );
    // rem resolves against the document root in both modes and stays valid.
    expect(() => renderProtoShadowSplitStyleArtifact(['text-2xl', 'p-[1rem]'])).not.toThrow();
  });
});
