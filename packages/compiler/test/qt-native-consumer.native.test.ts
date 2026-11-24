// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareQtNativeConsumer, qtNativeCases } from './fixtures/qt-native-consumer/prepare';

// Skipping this opt-in native lane is not acceptance of Qt or its public profile.
const sdk = process.env.PROTO_UI_QT_DIR;
const evidence = process.env.PROTO_UI_QT_EVIDENCE_DIR;
describe.skipIf(!sdk)('actual Qt 6.4.2 native source consumer', () => {
  it('executes Root children, native Scroll axes and physical-view retirement', () => {
    if (evidence) mkdirSync(evidence, { recursive: true });
    const directory = mkdtempSync(path.join(evidence ?? tmpdir(), 'proto-qt-native-'));
    const receipt = prepareQtNativeConsumer(directory);
    const cmake = process.env.PROTO_UI_QT_CMAKE ?? 'cmake';
    const sysroot = process.env.PROTO_UI_QT_SYSROOT;
    const env = {
      ...process.env,
      QT_QPA_PLATFORM: 'offscreen',
      QT_QUICK_BACKEND: 'software',
      QT_PLUGIN_PATH: path.join(sdk!, 'plugins'),
      QML_IMPORT_PATH: path.join(sdk!, 'qml'),
      LD_LIBRARY_PATH: [
        path.join(sdk!, 'lib'),
        ...(sysroot ? [path.join(sysroot, 'usr/lib/x86_64-linux-gnu')] : []),
        process.env.LD_LIBRARY_PATH,
      ]
        .filter(Boolean)
        .join(':'),
    };
    const run = (label: string, args: string[], timeout: number) => {
      const started = new Date().toISOString();
      const result = spawnSync(args[0], args.slice(1), {
        cwd: directory,
        env,
        encoding: 'utf8',
        timeout,
        maxBuffer: 16 * 1024 * 1024,
      });
      const observed = {
        command: args,
        startedAt: started,
        endedAt: new Date().toISOString(),
        status: result.status,
        signal: result.signal,
        error: result.error?.message,
        stdout: result.stdout,
        stderr: result.stderr,
      };
      writeFileSync(
        path.join(directory, `${label}.json`),
        JSON.stringify(observed, null, 2) + '\n'
      );
      expect(result.error, JSON.stringify(observed)).toBeUndefined();
      expect(result.status, JSON.stringify(observed)).toBe(0);
      return `${result.stdout}\n${result.stderr}`;
    };
    try {
      expect(
        run('qt-version', [path.join(sdk!, 'bin/qmake'), '-query', 'QT_VERSION'], 10_000).trim()
      ).toBe('6.4.2');
      run(
        'configure',
        [
          cmake,
          '-S',
          '.',
          '-B',
          'build',
          '-G',
          'Ninja',
          '-DCMAKE_BUILD_TYPE=Release',
          `-DCMAKE_PREFIX_PATH=${sdk}${sysroot ? ';' + path.join(sysroot, 'usr') : ''}`,
          ...(sysroot
            ? [
                `-DCMAKE_INCLUDE_PATH=${path.join(sysroot, 'usr/include')}`,
                `-DCMAKE_LIBRARY_PATH=${path.join(sysroot, 'usr/lib/x86_64-linux-gnu')}`,
              ]
            : []),
        ],
        90_000
      );
      run('build', [cmake, '--build', 'build', '--parallel', '2'], 180_000);
      const output = run(
        'consumer',
        [path.join(directory, 'build/compiled-qt'), path.join(directory, 'Consumer.qml')],
        30_000
      );
      const results = output.split('\n').filter((line) => line.includes('PUI_QT_RESULT '));
      expect(results).toHaveLength(1);
      const actual = JSON.parse(results[0].split('PUI_QT_RESULT ')[1]);
      expect(actual).toMatchObject({ passed: qtNativeCases.length, failed: 0 });
      expect(actual.cases).toEqual(qtNativeCases.map((name) => ({ name, status: 'passed' })));
    } finally {
      const drift = receipt.files.filter(
        ({ file, sha256 }) =>
          createHash('sha256')
            .update(readFileSync(path.join(directory, file)))
            .digest('hex') !== sha256
      );
      writeFileSync(
        path.join(directory, 'generated-drift.json'),
        JSON.stringify(drift, null, 2) + '\n'
      );
      expect(drift).toEqual([]);
      if (!evidence) rmSync(directory, { recursive: true, force: true });
    }
  }, 330_000);
});
