// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LIQUID_HOVER_NEGATIVES, LIQUID_HOVER_PARTS } from './liquid-hover-fixture';
import {
  LiquidHoverCheckpoint,
  liquidHoverStages,
  planLiquidHoverEvidence,
  selectLiquidHoverRuntimes,
  writeLiquidHoverJsonAtomic,
} from '../../../../test/helpers/liquid-hover-plan';

const runtimes = ['wc', 'react', 'vue', 'vue2'] as const;
const source = {
  sourceSha: 'a'.repeat(40),
  sourceTree: 'b'.repeat(40),
  patchSha256: 'c'.repeat(64),
  candidateSha: 'a'.repeat(40),
  runId: '123',
  runAttempt: '2',
  job: 'hover-evidence',
};
const full = () => planLiquidHoverEvidence(runtimes, source, '/en/test/liquid-glass-hover/');
const native = readFileSync(
  'apps/www/src/content/docs/zh-cn/demo-liquid-glass-hover.browser.test.ts',
  'utf8'
);
const directories: string[] = [];
async function fixture() {
  const output = await mkdtemp(path.join(os.tmpdir(), 'liquid-hover-plan-'));
  directories.push(output);
  // A two-capture diagnostic inventory keeps state-machine tests small. The
  // separate matrix tests below assert the unmodified complete production plan.
  const plan = full();
  plan.cases = plan.cases.slice(0, 1);
  plan.cases[0].parts = plan.cases[0].parts.slice(0, 1);
  plan.cases[0].parts[0].captures = plan.cases[0].parts[0].captures.slice(0, 2);
  const checkpoint = new LiquidHoverCheckpoint(plan, output);
  await checkpoint.initialize();
  return {
    checkpoint,
    plan,
    output,
    id: plan.cases[0].id,
    read: async () => JSON.parse(await readFile(path.join(output, 'progress.json'), 'utf8')),
  };
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('complete native hover matrix partitions without changing its scope', () => {
  it('keeps all four runtimes when unset and rejects malformed or unknown filters', () => {
    expect(selectLiquidHoverRuntimes(runtimes, undefined)).toEqual(runtimes);
    for (const runtime of runtimes)
      expect(selectLiquidHoverRuntimes(runtimes, runtime)).toEqual([runtime]);
    for (const invalid of ['', 'all', 'wc,react', ' wc', 'Vue', 'constructor'])
      expect(() => selectLiquidHoverRuntimes(runtimes, invalid)).toThrow(
        'Invalid PROTO_UI_HOVER_RUNTIME'
      );
    const harness = readFileSync('apps/www/src/content/docs/zh-cn/browser-harness.ts', 'utf8');
    expect(harness).toContain("export const RUNTIMES = ['wc', 'react', 'vue', 'vue2'] as const;");
    expect(native).toContain(
      'selectLiquidHoverRuntimes(RUNTIMES, process.env.PROTO_UI_HOVER_RUNTIME)'
    );
    expect(native).toContain('for (const runtime of selectedRuntimes)');
  });
  it('has exactly the same 16 case and capture identities across four disjoint shards', () => {
    const plan = full();
    const shards = runtimes.map((runtime) =>
      planLiquidHoverEvidence(selectLiquidHoverRuntimes(runtimes, runtime), source, plan.route)
    );
    expect(plan.cases).toHaveLength(16);
    expect(shards.map((shard) => shard.cases.length)).toEqual([4, 4, 4, 4]);
    const cases = shards.flatMap((shard) => shard.cases);
    expect(cases).toEqual(plan.cases);
    expect(new Set(cases.map((entry) => entry.id)).size).toBe(16);
    const captures = cases.flatMap((entry) =>
      entry.parts.flatMap((part) => part.captures.map((capture) => capture.name))
    );
    expect(captures).toHaveLength(2904);
    expect(new Set(captures).size).toBe(captures.length);
    for (const entry of cases)
      expect(entry.parts.reduce((sum, part) => sum + part.captures.length, 0)).toBe(
        entry.journey === 'interaction' ? 232 : 131
      );
    expect(captures).toEqual(
      plan.cases.flatMap((entry) =>
        entry.parts.flatMap((part) => part.captures.map((capture) => capture.name))
      )
    );
    for (const entry of cases) {
      expect(entry.parts.slice(0, 8).map((part) => part.part)).toEqual(LIQUID_HOVER_PARTS);
      expect(entry.parts.map((part) => part.part)).toEqual(
        entry.journey === 'interaction'
          ? [...LIQUID_HOVER_PARTS]
          : [
              ...LIQUID_HOVER_PARTS,
              'accordion-blocked',
              ...LIQUID_HOVER_NEGATIVES,
              'accordion-tight',
            ]
      );
    }
  });
  it('binds every planned capture to native record, root/context PNG and conditional material PNG', () => {
    for (const entry of full().cases)
      for (const part of entry.parts)
        for (const capture of part.captures) {
          expect(capture.name).toBe(
            `${entry.runtime}-${entry.theme}-${part.part}-${capture.stage}`
          );
          expect(capture.record).toBe(`${capture.name}.json`);
          expect(capture.root).toBe(`${capture.name}.png`);
          expect(capture.context).toBe(`${capture.name}-context.png`);
          expect(capture.materialIfPresent).toBe(`${capture.name}-material.png`);
        }
  });
  it('covers every existing literal and loop-expanded native sample stage, without inventing one', () => {
    const collected = new Set<string>();
    for (const match of native.matchAll(/sample\((['`])([^'`]+)\1/g)) {
      const template = match[2];
      const expansion = template.includes('${cancellation}')
        ? ['pointercancel', 'lostpointercapture', 'window-blur']
        : template.includes('${ref}')
          ? ['subject', 'owner', 'item']
          : template.includes('${active}')
            ? ['true', 'false']
            : [''];
      for (const value of expansion)
        collected.add(template.replace(/\$\{(?:cancellation|ref|active)\}/g, value));
    }
    const planned = new Set(
      full().cases.flatMap((entry) =>
        entry.parts.flatMap((part) => part.captures.map((capture) => capture.stage))
      )
    );
    expect([...planned].sort()).toEqual([...collected].sort());
    for (const part of LIQUID_HOVER_PARTS) {
      expect(liquidHoverStages('interaction', part)).toHaveLength(29);
      const policy = liquidHoverStages('policy-and-boundaries', part);
      expect(policy.filter((stage) => stage.startsWith('disable-'))).toEqual(
        part === 'button' || part === 'toggle'
          ? ['disable-subject-held']
          : part === 'accordion'
            ? ['disable-item-held', 'disable-owner-held']
            : ['disable-subject-held', 'disable-owner-held']
      );
      expect(policy.includes('explicit-opaque')).toBe(
        ['button', 'toggle', 'submit', 'reset'].includes(part)
      );
      expect(policy.filter((stage) => stage.startsWith('selection-'))).toHaveLength(
        part === 'toggle' ? 6 : 0
      );
      expect(policy.slice(-2)).toEqual(['reduced-motion', 'reduced-transparency']);
    }
    expect(liquidHoverStages('policy-and-boundaries', 'accordion-blocked')).toEqual([
      'collapse-blocked',
      'collapse-blocked-hover',
      'collapse-blocked-down',
      'collapse-blocked-click',
      'collapse-blocked-focus',
      'collapse-blocked-focus-hover',
      'collapse-blocked-blur',
    ]);
    for (const part of [...LIQUID_HOVER_NEGATIVES, 'accordion-tight'])
      expect(liquidHoverStages('policy-and-boundaries', part)).toEqual([
        'negative-idle',
        'negative-hover',
        'negative-press',
        'negative-release',
      ]);
  });
  it('writes source-bound plan and initial progress before any server or browser launch', () => {
    const initialized = native.indexOf('await checkpoint.initialize()');
    expect(initialized).toBeGreaterThan(0);
    expect(initialized).toBeLessThan(native.indexOf('baseUrl = await startServer(route)'));
    expect(initialized).toBeLessThan(native.indexOf('browser = await chromium.launch('));
    expect(native).toContain('new URL(request.request().url()).origin === new URL(baseUrl).origin');
    expect(native).toContain(
      "if (process.env.PROTO_UI_BROWSER_BASE_URL) throw new Error('Use this job own loopback server')"
    );
    expect(native).toContain('chromiumSandbox: true');
    expect(native).toContain('expect(sourceSha).toBe(process.env.CANDIDATE_SHA)');
    expect(native).toContain(
      "expect(execFileSync('git', ['diff', '--binary', 'HEAD']).length).toBe(0)"
    );
    expect(native).toContain("['ls-files', '--others', '--exclude-standard']");
  });
});

describe('atomic hover checkpoints retain incomplete evidence without claiming a pass', () => {
  it('starts with all cases, parts and captures not run, bound to exact plan bytes and source', async () => {
    const f = await fixture();
    const progress = await f.read();
    expect(progress.source).toEqual(source);
    expect(progress.planSha256).toBe(
      createHash('sha256')
        .update(await readFile(path.join(f.output, 'plan.json')))
        .digest('hex')
    );
    expect(progress.setup.state).toBe('not-run');
    expect(progress.cases[0].state).toBe('not-run');
    expect(progress.cases[0].parts[0].state).toBe('not-run');
    expect(
      progress.cases[0].parts[0].captures.map((capture: { state: string }) => capture.state)
    ).toEqual(['not-run', 'not-run']);
  });
  it('records a launch/setup failure with every case still not run', async () => {
    const f = await fixture();
    await expect(
      f.checkpoint.setup(async () => {
        throw new Error('browser failed');
      })
    ).rejects.toThrow('browser failed');
    const progress = await f.read();
    expect(progress.setup).toMatchObject({ state: 'failed', failure: 'Error: browser failed' });
    expect(progress.cases[0].state).toBe('not-run');
  });
  it('retains an in-flight capture if interrupted and only completes after all actual work returns', async () => {
    const f = await fixture();
    let release!: () => void;
    let entered!: () => void;
    const running = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const task = f.checkpoint.runCase(f.id, async () => {
      await f.checkpoint.beginPart(f.id, 'button');
      await f.checkpoint.capture(f.id, 'button', 'idle', async () => {
        entered();
        await hold;
      });
      await f.checkpoint.capture(f.id, 'button', 'hover', async () => {});
      await f.checkpoint.finishPart(f.id, 'button', null, []);
    });
    await running;
    const interrupted = await f.read();
    expect(interrupted.cases[0].state).toBe('running');
    expect(interrupted.cases[0].parts[0].state).toBe('running');
    expect(
      interrupted.cases[0].parts[0].captures.map((capture: { state: string }) => capture.state)
    ).toEqual(['running', 'not-run']);
    release();
    await task;
    expect((await f.read()).cases[0].state).toBe('completed');
    expect((await readdir(f.output)).sort()).toEqual(['plan.json', 'progress.json']);
  });
  it('keeps successful captures distinct from a later assertion failure', async () => {
    const f = await fixture();
    await expect(
      f.checkpoint.runCase(f.id, async () => {
        await f.checkpoint.beginPart(f.id, 'button');
        await f.checkpoint.capture(f.id, 'button', 'idle', async () => {});
        await f.checkpoint.finishPart(f.id, 'button', 'ring assertion failed', []);
        throw new Error('ring assertion failed');
      })
    ).rejects.toThrow('ring assertion failed');
    const progress = await f.read();
    expect(progress.cases[0].state).toBe('failed');
    expect(progress.cases[0].parts[0]).toMatchObject({
      state: 'failed',
      failure: expect.stringContaining('ring assertion failed'),
    });
    expect(
      progress.cases[0].parts[0].captures.map((capture: { state: string }) => capture.state)
    ).toEqual(['completed', 'not-run']);
  });
  it('retains failed captures and cleanup failures, and refuses an incomplete case pass', async () => {
    const f = await fixture();
    await expect(
      f.checkpoint.runCase(f.id, async () => {
        await f.checkpoint.beginPart(f.id, 'button');
        await expect(
          f.checkpoint.capture(f.id, 'button', 'idle', async () => {
            throw new Error('capture timeout');
          })
        ).rejects.toThrow('capture timeout');
        await f.checkpoint.finishPart(f.id, 'button', 'capture timeout', ['release failed']);
      })
    ).rejects.toThrow('Incomplete or failed parts');
    const part = (await f.read()).cases[0].parts[0];
    expect(part.state).toBe('failed');
    expect(part.cleanupErrors).toEqual(['release failed']);
    expect(part.captures.map((capture: { state: string }) => capture.state)).toEqual([
      'failed',
      'not-run',
    ]);
    await expect(f.checkpoint.runCase(f.id, async () => {})).rejects.toThrow(
      'Cannot change terminal evidence state'
    );
  });
  it('cannot turn a runner timeout into a completed case when an async body returns late', async () => {
    const f = await fixture();
    await expect(
      f.checkpoint.runCase(
        f.id,
        async () => {
          await f.checkpoint.beginPart(f.id, 'button');
          await f.checkpoint.capture(f.id, 'button', 'idle', async () => {});
          await f.checkpoint.capture(f.id, 'button', 'hover', async () => {});
          await f.checkpoint.finishPart(f.id, 'button', null, []);
        },
        () => true
      )
    ).rejects.toThrow('Vitest already reported failure or timeout');
    const progress = await f.read();
    expect(progress.cases[0].state).toBe('failed');
    expect(progress.cases[0].parts[0].state).toBe('completed');
    expect(native.match(/testContext\.task\.result\?\.state === 'fail'/g)).toHaveLength(2);
  });
  it('refuses unknown and duplicated capture identities instead of silently expanding coverage', async () => {
    const f = await fixture();
    await expect(
      f.checkpoint.runCase(f.id, async () => {
        await f.checkpoint.beginPart(f.id, 'button');
        await expect(
          f.checkpoint.capture(f.id, 'button', 'invented', async () => {})
        ).rejects.toThrow('Unplanned hover capture');
        await f.checkpoint.capture(f.id, 'button', 'idle', async () => {});
        await f.checkpoint.capture(f.id, 'button', 'idle', async () => {});
      })
    ).rejects.toThrow('Cannot change terminal evidence state');
    expect((await f.read()).cases[0].state).toBe('failed');
  });
  it('preserves the prior valid checkpoint if serialization fails before atomic replacement', async () => {
    const f = await fixture();
    const before = await readFile(path.join(f.output, 'progress.json'), 'utf8');
    await expect(
      writeLiquidHoverJsonAtomic(path.join(f.output, 'progress.json'), { invalid: 1n })
    ).rejects.toThrow();
    expect(await readFile(path.join(f.output, 'progress.json'), 'utf8')).toBe(before);
  });
});
