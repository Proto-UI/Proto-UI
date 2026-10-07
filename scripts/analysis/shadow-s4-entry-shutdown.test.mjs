/** Requires the running www server and Chrome. Only checks diagnostic data retention. */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

for (const target of ['page', 'browser']) {
  test(`S4 diagnostic preserves partial evidence when ${target} closes`, async () => {
    const runner = `
      import {createRequire} from 'node:module';
      const require = createRequire(new URL('./apps/www/package.json', 'file://' + process.cwd() + '/'));
      const {chromium} = require('playwright-core');
      const launch = chromium.launch.bind(chromium);
      let browser;
      chromium.launch = async options => (browser = await launch(options));
      const write = process.stdout.write.bind(process.stdout);
      let armed = false;
      process.stdout.write = (chunk, ...args) => {
        if (!armed && String(chunk).includes('"experimentReceipt"')) {
          armed = true;
          setTimeout(() => {
            const target = ${JSON.stringify(target)} === 'page' ? browser.contexts()[0].pages()[0] : browser;
            void target.close();
          }, 1800);
        }
        return write(chunk, ...args);
      };
      await import('./scripts/analysis/shadow-s4-entry-browser.mjs');
    `;
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ['--input-type=module', '-e', runner],
      {
        cwd: new URL('../../', import.meta.url),
        env: {
          ...process.env,
          S4_ENTRY_HEADLESS: '1',
          S4_ENTRY_ROUNDS: '4',
          S4_ENTRY_MANUAL: '0',
          S4_ENTRY_PROBE: '0',
          S4_ENTRY_EXPERIMENT: 'explicit',
          S4_ENTRY_PROFILE: 'split',
        },
        timeout: 30_000,
      }
    );
    const receipt = stdout
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line))
      .at(-1);
    const report = JSON.parse(await readFile(`${receipt.output}/report.json`, 'utf8'));
    assert.equal(report.status, 'interrupted');
    assert.equal(report.interrupted, true);
    assert.equal(report.pageClosed, true);
    assert.equal(report.captureError, null);
    assert.ok(report.samples.length > 0);
    assert.ok(report.states.some((s) => s.open));
    assert.ok(report.events.some((e) => e.kind === 'experiment-check' && e.valid));
    assert.equal(report.eventsSource, 'streamed-partial');
    console.log(JSON.stringify({ target, output: receipt.output, samples: report.samples.length }));
  });
}
