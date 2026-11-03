// @vitest-environment node
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStyleGenerationOwner, startServer, stopServer } from './browser-harness';

async function bounded<T>(promise: Promise<T>, milliseconds: number): Promise<T | 'pending'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<'pending'>((resolve) => {
        timer = setTimeout(() => resolve('pending'), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function fixture(
  mode:
    | 'hold'
    | 'fail'
    | 'fail-large'
    | 'unready'
    | 'orphan'
    | 'exit-before-close'
    | 'exit-and-hold'
    | 'clean-before-close'
    | 'escaped-fail'
    | 'kill-supervisor'
    | 'slow-stop' = 'hold'
) {
  const directory = await mkdtemp(join(tmpdir(), 'pui readiness '));
  const trace = join(directory, 'trace');
  const release = join(directory, 'release');
  const driver = join(directory, 'driver.cjs');
  await writeFile(
    driver,
    String.raw`const fs = require('node:fs');
const { spawn } = require('node:child_process');
const args = process.argv.slice(2);
const trace = process.env.PUI_STARTUP_TRACE;
const record = (line) => fs.appendFileSync(trace, line + '\n');
if (args.includes('--descendant')) {
  process.on('SIGTERM', () => {
    if (['orphan', 'slow-stop'].includes(process.env.PUI_STARTUP_MODE)) record('descendant-ignored');
    else if (process.env.PUI_STARTUP_MODE === 'exit-and-hold') record('descendant-termination-requested');
    else { record('descendant-stopped'); process.exit(0); }
  });
  record('descendant-ready ' + process.pid);
  setInterval(() => {
    if (fs.existsSync(process.env.PUI_STARTUP_RELEASE)) process.exit(0);
  }, 20);
} else if (args.includes('generate:proto-ui-style')) {
  record('generation-start ' + process.pid);
  record('supervisor-pid ' + process.ppid);
  if (process.env.PUI_STARTUP_MODE === 'fail') {
    process.stderr.write('fixture generation failed\n', () => process.exit(7));
  } else if (process.env.PUI_STARTUP_MODE === 'fail-large') {
    process.stderr.write('x'.repeat(262144) + 'fixture failure output end\n', () => process.exit(7));
  } else if (process.env.PUI_STARTUP_MODE === 'kill-supervisor') {
    const parent = process.ppid;
    const command = fs.readFileSync('/proc/' + parent + '/cmdline', 'utf8').split('\0');
    if (parent <= 1 || !command.includes('--style-generation-supervisor')) process.exit(2);
    process.kill(parent, 'SIGKILL');
    setTimeout(() => process.exit(0), 200);
  } else {
    const child = spawn(process.execPath, [__filename, '--descendant'], {
      stdio: ['exit-before-close', 'exit-and-hold', 'clean-before-close', 'escaped-fail'].includes(process.env.PUI_STARTUP_MODE)
        ? ['ignore', 'inherit', 'inherit'] : 'ignore',
      detached: process.env.PUI_STARTUP_MODE === 'escaped-fail'
    });
    record('descendant-pid ' + child.pid);
    if (['exit-before-close', 'exit-and-hold', 'clean-before-close', 'escaped-fail'].includes(process.env.PUI_STARTUP_MODE)) {
      const readiness = setInterval(() => {
        if (fs.readFileSync(trace, 'utf8').includes('descendant-ready ' + child.pid)) {
          clearInterval(readiness);
          record('launcher-exiting');
          if (process.env.PUI_STARTUP_MODE === 'clean-before-close') process.exit(0);
          else process.stderr.write('original-generation-failure\n', () => process.exit(7));
        }
      }, 20);
    }
    let stopping = false;
    process.on('SIGTERM', () => {
      if (process.env.PUI_STARTUP_MODE === 'orphan') process.exit(143);
      if (process.env.PUI_STARTUP_MODE === 'slow-stop') { record('generation-ignored'); return; }
      stopping = true;
      if (child.exitCode !== null || child.signalCode !== null) process.exit(143);
    });
    child.on('exit', () => {
      if (stopping) process.exit(143);
      record('generation-complete');
      process.exit(0);
    });
    const timer = setInterval(() => {
      if (fs.existsSync(process.env.PUI_STARTUP_RELEASE)) {
        clearInterval(timer);
        child.kill(process.env.PUI_STARTUP_MODE === 'slow-stop' ? 'SIGKILL' : 'SIGTERM');
      }
    }, 20);
  }
} else if (args.includes('astro')) {
  record('server-start');
  const port = Number(args[args.indexOf('--port') + 1]);
  require('node:http').createServer((_request, response) => {
    response.writeHead(process.env.PUI_STARTUP_MODE === 'unready' ? 503 : 200);
    response.end('ready');
  }).listen(port, '127.0.0.1');
} else {
  process.exit(2);
}
`
  );
  if (process.platform === 'win32') {
    await writeFile(
      join(directory, 'corepack.cmd'),
      `@echo off\r\n"${process.execPath}" "%~dp0driver.cjs" %*\r\n`
    );
  } else {
    const executable = join(directory, 'corepack');
    await writeFile(executable, `#!/bin/sh\nexec "${process.execPath}" "${driver}" "$@"\n`);
    await chmod(executable, 0o755);
  }
  vi.stubEnv('PATH', `${directory}${delimiter}${process.env.PATH ?? ''}`);
  vi.stubEnv('PUI_STARTUP_TRACE', trace);
  vi.stubEnv('PUI_STARTUP_RELEASE', release);
  vi.stubEnv('PUI_STARTUP_MODE', mode);
  vi.stubEnv('PROTO_UI_BROWSER_BASE_URL', '');
  const events = async () => readFile(trace, 'utf8');
  const waitForEvent = async (event: string) => {
    await vi.waitFor(async () => expect(await events()).toContain(event), {
      timeout: 5000,
      interval: 20,
    });
  };
  const cleanup = async (startup: Promise<unknown>, stopShared = true) => {
    if (mode === 'orphan' || mode === 'escaped-fail') {
      const output = await events().catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return '';
        throw error;
      });
      const pid = Number(/descendant-pid (\d+)/.exec(output)?.[1]);
      if (Number.isInteger(pid) && pid > 0) {
        try {
          const command = (await readFile(`/proc/${pid}/cmdline`, 'utf8')).split('\0');
          if (command.includes(driver) && command.includes('--descendant'))
            process.kill(pid, 'SIGKILL');
        } catch (error) {
          if (!['ENOENT', 'ESRCH'].includes((error as NodeJS.ErrnoException).code ?? ''))
            throw error;
        }
      }
    }
    await writeFile(release, 'release');
    await bounded(startup, 5000);
    if (stopShared) {
      try {
        await stopServer();
      } catch (error) {
        if (mode !== 'escaped-fail' || !String(error).includes('did not finish after teardown'))
          throw error;
      }
    }
    await rm(directory, { recursive: true, force: true });
  };
  return { events, release, waitForEvent, cleanup };
}

describe('documentation server startup ownership', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('cancels safely even before the generation supervisor is ready', async () => {
    const control = await fixture();
    const owner = createStyleGenerationOwner();
    const running = owner.run('corepack').then(
      () => ({ status: 'resolved' as const }),
      (error: unknown) => ({ status: 'rejected' as const, error })
    );
    try {
      const stopping = owner.stop();
      expect(await bounded(running, 1000)).toMatchObject({ status: 'rejected' });
      expect(await bounded(stopping, 5000)).not.toBe('pending');
    } finally {
      await owner.stop();
      await control.cleanup(running, false);
    }
  }, 20_000);

  it('stops pending generation and its descendant without starting a server after teardown', async () => {
    const control = await fixture();
    const startup = startServer('/ready').then(
      () => ({ status: 'resolved' as const }),
      (error: unknown) => ({ status: 'rejected' as const, error })
    );
    try {
      await control.waitForEvent('descendant-ready');
      await Promise.all([stopServer(), stopServer()]);
      const outcome = await bounded(startup, 1000);
      expect(outcome).toMatchObject({ status: 'rejected' });
      const events = await control.events();
      expect(events).not.toContain('server-start');
      if (process.platform !== 'win32') expect(events).toContain('descendant-stopped');
      const pid = Number(/descendant-pid (\d+)/.exec(events)?.[1]);
      expect(Number.isInteger(pid)).toBe(true);
      await vi.waitFor(
        () => {
          let alive = true;
          try {
            process.kill(pid, 0);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
            alive = false;
          }
          expect(alive).toBe(false);
        },
        { timeout: 5000, interval: 20 }
      );
    } finally {
      await control.cleanup(startup);
    }
  }, 20_000);

  it('starts only after generation finishes and can stop the ready server', async () => {
    const control = await fixture();
    const startup = startServer('/ready');
    try {
      await control.waitForEvent('descendant-ready');
      expect(await control.events()).not.toContain('server-start');
      await writeFile(control.release, 'release');
      const url = await startup;
      expect((await fetch(`${url}/ready`)).status).toBe(200);
      const events = await control.events();
      expect(events).toContain('generation-complete');
      expect(events).toContain('server-start');
      expect(events.indexOf('generation-complete')).toBeLessThan(events.indexOf('server-start'));
      await stopServer();
      await expect(fetch(`${url}/ready`)).rejects.toThrow();
    } finally {
      await control.cleanup(startup.catch(() => undefined));
    }
  }, 20_000);

  it.runIf(process.platform === 'linux')(
    'terminates a descendant that survives the generation launcher',
    async () => {
      const control = await fixture('orphan');
      const startup = startServer('/ready').then(
        () => ({ status: 'resolved' as const }),
        (error: unknown) => ({ status: 'rejected' as const, error })
      );
      try {
        await control.waitForEvent('descendant-ready');
        const events = await control.events();
        const pid = Number(/descendant-pid (\d+)/.exec(events)?.[1]);
        expect(Number.isInteger(pid)).toBe(true);
        await stopServer();
        expect(await bounded(startup, 1000)).toMatchObject({ status: 'rejected' });
        await vi.waitFor(
          async () => {
            let alive = true;
            try {
              process.kill(pid, 0);
              if (process.platform === 'linux') {
                const status = await readFile(`/proc/${pid}/stat`, 'utf8').catch(() => '');
                if (/\) Z\s/.test(status)) alive = false;
              }
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
              alive = false;
            }
            expect(alive).toBe(false);
          },
          { timeout: 5000, interval: 20 }
        );
        expect(await control.events()).not.toContain('server-start');
      } finally {
        await control.cleanup(startup);
      }
    },
    20_000
  );

  it.runIf(process.platform !== 'win32')(
    'terminates inherited output holders without masking an earlier generation failure',
    async () => {
      const control = await fixture('exit-and-hold');
      const startup = startServer('/ready').then(
        () => ({ status: 'resolved' as const }),
        (error: unknown) => ({ status: 'rejected' as const, error })
      );
      try {
        await control.waitForEvent('descendant-ready');
        await control.waitForEvent('launcher-exiting');
        await control.waitForEvent('descendant-termination-requested');
        const stopping = stopServer();
        const outcome = await bounded(startup, 1500);
        expect(outcome).toMatchObject({ status: 'rejected' });
        if (outcome === 'pending' || outcome.status !== 'rejected')
          throw new Error('Startup did not reject.');
        expect(String(outcome.error)).toContain('exited with code 7');
        expect(String(outcome.error)).toContain('original-generation-failure');
        await writeFile(control.release, 'release');
        expect(await bounded(stopping, 1500)).not.toBe('pending');
        expect(await control.events()).not.toContain('server-start');
      } finally {
        await control.cleanup(startup);
      }
    },
    20_000
  );

  it.runIf(process.platform !== 'win32')(
    'reports generation failure even when a descendant retains the output pipe',
    async () => {
      const control = await fixture('exit-before-close');
      const startup = startServer('/ready').then(
        () => ({ status: 'resolved' as const }),
        (error: unknown) => ({ status: 'rejected' as const, error })
      );
      try {
        await control.waitForEvent('launcher-exiting');
        const outcome = await bounded(startup, 2500);
        expect(outcome).toMatchObject({ status: 'rejected' });
        if (outcome === 'pending' || outcome.status !== 'rejected')
          throw new Error('Startup did not reject.');
        expect(String(outcome.error)).toContain('exited with code 7');
        expect(String(outcome.error)).toContain('original-generation-failure');
        const events = await control.events();
        expect(events).not.toContain('server-start');
        expect(events).toContain('descendant-stopped');
        expect([...events.matchAll(/descendant-stopped/g)]).toHaveLength(
          [...events.matchAll(/generation-start/g)].length
        );
      } finally {
        await control.cleanup(startup);
      }
    },
    20_000
  );

  it.runIf(process.platform === 'linux')(
    'preserves the generation failure when an escaped output holder cannot be cleaned',
    async () => {
      const control = await fixture('escaped-fail');
      const startup = startServer('/ready').then(
        () => ({ status: 'resolved' as const }),
        (error: unknown) => ({ status: 'rejected' as const, error })
      );
      try {
        await control.waitForEvent('launcher-exiting');
        const outcome = await bounded(startup, 13_000);
        expect(outcome).toMatchObject({ status: 'rejected' });
        if (outcome === 'pending' || outcome.status !== 'rejected')
          throw new Error('Startup did not reject.');
        expect(outcome.error).toBeInstanceOf(AggregateError);
        const errors = (outcome.error as AggregateError).errors;
        expect(String(errors[0])).toContain('exited with code 7');
        expect(String(errors[0])).toContain('original-generation-failure');
        expect(String(errors[1])).toContain('did not finish after teardown');
        const events = await control.events();
        expect(events).not.toContain('server-start');
        const supervisorPid = Number(/supervisor-pid (\d+)/.exec(events)?.[1]);
        expect(Number.isInteger(supervisorPid)).toBe(true);
        await vi.waitFor(
          () => {
            try {
              process.kill(supervisorPid, 0);
            } catch (error) {
              expect((error as NodeJS.ErrnoException).code).toBe('ESRCH');
              return;
            }
            throw new Error('Generation supervisor is still running.');
          },
          { timeout: 5000, interval: 20 }
        );
      } finally {
        await control.cleanup(startup);
      }
    },
    25_000
  );

  it.runIf(process.platform !== 'win32')(
    'waits for a successful launcher output pipe to close before succeeding',
    async () => {
      const control = await fixture('clean-before-close');
      const owner = createStyleGenerationOwner();
      const running = owner.run('corepack').then(
        () => ({ status: 'resolved' as const }),
        (error: unknown) => ({ status: 'rejected' as const, error })
      );
      try {
        await control.waitForEvent('launcher-exiting');
        expect(await bounded(running, 100)).toBe('pending');
        await writeFile(control.release, 'release');
        expect(await bounded(running, 1500)).toMatchObject({ status: 'resolved' });
      } finally {
        await owner.stop();
        await control.cleanup(running, false);
      }
    },
    20_000
  );

  it.runIf(process.platform !== 'win32')(
    'rejects and cleans a successful launcher whose output never closes',
    async () => {
      const control = await fixture('clean-before-close');
      const owner = createStyleGenerationOwner();
      const running = owner.run('corepack').then(
        () => ({ status: 'resolved' as const }),
        (error: unknown) => ({ status: 'rejected' as const, error })
      );
      try {
        await control.waitForEvent('launcher-exiting');
        const outcome = await bounded(running, 8000);
        expect(outcome).toMatchObject({ status: 'rejected' });
        if (outcome === 'pending' || outcome.status !== 'rejected')
          throw new Error('Generation did not reject.');
        expect(String(outcome.error)).toContain('output remained open');
        expect(await control.events()).toContain('descendant-stopped');
      } finally {
        await owner.stop();
        await control.cleanup(running, false);
      }
    },
    20_000
  );

  it.runIf(process.platform !== 'win32')(
    'rejects startup immediately while a slow generation tree is still stopping',
    async () => {
      const control = await fixture('slow-stop');
      const startup = startServer('/ready').then(
        () => ({ status: 'resolved' as const }),
        (error: unknown) => ({ status: 'rejected' as const, error })
      );
      try {
        await control.waitForEvent('descendant-ready');
        const stopping = stopServer();
        expect(await bounded(startup, 1000)).toMatchObject({ status: 'rejected' });
        expect(await bounded(stopping, 100)).toBe('pending');
        await writeFile(control.release, 'release');
        expect(await bounded(stopping, 2000)).not.toBe('pending');
        expect(await control.events()).not.toContain('server-start');
      } finally {
        await control.cleanup(startup);
      }
    },
    20_000
  );

  it('retains generation failure output and never launches a server', async () => {
    const control = await fixture('fail');
    const startup = startServer('/ready');
    try {
      await expect(startup).rejects.toThrow('fixture generation failed');
      expect(await control.events()).not.toContain('server-start');
    } finally {
      await control.cleanup(startup.catch(() => undefined));
    }
  }, 20_000);

  it('retains the end of a large generation failure before cleanup', async () => {
    const control = await fixture('fail-large');
    const startup = startServer('/ready');
    try {
      await expect(startup).rejects.toThrow('fixture failure output end');
      expect(await control.events()).not.toContain('server-start');
    } finally {
      await control.cleanup(startup.catch(() => undefined));
    }
  }, 20_000);

  it.runIf(process.platform === 'linux')(
    'rejects startup if its generation supervisor exits unexpectedly',
    async () => {
      const control = await fixture('kill-supervisor');
      const startup = startServer('/ready');
      try {
        await expect(startup).rejects.toThrow(
          'Style generation supervisor exited before reporting completion.'
        );
        expect(await control.events()).not.toContain('server-start');
      } finally {
        await control.cleanup(startup.catch(() => undefined));
      }
    },
    20_000
  );

  it('does not retry server startup after teardown during readiness', async () => {
    const control = await fixture('unready');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const startup = startServer('/ready').then(
      () => ({ status: 'resolved' as const }),
      (error: unknown) => ({ status: 'rejected' as const, error })
    );
    try {
      await control.waitForEvent('descendant-ready');
      await writeFile(control.release, 'release');
      await control.waitForEvent('server-start');
      await stopServer();
      expect(await bounded(startup, 5000)).toMatchObject({ status: 'rejected' });
      expect((await control.events()).match(/server-start/g)).toHaveLength(1);
    } finally {
      await control.cleanup(startup);
    }
  }, 20_000);
});
