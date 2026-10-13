import { collectGuardFacts, GUARD_EXPRESSIONS } from '../../../../scripts/diagnose-select-click';
// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {
  deadline,
  observerMode,
  recorderObserver,
} from '../../../../scripts/diagnose-select-click';

it('accepts only the two isolated observer modes', () => {
  expect(observerMode('on')).toBe('on');
  expect(observerMode('off')).toBe('off');
  for (const value of [undefined, '', 'false', 'all', 'force'])
    expect(() => observerMode(value)).toThrow();
});
it('bounds operations without claiming cancellation and preserves original rejection', async () => {
  vi.useFakeTimers();
  try {
    const pending = deadline('hung', () => new Promise(() => {}), 20);
    const check = expect(pending).rejects.toThrow('Diagnostic deadline: hung');
    await vi.advanceTimersByTimeAsync(20);
    await check;
    await expect(deadline('fine', async () => 3)).resolves.toBe(3);
    await expect(
      deadline('bad', async () => {
        throw new Error('original');
      })
    ).rejects.toThrow('original');
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
it('extracts the one actual bounded recorder RAF callback, failing closed on drift', () => {
  const source = readFileSync('apps/www/scripts/capture-transition-frames.ts', 'utf8');
  const callback = recorderObserver(source);
  expect(callback).toContain('observations.length >= 1200');
  expect(() => recorderObserver('')).toThrow();
  expect(() => recorderObserver(source + source)).toThrow();
  const scheduled: Function[] = [];
  const window: any = {};
  const document = { querySelectorAll: () => [] };
  const context = vm.createContext({
    window,
    document,
    requestAnimationFrame: (fn: Function) => scheduled.push(fn),
    performance: { now: () => 17 },
    Date,
  });
  vm.runInContext(callback, context, { timeout: 500 });
  for (let i = 0; i < 1201; i++) scheduled.shift()?.();
  expect(window.__transitionCapture.observations).toHaveLength(1200);
  expect(scheduled).toHaveLength(0);
});
it('runs the actual tsx-serialized passive input probe with no ambient helper or DOM writes', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'select-probe-'));
  let serialized: string;
  try {
    const fixture = path.join(directory, 'probe.mts');
    writeFileSync(
      fixture,
      `import {inputProbe} from ${JSON.stringify(path.resolve('apps/www/scripts/diagnose-select-click.ts'))}; process.stdout.write(inputProbe.toString());`
    );
    serialized = execFileSync(
      process.execPath,
      ['--import', createRequire(import.meta.url).resolve('tsx'), fixture],
      { encoding: 'utf8', timeout: 15000 }
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  const listeners = new Map<string, Function>(),
    outputs: string[] = [];
  class Element {
    localName = 'wc-shadcn-select-trigger';
    getAttribute(name: string) {
      return name === 'role' ? 'combobox' : null;
    }
  }
  vm.runInNewContext(
    `(${serialized!})()`,
    {
      Element,
      Date,
      performance: { now: () => 10 },
      console: { info: (value: string) => outputs.push(value) },
      document: {
        addEventListener: (name: string, fn: Function, options: unknown) => {
          expect(options).toMatchObject({ capture: true, passive: true });
          listeners.set(name, fn);
        },
      },
    },
    { timeout: 500 }
  );
  expect(listeners.size).toBe(9);
  for (let i = 0; i < 65; i++)
    listeners.get('pointerdown')!({
      type: 'pointerdown',
      isTrusted: true,
      eventPhase: 1,
      composedPath: () => [new Element()],
    });
  expect(outputs).toHaveLength(60);
  expect(JSON.parse(outputs[0].slice('[select-click-input]'.length))).toMatchObject({
    sequence: 1,
    trusted: true,
    type: 'pointerdown',
    role: 'combobox',
  });
});
it('keeps the diagnostic separate from capture acceptance and the two jobs bounded', () => {
  const script = readFileSync('apps/www/scripts/diagnose-select-click.ts', 'utf8');
  expect(script).toContain('await target.click()');
  expect(script).not.toContain('force: true');
  expect(script).toContain('page.setDefaultTimeout(15_000)');
  expect(script).toContain('acceptance: false');
  expect(script).toContain('new URL(url).origin === baseUrl');
  const workflow = readFileSync('.github/workflows/select-click-diagnostic.yml', 'utf8');
  expect(workflow).toContain('timeout-minutes: 15');
  expect(workflow).toContain('fail-fast: false');
  expect(workflow).toContain("observer: ['on', 'off']");
  expect(workflow).toContain(
    'select-click-diagnostic-${{ matrix.observer }}-${{ env.CANDIDATE_SHA }}'
  );
});

const guardScripts = new Map([
  ['owned', { url: 'http://127.0.0.1:3000/@fs/repo/packages/modules/overlay/src/impl.ts' }],
]);
const guardFrames = Object.keys(GUARD_EXPRESSIONS).map((functionName) => ({
  functionName,
  callFrameId: functionName,
  location: { scriptId: 'owned' },
}));
it('reads only closed boolean guard facts and refuses full-object protocol results', async () => {
  const send = vi.fn(async (_method: string, params: any) => {
    expect(params).toMatchObject({
      throwOnSideEffect: true,
      timeout: 500,
      returnByValue: true,
      includeCommandLineAPI: false,
      generatePreview: false,
      silent: true,
    });
    const context = {
      viewActive: true,
      mountPhase: 'mounted',
      reconcileViewAgain: true,
      registration: { trigger: {}, anchor: {}, content: {} },
      config: { placement: 'bottom' },
      portalLease: null as any,
    };
    const registration = { ...context.registration };
    const config = { ...context.config };
    const hostEl = {};
    const lease = { revoked: false, acquiring: false, target: hostEl };
    context.portalLease = lease;
    const value = vm.runInNewContext(`(function(){return ${params.expression}}).call(owner)`, {
      owner: context,
      registration,
      config,
      hostEl,
      lease,
      validView: () => true,
      current: () => false,
    });
    return { result: { value } };
  });
  const result = await collectGuardFacts(
    { send } as any,
    guardFrames,
    guardScripts,
    'http://127.0.0.1:3000'
  );
  expect(send).toHaveBeenCalledTimes(2);
  expect(result[0]).toMatchObject({
    outcome: 'observed',
    facts: {
      validView: true,
      registrationIdentity: false,
      configIdentity: false,
      registrationValues: true,
      positionValues: true,
    },
  });
  expect(result[1]).toMatchObject({
    outcome: 'observed',
    facts: { currentGuard: false, revoked: false, leaseIdentity: true, targetIdentity: true },
  });
  const bad = await collectGuardFacts(
    { send: async () => ({ result: { value: { private: 'must not leave collector' } } }) } as any,
    guardFrames,
    guardScripts,
    'http://127.0.0.1:3000'
  );
  expect(JSON.stringify(bad)).not.toContain('must not leave');
  expect(bad.every((x) => x.outcome === 'unexpected-result')).toBe(true);
});
it('keeps unavailable locals and side-effect refusal as unavailable and never weakens safeguards', async () => {
  const send = vi.fn(async () => ({
    result: {},
    exceptionDetails: {
      text: 'Refused or unavailable',
      exception: { description: 'private detail' },
    },
  }));
  const result = await collectGuardFacts(
    { send } as any,
    guardFrames,
    guardScripts,
    'http://127.0.0.1:3000'
  );
  expect(result).toEqual(
    guardFrames.map((frame) => ({
      name: frame.functionName,
      outcome: 'evaluation-rejected',
      exceptionKind: 'Other',
    }))
  );
  expect(send).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(result)).not.toContain('private');
});
it('does not evaluate same-named frames from a foreign or unrecognized source', async () => {
  const send = vi.fn();
  for (const url of [
    'https://example.com/packages/modules/overlay/src/impl.ts',
    'http://127.0.0.1:3000/other.ts',
    'not-a-url',
  ]) {
    const result = await collectGuardFacts(
      { send } as any,
      guardFrames,
      new Map([['owned', { url }]]),
      'http://127.0.0.1:3000'
    );
    expect(result.every((x) => x.outcome === 'frame-unavailable')).toBe(true);
  }
  expect(send).not.toHaveBeenCalled();
});
it('bounds guard sampling to two750ms calls and sanitizes errors', async () => {
  vi.useFakeTimers();
  try {
    const send = vi.fn(() => new Promise(() => {}));
    const pending = collectGuardFacts(
      { send } as any,
      guardFrames,
      guardScripts,
      'http://127.0.0.1:3000'
    );
    await vi.advanceTimersByTimeAsync(1500);
    expect((await pending).every((x) => x.outcome === 'deadline')).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
  const result = await collectGuardFacts(
    {
      send: async () => {
        throw new Error('private protocol detail');
      },
    } as any,
    guardFrames,
    guardScripts,
    'http://127.0.0.1:3000'
  );
  expect(result.every((x) => x.outcome === 'protocol-error')).toBe(true);
  expect(JSON.stringify(result)).not.toContain('private');
});
