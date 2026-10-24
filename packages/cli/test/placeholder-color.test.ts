import { expect, it } from 'vitest';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleArtifact,
  renderProtoShadowSplitStyleArtifact,
} from '../src/services/proto-style-css';
const colors = ['foreground', 'muted-foreground', 'primary', 'destructive'];
it.each(colors)(
  'projects %s exclusively to the actual placeholder on every CSS target',
  (color) => {
    const token = `placeholder:text-${color}`;
    const light = renderProtoStyleTokenCss([token]);
    const shadow = renderProtoShadowStyleArtifact([token]).cssText;
    const split = renderProtoShadowSplitStyleArtifact([token], {
      rootTokens: [token],
      templateTokens: [],
    }).cssText;
    for (const css of [light, shadow, split]) {
      expect(css).toContain('::placeholder {');
      expect(css).toContain(`color: var(--pui-${color});`);
    }
    const host = `:host([data-pui-split-root-style~="${token}"])`;
    expect(split).toContain(
      `${host} > [data-pui-split-surface][data-pui-style~="${token}"]::placeholder {`
    );
    expect(split).not.toContain(`${host} {`);
  }
);
it.each([
  'placeholder:text-sm',
  'placeholder:opacity-50',
  'placeholder:bg-primary',
  'placeholder:text-primary/50',
  'placeholder:text-unknown',
  'placeholder:text-[#fff]',
])('retains unsupported diagnostics for %s', (token) => {
  for (const css of [
    renderProtoStyleTokenCss([token]),
    renderProtoShadowStyleArtifact([token]).cssText,
    renderProtoShadowSplitStyleArtifact([token]).cssText,
  ]) {
    expect(css).toContain(`* - ${token}`);
    expect(css).not.toContain('::placeholder {');
  }
});
it.each([
  'dark:placeholder:text-primary',
  'placeholder:hover:text-primary',
  'placeholder::text-primary',
])('does not admit composed placeholder split selectors: %s', (token) => {
  expect(() => renderProtoShadowSplitStyleArtifact([token])).toThrow(/unsupported condition/);
});
