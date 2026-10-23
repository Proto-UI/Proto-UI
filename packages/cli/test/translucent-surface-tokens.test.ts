import { expect, it } from 'vitest';
import { FeedbackStyleRecorder, tw } from '@proto.ui/core';
import { classifyTwTokenApplicationRoleV0 } from '../../core/src/spec/feedback/application-role';
import { mergeTwTokensV0 } from '../../core/src/spec/feedback/semantic-merge';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleArtifact,
  renderProtoShadowSplitStyleArtifact,
} from '../src/services/proto-style-css';
const cases = [
  ['backdrop-filter-[blur(40px)_saturate(1.5)]', 'backdrop-filter: blur(40px) saturate(1.5);'],
  ['-z-1', 'z-index: -1;'],
  ['isolate', 'isolation: isolate;'],
  ['rounded-[inherit]', 'border-radius: inherit;'],
  ['min-w-36', 'min-width: 9rem;'],
] as const;
it.each(cases)('renders finite generic %s on all CSS targets', (token, declaration) => {
  const r = new FeedbackStyleRecorder();
  r.use(tw(token));
  expect(r.export().tokens).toContain(token);
  for (const css of [
    renderProtoStyleTokenCss([token]),
    renderProtoShadowStyleArtifact([token]).cssText,
    renderProtoShadowSplitStyleArtifact([token], { rootTokens: [token], templateTokens: [] })
      .cssText,
  ]) {
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain(declaration);
  }
});
it('keeps a single complete backdrop filter per subject and supports withdrawal order', () => {
  const token = cases[0][0];
  expect(mergeTwTokensV0(['backdrop-blur-xs', token]).tokens).toEqual([token]);
  expect(mergeTwTokensV0([token, 'backdrop-blur-xs']).tokens).toEqual(['backdrop-blur-xs']);
});
it.each([
  'backdrop-filter-[blur(41px)_saturate(1.5)]',
  'backdrop-filter-[url(test)]',
  '-z-2',
  'isolate-unknown',
  'rounded-[inheritance]',
  'min-w-37',
])('does not guess unsupported %s', (token) => {
  for (const css of [
    renderProtoStyleTokenCss([token]),
    renderProtoShadowStyleArtifact([token]).cssText,
    renderProtoShadowSplitStyleArtifact([token]).cssText,
  ])
    expect(css).toContain(`* - ${token}`);
});

it('retains unrelated paint and unknown filters rather than guessing composition', () => {
  const combined = cases[0][0];
  expect(
    mergeTwTokensV0(['bg-popover/70', 'backdrop-blur-xs', combined, 'text-popover-foreground'])
      .tokens
  ).toEqual(['bg-popover/70', combined, 'text-popover-foreground']);
  expect(mergeTwTokensV0([combined, 'backdrop-filter-[url(test)]']).tokens).toEqual([
    combined,
    'backdrop-filter-[url(test)]',
  ]);
});

it.each([
  ['backdrop-filter-[blur(40px)_saturate(1.5)]', 'surface'],
  ['rounded-[inherit]', 'surface'],
  ['isolate', 'placement'],
  ['-z-1', 'placement'],
  ['min-w-36', 'placement'],
] as const)('classifies %s without a family-specific adapter dispatch', (token, role) => {
  expect(classifyTwTokenApplicationRoleV0(token)).toEqual({ token, role, roleSource: 'canonical' });
});

it('emits the lowered dark variant without inventing an inherited filter accumulator', () => {
  const token = `dark:${cases[0][0]}`;
  for (const css of [
    renderProtoStyleTokenCss([token]),
    renderProtoShadowStyleArtifact([token]).cssText,
    renderProtoShadowSplitStyleArtifact([token], { rootTokens: [token], templateTokens: [] })
      .cssText,
  ]) {
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain(cases[0][1]);
    expect(css).not.toContain('--tw-backdrop');
  }
});

it.each(['z-10', 'z-40', 'z-50'])(
  'replaces the supported z-index %s without retaining a competing declaration',
  (token) => {
    expect(mergeTwTokensV0([token, '-z-1']).tokens).toEqual(['-z-1']);
    expect(mergeTwTokensV0(['-z-1', token]).tokens).toEqual([token]);
    expect(mergeTwTokensV0([token, '-z-2']).tokens).toEqual([token, '-z-2']);
  }
);
