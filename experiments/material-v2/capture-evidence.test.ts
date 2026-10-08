import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { explicitCaptureEvidenceIssues } from './capture-evidence';

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
    expect(capture).toMatch(/assert\.equal\([\s\S]*?cancelCount/);
  });
});
