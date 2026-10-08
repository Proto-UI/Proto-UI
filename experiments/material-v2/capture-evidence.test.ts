import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { explicitCaptureEvidenceIssues, captureActivationEvidenceIssues } from './capture-evidence';

const held = { active: true, session: 5, reason: 'move' };
const ended = { active: false, session: 5, reason: 'lostcapture' };
const trace = () =>
  [
    'pointerdown',
    'gotpointercapture',
    'pointermove',
    'lostpointercapture',
    'pointermove',
    'pointerup',
  ].map((type, time) => ({
    type,
    time,
    trust: true,
    pointerId: 1,
    pointerType: 'mouse',
    runtime: 'wc',
    control: 'regular',
  }));

describe('explicit native capture evidence controls (synthetic data, not browser proof)', () => {
  it('accepts the complete matching native event and router-session chain', () => {
    expect(explicitCaptureEvidenceIssues(trace(), 'wc', 1, held, ended)).toEqual([]);
  });
  it('rejects the original pending-release trace without got/lost capture', () => {
    const pendingOnly = trace().filter((event) => !event.type.endsWith('pointercapture'));
    expect(
      explicitCaptureEvidenceIssues(pendingOnly, 'wc', 1, held, { ...ended, reason: 'up' })
    ).toEqual([
      'expected one trusted wc/1 gotpointercapture',
      'expected one trusted wc/1 lostpointercapture',
      'expected native down -> gotcapture -> lostcapture -> up order',
      'the same held session must terminate by lostcapture',
    ]);
  });
  it.each(['untrusted', 'wrong pointer', 'wrong runtime', 'opaque control', 'loss after up'])(
    'rejects %s rather than accepting unrelated cancellation evidence',
    (mutation) => {
      const events = trace();
      const loss = events.find((event) => event.type === 'lostpointercapture')!;
      if (mutation === 'untrusted') loss.trust = false;
      else if (mutation === 'wrong pointer') loss.pointerId = 2;
      else if (mutation === 'wrong runtime') loss.runtime = 'react';
      else if (mutation === 'opaque control') loss.control = 'opaque';
      else events.push(events.splice(events.indexOf(loss), 1)[0]);
      expect(explicitCaptureEvidenceIssues(events, 'wc', 1, held, ended).length).toBeGreaterThan(0);
    }
  );
  it.each([
    { ...ended, active: true },
    { ...ended, session: 4 },
    { ...ended, reason: 'up' },
  ])('rejects a mismatched terminal contact: %j', (contact) => {
    expect(explicitCaptureEvidenceIssues(trace(), 'wc', 1, held, contact)).toContain(
      'the same held session must terminate by lostcapture'
    );
  });
  it('the native fixture drives both pending transitions and waits for actual events', () => {
    const source = readFileSync('experiments/material-v2/continuous-browser.test.mjs', 'utf8');
    const start = source.indexOf('// Capture is explicitly requested');
    const capture = source.slice(start, source.indexOf('// Blur observation', start));
    const down = capture.indexOf('await page.mouse.down()');
    const firstMove = capture.indexOf('await page.mouse.move(', down);
    const got = capture.indexOf("e.type === 'gotpointercapture'", firstMove);
    const release = capture.indexOf('e.releasePointerCapture(', got);
    const secondMove = capture.indexOf('await page.mouse.move(', release);
    const lost = capture.indexOf("e.type === 'lostpointercapture'", secondMove);
    const up = capture.indexOf('await page.mouse.up()', lost);
    const positions = [down, firstMove, got, release, secondMove, lost, up];
    expect(positions.every((value, i) => value >= 0 && (i === 0 || value > positions[i - 1]))).toBe(
      true
    );
    expect(capture).not.toContain('waitForTimeout');
    expect(capture).not.toContain('dispatchEvent');
    expect(capture).toContain('explicitCaptureEvidenceIssues(');
    expect(capture).toContain("for (const release of ['inside', 'outside'])");
    expect(capture).toContain("release === 'inside' ? captureCount + 1 : captureCount");
    expect(capture).toContain('captureActivationEvidenceIssues(');
  });
});

describe('capture loss distinguishes native activation from visual cancellation', () => {
  const clicks = () => [
    ...trace(),
    { ...trace()[0], type: 'click', time: 6, custom: false, detail: 1 },
    { ...trace()[0], type: 'click', time: 7, trust: false, custom: true },
  ];
  const activations = () => [{ runtime: 'wc', time: 8 }];
  it('accepts one same-pointer native click, one WC outward signal and one consumer callback', () => {
    expect(captureActivationEvidenceIssues(clicks(), activations(), 'wc', 1, 'inside')).toEqual([]);
  });
  it.each([
    'no click',
    'untrusted',
    'wrong pointer',
    'zero detail',
    'duplicate native',
    'duplicate outward',
    'duplicate callback',
    'callback before click',
  ])('rejects %s', (mutation) => {
    const events = clicks();
    const calls = activations();
    if (mutation === 'no click') events.splice(6, 1);
    else if (mutation === 'untrusted') events[6].trust = false;
    else if (mutation === 'wrong pointer') events[6].pointerId = 2;
    else if (mutation === 'zero detail') Object.assign(events[6], { detail: 0 });
    else if (mutation === 'duplicate native') events.push(events[6]);
    else if (mutation === 'duplicate outward') events.push(events[7]);
    else if (mutation === 'duplicate callback') calls.push(calls[0]);
    else calls[0].time = 0;
    expect(
      captureActivationEvidenceIssues(events, calls, 'wc', 1, 'inside').length
    ).toBeGreaterThan(0);
  });
  it('requires an outside up and no control activation for the outside negative control', () => {
    const events = trace();
    Object.assign(events[5], { runtime: undefined, control: undefined });
    expect(explicitCaptureEvidenceIssues(events, 'wc', 1, held, ended, 'outside')).toEqual([]);
    expect(explicitCaptureEvidenceIssues(trace(), 'wc', 1, held, ended, 'outside')).not.toEqual([]);
    expect(captureActivationEvidenceIssues(events, [], 'wc', 1, 'outside')).toEqual([]);
    expect(captureActivationEvidenceIssues(clicks(), [], 'wc', 1, 'outside')).not.toEqual([]);
    expect(captureActivationEvidenceIssues(events, activations(), 'wc', 1, 'outside')).not.toEqual(
      []
    );
  });
});
