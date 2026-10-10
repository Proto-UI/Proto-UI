// @vitest-environment node
import { expect, it } from 'vitest';
import { appendSliderPageError, type SliderPageErrorReceipt } from './finf-slider-error-receipt';
it('preserves every original page error and snapshots its current interaction context', () => {
  const errors: string[] = [];
  const details: SliderPageErrorReceipt[] = [];
  const error = new Error('[Context] provider missing for key: base-field');
  const context = {
    runtime: 'react',
    runtimePhase: 'switching-to-react',
    url: 'http://127.0.0.1/en/ui-libraries/shadcn/slider/',
    stage: 'runtime-switch',
    lastInteraction: { sequence: 1, action: 'select-runtime', target: 'react' },
  };
  appendSliderPageError(errors, details, error, context);
  context.stage = 'corner-pointerdown';
  context.lastInteraction.sequence = 2;
  appendSliderPageError(errors, details, error, context);
  expect(errors).toEqual([String(error), String(error)]);
  expect(details).toHaveLength(2);
  expect(details[0]).toMatchObject({
    error: String(error),
    name: 'Error',
    message: error.message,
    stack: error.stack,
    runtime: 'react',
    runtimePhase: 'switching-to-react',
    url: context.url,
    stage: 'runtime-switch',
    lastInteraction: { sequence: 1, action: 'select-runtime', target: 'react' },
  });
  expect(details.map((detail) => detail.errorSequence)).toEqual([1, 2]);
  expect(details[0].receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(details[1].stage).toBe('corner-pointerdown');
  expect(details[1].lastInteraction?.sequence).toBe(2);
});
it('records missing stacks and pre-interaction errors without filtering them', () => {
  const errors: string[] = [];
  const details: SliderPageErrorReceipt[] = [];
  const error = new Error('mount failure');
  error.stack = undefined;
  appendSliderPageError(errors, details, error, {
    runtime: 'wc',
    runtimePhase: 'page-created',
    url: 'about:blank',
    stage: 'page-created',
    lastInteraction: null,
  });
  expect(errors).toEqual(['Error: mount failure']);
  expect(details[0]).toMatchObject({ stack: null, stage: 'page-created', lastInteraction: null });
});
