// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { launch } = vi.hoisted(() => ({ launch: vi.fn() }));
vi.mock('playwright-core', () => ({ chromium: { launch } }));

import { launchBrowser } from './browser-harness';

describe('documentation browser isolation', () => {
  let directory: string;
  let executable: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'pui-browser-launch-'));
    executable = join(directory, 'chrome');
    await writeFile(executable, 'launcher boundary fixture');
    vi.stubEnv('CHROME_PATH', executable);
    launch.mockReset();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  });

  it('launches the selected executable with the normal Chromium sandbox', async () => {
    const browser = { close: vi.fn() };
    launch.mockResolvedValueOnce(browser);

    expect(await launchBrowser()).toBe(browser);
    expect(launch).toHaveBeenCalledOnce();
    const options = launch.mock.calls[0]![0];
    expect(options).toMatchObject({
      executablePath: executable,
      headless: true,
      chromiumSandbox: true,
    });
    expect(options.args).toContain('--disable-dev-shm-usage');
    expect(options.args).not.toContain('--no-sandbox');
    expect(options.args).not.toContain('--disable-setuid-sandbox');
    expect(options).not.toHaveProperty('handleSIGTERM');
    expect(options).not.toHaveProperty('handleSIGINT');
    expect(options).not.toHaveProperty('handleSIGHUP');
  });

  it('leaves capture signals to the explicit owner without weakening Chromium isolation', async () => {
    const browser = { close: vi.fn() };
    launch.mockResolvedValueOnce(browser);

    expect(await launchBrowser({ captureOwnsSignals: true })).toBe(browser);
    expect(launch).toHaveBeenCalledOnce();
    expect(launch.mock.calls[0]![0]).toMatchObject({
      executablePath: executable,
      chromiumSandbox: true,
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
    });
  });

  it('preserves a sandbox launch failure without retrying with weaker isolation', async () => {
    const failure = new Error('sandbox unavailable');
    launch.mockRejectedValueOnce(failure);

    await expect(launchBrowser()).rejects.toBe(failure);
    expect(launch).toHaveBeenCalledOnce();
    expect(launch.mock.calls[0]![0].chromiumSandbox).toBe(true);
  });
});
