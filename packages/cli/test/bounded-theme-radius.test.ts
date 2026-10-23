import { expect, it } from 'vitest';
import { FeedbackStyleRecorder, tw } from '@proto.ui/core';
import { mergeTwTokensV0 } from '../../core/src/spec/feedback/semantic-merge';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleArtifact,
  renderProtoShadowSplitStyleArtifact,
} from '../src/services/proto-style-css';
const cases = [
  ['rounded-', 'border-radius'],
  ['rounded-t-', 'border-top-left-radius'],
  ['rounded-b-', 'border-bottom-right-radius'],
] as const;
it.each(cases)(
  'closes finite bounded theme radius %s on existing CSS targets',
  (prefix, property) => {
    const token = `${prefix}[min(var(--pui-radius-4xl),24px)]`;
    const recorder = new FeedbackStyleRecorder();
    recorder.use(tw(token));
    expect(recorder.export().tokens).toEqual([token]);
    expect(mergeTwTokensV0([token, 'rounded-none', token]).tokens).toEqual([token]);
    for (const css of [
      renderProtoStyleTokenCss([token]),
      renderProtoShadowStyleArtifact([token]).cssText,
      renderProtoShadowSplitStyleArtifact([token], { rootTokens: [token], templateTokens: [] })
        .cssText,
    ]) {
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain(`${property}: min(var(--pui-radius-4xl), 24px);`);
    }
  }
);
it.each([
  'rounded-[min(var(--pui-radius-4xl),25px)]',
  'rounded-l-[min(var(--pui-radius-4xl),24px)]',
  'rounded-t-[min(var(--pui-radius-3xl),24px)]',
])('does not guess unsupported radius %s', (token) => {
  for (const css of [
    renderProtoStyleTokenCss([token]),
    renderProtoShadowStyleArtifact([token]).cssText,
    renderProtoShadowSplitStyleArtifact([token]).cssText,
  ])
    expect(css).toContain(`* - ${token}`);
});
