// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { emitFlutterSource } from '../src/flutter-source';
import { parsePrototype } from '../src/parser';

// Opt-in actual Widget consumption of the dormant direct emitter. A skipped
// lane supplies no evidence and never activates the public Flutter profile.
const flutter = process.env.PROTO_UI_FLUTTER;
const evidence = process.env.PROTO_UI_FLUTTER_EVIDENCE_DIR;
const fixture = fileURLToPath(new URL('./fixtures/flutter-scroll-outcomes/', import.meta.url));
const binding = (name: string) => `v_${Buffer.from(name).toString('hex')}`;

describe.skipIf(!flutter)('Flutter checked Scroll outcome consumers', () => {
  it('executes checked union conversion and real Widget request/lifetime behavior', () => {
    const source = readFileSync(path.join(fixture, 'authored.proto.ts'), 'utf8');
    const parsed = parsePrototype(source, { fileName: 'flutter-scroll-outcomes.proto.ts' });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const emitted = emitFlutterSource(parsed.value);
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    if (evidence) mkdirSync(evidence, { recursive: true });
    const directory = mkdtempSync(path.join(evidence ?? tmpdir(), 'proto-flutter-scroll-'));
    const put = (name: string, contents: string) => {
      const file = path.join(directory, name);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, contents);
    };
    put('authored.proto.ts', source);
    put('checked-ir.json', JSON.stringify(parsed.value, null, 2));
    // Preserve the exact generated library separately. This appended access
    // function invokes its existing native module-exposure fallback, with a
    // real NativeOwner and caller-supplied raw input. It neither replaces the
    // conversion nor intercepts NativeScroll in the Widget cases.
    put('lib/Component.dart.generated', emitted.value.code);
    put('lib/Component.dart', `${emitted.value.code}
(Object?, int) probeCheckedOutcome(Map<String, Object?> input) {
  final owner = _Owner(() {}, null);
  var evaluations = 0;
  owner.moduleExpose('wrongAxisOutcome', () { evaluations++; return input; });
  owner.finishSetup({});
  try {
    return (owner.${binding('wrongAxisOutcome')}(), evaluations);
  } finally {
    owner.close();
  }
}
`);
    for (const file of emitted.value.supportingFiles ?? []) {
      put(file.path === 'pubspec.yaml' ? file.path : path.join('lib', file.path), file.contents);
    }
    const manifest = readFileSync(path.join(directory, 'pubspec.yaml'), 'utf8');
    put('pubspec.yaml.generated', manifest);
    put('pubspec.yaml', `${manifest}dev_dependencies:\n  flutter_test:\n    sdk: flutter\n`);
    put('test/consumer_test.dart', readFileSync(path.join(fixture, 'consumer_test.dart'), 'utf8'));
    const run = (label: string, args: string[], timeout: number) => {
      const result = spawnSync(flutter!, args, {
        cwd: directory,
        encoding: 'utf8',
        timeout,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, CI: 'true', FLUTTER_SUPPRESS_ANALYTICS: 'true', DART_SUPPRESS_ANALYTICS: 'true' },
      });
      put(`${label}.json`, JSON.stringify({
        command: [flutter, ...args], cwd: directory, status: result.status,
        signal: result.signal, error: result.error?.message,
        stdout: result.stdout, stderr: result.stderr,
      }, null, 2));
      const output = `${result.stdout}\n${result.stderr}\nEvidence: ${directory}`;
      expect(result.error, output).toBeUndefined();
      expect(result.status, output).toBe(0);
    };
    try {
      run('pub-get', ['pub', 'get', '--offline'], 120_000);
      run('widgets', ['test', '--no-pub', '--reporter', 'expanded', 'test/consumer_test.dart'], 180_000);
    } finally {
      if (!evidence) rmSync(directory, { recursive: true, force: true });
    }
  }, 360_000);
});
