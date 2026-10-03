import { describe, expect, it } from 'vitest';
import { expressiveCodeCopyText, siteCopyPlugin } from './expressive-code-copy.mjs';

describe('EC Copy payload cutover', () => {
  it('preserves exact non-terminal code, including whitespace and literal DEL', () => {
    const code = '\n # not a terminal comment\n<&\x7f\n';
    expect(expressiveCodeCopyText(code, false)).toBe(code);
  });
  it('preserves plugin-frames terminal comment removal and trimming policy', () => {
    expect(
      expressiveCodeCopyText(' # setup\n\n echo "<&" # keep inline\n# next\n npm run test\n', true)
    ).toBe('echo "<&" # keep inline\n npm run test');
  });
  it.each([true, false])(
    'emits one app-owned payload after the existing frames preprocessing (%s)',
    (terminal) => {
      const frame = {
        type: 'element',
        tagName: 'figure',
        properties: { className: ['frame', ...(terminal ? ['is-terminal'] : [])] },
        children: [] as unknown[],
      };
      siteCopyPlugin().hooks.postprocessRenderedBlock({
        codeBlock: { code: '# comment\n<&\n' },
        renderData: { blockAst: frame },
        locale: 'zh-CN',
      });
      expect(frame.children).toHaveLength(1);
      expect(frame.children[0]).toMatchObject({
        tagName: 'div',
        properties: {
          'data-site-copy': '',
          'data-copy-label': '复制代码',
          'data-site-copy-text': terminal ? '<&' : '# comment\n<&\n',
        },
      });
    }
  );
  it('fails closed if upstream frames order/shape changes instead of guessing highlighted payload', () => {
    expect(() =>
      siteCopyPlugin().hooks.postprocessRenderedBlock({
        codeBlock: { code: 'x' },
        renderData: { blockAst: { tagName: 'pre' } },
        locale: 'en',
      })
    ).toThrow('frames wrapper');
  });
});
