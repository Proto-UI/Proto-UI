// @vitest-environment node
import { mkdir, mkdtemp, readFile, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compileFile, compilePrototype, diffCompilation, writeCompilation } from '../src/compile';
import { compileProject } from '../src/project';
import { diffProjectCompilation, writeProjectCompilation } from '../src/project-output';
import { runCompilerCli } from '../src/cli';
import { verifyGpuiNativeSdk } from '../src/gpui-native-sdk-compatibility';

const temporary: string[] = [];
const source = `import { definePrototype } from '@proto.ui/core';
export default definePrototype({ name: 'shared-sdk-fixture', setup() { return r => r.slot(); } });`;
type WatchEvent =
  | { ok: true; result: { directory: string } }
  | {
      ok: false;
      diagnostics: { code: string }[];
      fatal: boolean;
      lastSuccessful?: { directory: string };
    };

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'proto-gpui-sdk-'));
  temporary.push(root);
  await writeFile(path.join(root, 'entry.proto.ts'), source);
  return root;
}

async function invoke(root: string, args: string[]) {
  let stdout = '';
  let stderr = '';
  const code = await runCompilerCli([...args, '--json'], {
    cwd: root,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  expect(stderr).toBe('');
  return { code, result: JSON.parse(stdout) };
}

function component(nativeSdkPath?: string, workspace = true) {
  const result = compilePrototype(source, {
    profile: 'gpui-source-v1',
    nativeSdkPath,
    gpuiDependency: workspace ? 'workspace' : undefined,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

async function bundled(root: string, workspace = true) {
  expect(
    await writeCompilation(component(undefined, workspace), path.join(root, 'owner'))
  ).toMatchObject({ ok: true });
  return path.join(root, 'owner/.proto-ui/gpui-native');
}

afterEach(async () => {
  for (const directory of temporary.splice(0))
    await rm(directory, { recursive: true, force: true });
});

describe('shared GPUI SDK compatibility', () => {
  it.each([false, true])(
    'requires a separate opt-in for native text selection notification (workspace=%s)',
    (workspace) => {
      const files = component(undefined, workspace).output.supportingFiles!;
      const manifest = files.find((file) => file.path.endsWith('/gpui-native/Cargo.toml'))!.contents;
      expect(manifest).toContain('gpui-text-selection-notification = []');
      expect(manifest.match(/^default = .*$/m)?.[0] ?? '').not.toContain(
        'gpui-text-selection-notification'
      );
      const owner = files.find((file) => file.path.endsWith('gpui-native-owner.rs'))!.contents;
      expect(owner).toContain(
        '#[cfg(feature = "gpui-text-selection-notification")]\n    if let Some(focus)=_focus{window.notify_text_selection_changed(&focus);}'
      );
    }
  );

  it('carries workspace GPUI through the SDK CLI and two independent component publications', async () => {
    const root = await fixture();
    expect(
      (await invoke(root, ['emit-gpui-sdk', '--output', 'sdk', '--gpui-dependency', 'workspace']))
        .code
    ).toBe(0);
    const sdk = await readFile(path.join(root, 'sdk/Cargo.toml'), 'utf8');
    expect(sdk).toContain('gpui = { workspace = true }');
    expect(sdk).not.toContain('git =');
    for (const output of ['first', 'second']) {
      const emitted = await invoke(root, [
        'compile',
        'entry.proto.ts',
        '--profile',
        'gpui-source-v1',
        '--gpui-dependency',
        'workspace',
        '--native-sdk-path',
        'sdk',
        '--output',
        output,
      ]);
      expect(emitted.code).toBe(0);
      expect(await readFile(path.join(root, output, 'Cargo.toml'), 'utf8')).toContain(
        'gpui = { workspace = true }'
      );
      const provenance = JSON.parse(
        await readFile(path.join(root, output, 'provenance.json'), 'utf8')
      );
      expect(provenance.nativeSdk).toMatchObject({ bundled: false, dependencyMode: 'workspace' });
      expect(provenance.nativeSdk.contentSha256).toMatch(/^[a-f0-9]{64}$/);
      await expect(stat(path.join(root, output, '.proto-ui/gpui-native'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
    }
  });

  it('resolves a shared SDK relative to the output crate and refuses a different dependency mode', async () => {
    const root = await fixture();
    await bundled(root);
    expect(
      await writeCompilation(component('../owner/.proto-ui/gpui-native'), path.join(root, 'child'))
    ).toMatchObject({ ok: true });
    const wrong = await writeCompilation(
      component('../owner/.proto-ui/gpui-native', false),
      path.join(root, 'wrong')
    );
    expect(wrong).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI_GPUI_SDK_COMPATIBILITY' }],
    });
    await expect(stat(path.join(root, 'wrong'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects altered SDK source at the same package version before reserving output', async () => {
    const root = await fixture();
    const sdk = await bundled(root);
    const native = path.join(sdk, 'src/gpui-native-host.rs');
    await writeFile(
      native,
      (await readFile(native, 'utf8')) + '\n// changed after SDK generation\n'
    );
    expect(
      await writeCompilation(component('../owner/.proto-ui/gpui-native'), path.join(root, 'child'))
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI_GPUI_SDK_COMPATIBILITY' }] });
    await expect(stat(path.join(root, 'child'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects relative SDK paths that select different directories through an output ancestor link', async () => {
    const root = await fixture();
    await mkdir(path.join(root, 'physical/nested'), { recursive: true });
    await symlink(path.join(root, 'physical/nested'), path.join(root, 'alias'), 'dir');
    for (const output of ['sdk', 'physical/sdk', 'physical/nested/sdk']) {
      expect(
        (
          await invoke(root, [
            'emit-gpui-sdk',
            '--output',
            output,
            '--gpui-dependency',
            'workspace',
          ])
        ).code
      ).toBe(0);
    }
    const badSource = path.join(root, 'physical/sdk/src/gpui-native-host.rs');
    await writeFile(
      badSource,
      (await readFile(badSource, 'utf8')) + '\n// incompatible physical SDK\n'
    );
    const ambiguous = component('../../sdk');
    const destination = path.join(root, 'alias/component');
    expect(await writeCompilation(ambiguous, destination)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI_GPUI_SDK_COMPATIBILITY' }],
    });
    expect(await diffCompilation(ambiguous, destination)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI_GPUI_SDK_COMPATIBILITY' }],
    });
    await expect(stat(destination)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(
      await writeCompilation(component(path.join(root, 'sdk')), path.join(root, 'alias/absolute'))
    ).toMatchObject({ ok: true });
    expect(
      await writeCompilation(component('../sdk'), path.join(root, 'alias/relative'))
    ).toMatchObject({ ok: true });
  });

  it('rejects a missing shared SDK in file checking without treating pure emission as verified publication', async () => {
    const root = await fixture();
    const missing = path.join(root, 'missing');
    expect(component(missing).output.profile).toBe('gpui-source-v1');
    expect(
      await compileFile(path.join(root, 'entry.proto.ts'), {
        root,
        profile: 'gpui-source-v1',
        nativeSdkPath: missing,
        gpuiDependency: 'workspace',
      })
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI_GPUI_SDK_COMPATIBILITY' }] });
    expect(await writeCompilation(component('../missing'), path.join(root, 'child'))).toMatchObject(
      { ok: false, diagnostics: [{ code: 'PUI_GPUI_SDK_COMPATIBILITY' }] }
    );
  });

  it('rechecks SDK bytes on a project cache hit and recovers after restoration', async () => {
    const root = await fixture();
    const sdk = await bundled(root);
    const options = {
      root,
      entries: ['entry.proto.ts'],
      profile: 'gpui-source-v1',
      nativeSdkPath: sdk,
      gpuiDependency: 'workspace' as const,
    };
    const initial = await compileProject(options);
    if (!initial.ok) throw new Error(JSON.stringify(initial.diagnostics));
    const filename = path.join(sdk, 'src/gpui-native-host.rs');
    const original = await readFile(filename, 'utf8');
    await writeFile(filename, original + '\n// incompatible\n');
    expect(await compileProject(options, initial.value.project)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI_GPUI_SDK_COMPATIBILITY' }],
    });
    await writeFile(filename, original);
    expect(await compileProject(options, initial.value.project)).toMatchObject({ ok: true });
  });

  it('rechecks a retained project generation at both publication and diff boundaries', async () => {
    const root = await fixture();
    const sdk = await bundled(root);
    const result = await compileProject({
      root,
      entries: ['entry.proto.ts'],
      profile: 'gpui-source-v1',
      nativeSdkPath: sdk,
      gpuiDependency: 'workspace',
    });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const outputs = { sourcePaths: { 'entry.proto.ts': 'Component.rs' } };
    const first = path.join(root, 'first');
    expect(await writeProjectCompilation(result.value, first, outputs)).toMatchObject({ ok: true });
    expect(await diffProjectCompilation(result.value, first, outputs)).toMatchObject({ ok: true });
    const filename = path.join(sdk, 'src/gpui-native-host.rs');
    await writeFile(
      filename,
      (await readFile(filename, 'utf8')) + '\n// changed after compilation\n'
    );
    expect(
      await writeProjectCompilation(result.value, path.join(root, 'second'), outputs)
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI_GPUI_SDK_COMPATIBILITY' }] });
    expect(await diffProjectCompilation(result.value, first, outputs)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI_GPUI_SDK_COMPATIBILITY' }],
    });
    await expect(stat(path.join(root, 'second'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects foreign build input and symlinked SDK files without touching them', async () => {
    const root = await fixture();
    const sdk = await bundled(root);
    await writeFile(path.join(sdk, 'build.rs'), 'fn main() {}\n');
    expect(await writeCompilation(component(sdk), path.join(root, 'foreign'))).toMatchObject({
      ok: false,
    });
    await rm(path.join(sdk, 'build.rs'));
    const host = path.join(sdk, 'src/gpui-native-host.rs');
    const bytes = await readFile(host);
    const foreign = path.join(root, 'host.rs');
    await writeFile(foreign, bytes);
    await rm(host);
    await symlink(foreign, host);
    expect(await writeCompilation(component(sdk), path.join(root, 'linked'))).toMatchObject({
      ok: false,
    });
    expect(await readFile(foreign)).toEqual(bytes);
  });

  it('accepts the workspace config and rejects invalid or irrelevant dependency options', async () => {
    const root = await fixture();
    await writeFile(
      path.join(root, 'sdk.json'),
      JSON.stringify({ output: 'sdk', gpuiDependency: 'workspace' })
    );
    expect((await invoke(root, ['emit-gpui-sdk', '--config', 'sdk.json'])).code).toBe(0);
    await writeFile(
      path.join(root, 'compiler.json'),
      JSON.stringify({
        entry: 'entry.proto.ts',
        profile: 'gpui-source-v1',
        nativeSdkPath: 'sdk',
        gpuiDependency: 'workspace',
      })
    );
    expect((await invoke(root, ['check', '--config', 'compiler.json'])).code).toBe(0);
    for (const args of [
      ['check', 'entry.proto.ts', '--gpui-dependency', 'workspace'],
      ['emit-gpui-sdk', '--output', 'invalid', '--gpui-dependency', 'registry'],
    ])
      expect((await invoke(root, args)).code).toBe(2);
    await writeFile(
      path.join(root, 'invalid.json'),
      JSON.stringify({ output: 'invalid', gpuiDependency: true })
    );
    expect((await invoke(root, ['emit-gpui-sdk', '--config', 'invalid.json'])).code).toBe(2);
    await expect(stat(path.join(root, 'invalid'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects receipt records with unknown paths and missing kind/hash fields', async () => {
    const root = await fixture();
    expect(
      (await invoke(root, ['emit-gpui-sdk', '--output', 'sdk', '--gpui-dependency', 'workspace']))
        .code
    ).toBe(0);
    const receiptPath = path.join(root, 'sdk/provenance.json');
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
    receipt.artifacts = receipt.artifacts.map((_: unknown, index: number) => ({
      path: `unowned-${index}`,
    }));
    await writeFile(receiptPath, JSON.stringify(receipt));
    expect(await verifyGpuiNativeSdk(path.join(root, 'sdk'), true)).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'PUI_GPUI_SDK_COMPATIBILITY',
          message: expect.stringContaining('compiler-owned source inventory'),
        },
      ],
    });
  });

  it('binds the checked SDK obligation to the generated Cargo manifest before publication', async () => {
    const root = await fixture();
    const sdk = await bundled(root);
    const compiled = component(sdk);
    const cargo = compiled.output.supportingFiles!.find((file) => file.path === 'Cargo.toml')!;
    cargo.contents = cargo.contents.replace(
      JSON.stringify(sdk),
      JSON.stringify('/foreign/not-the-verified-sdk')
    );
    expect(await writeCompilation(compiled, path.join(root, 'redirected'))).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI_GPUI_SDK_COMPATIBILITY', message: expect.stringContaining('Cargo manifest') },
      ],
    });
    await expect(stat(path.join(root, 'redirected'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('tracks a canonical SDK behind a symbolic-link ancestor instead of reporting an unwatched success', async () => {
    const root = await fixture();
    const sdk = await bundled(root);
    const alias = path.join(root, 'alias');
    await symlink(path.join(root, 'owner'), alias, 'dir');
    const project = path.join(root, 'project');
    await mkdir(project);
    await writeFile(path.join(project, 'entry.proto.ts'), source);
    const cancellation = new AbortController();
    const events: WatchEvent[] = [];
    const finished = runCompilerCli(
      [
        'watch',
        'entry.proto.ts',
        '--output',
        'versions',
        '--profile',
        'gpui-source-v1',
        '--gpui-dependency',
        'workspace',
        '--native-sdk-path',
        path.join(alias, '.proto-ui/gpui-native'),
        '--json',
      ],
      {
        cwd: project,
        signal: cancellation.signal,
        stdout: (text) => {
          events.push(JSON.parse(text));
        },
        stderr: (text) => {
          throw new Error(text);
        },
      }
    );
    try {
      await expect.poll(() => events.filter((event) => event.ok).length).toBe(1);
      const filename = path.join(sdk, 'src/gpui-native-host.rs');
      const original = await readFile(filename, 'utf8');
      await writeFile(filename, original + '\n// changed behind ancestor link\n');
      await expect
        .poll(() => events.find((event) => !event.ok))
        .toMatchObject({
          fatal: false,
          diagnostics: [{ code: 'PUI_GPUI_SDK_COMPATIBILITY' }],
        });
      await writeFile(filename, original);
      await expect.poll(() => events.filter((event) => event.ok).length).toBe(2);
    } finally {
      cancellation.abort();
      expect(await finished).toBe(0);
    }
  });

  it('observes a nested SDK ancestor-link retarget, rejects its new inventory and recovers at the selected link', async () => {
    const root = await fixture();
    const oldSdk = await bundled(root);
    const other = path.join(root, 'other');
    await mkdir(path.join(other, '.proto-ui'), { recursive: true });
    expect(
      (
        await invoke(root, [
          'emit-gpui-sdk',
          '--output',
          path.join(other, '.proto-ui/gpui-native'),
          '--gpui-dependency',
          'workspace',
        ])
      ).code
    ).toBe(0);
    await writeFile(path.join(other, '.proto-ui/gpui-native/build.rs'), 'fn main() {}\n');
    const links = path.join(root, 'nested/links');
    await mkdir(links, { recursive: true });
    const alias = path.join(links, 'alias');
    await symlink(path.join(root, 'owner'), alias, 'dir');
    async function retarget(target: string) {
      await symlink(target, `${alias}.next`, 'dir');
      await rename(`${alias}.next`, alias);
    }
    const project = path.join(root, 'project');
    await mkdir(project);
    await writeFile(path.join(project, 'entry.proto.ts'), source);
    const cancellation = new AbortController();
    const events: WatchEvent[] = [];
    const finished = runCompilerCli(
      [
        'watch',
        'entry.proto.ts',
        '--output',
        'versions',
        '--profile',
        'gpui-source-v1',
        '--gpui-dependency',
        'workspace',
        '--native-sdk-path',
        path.join(alias, '.proto-ui/gpui-native'),
        '--json',
      ],
      {
        cwd: project,
        signal: cancellation.signal,
        stdout: (text) => {
          events.push(JSON.parse(text));
        },
        stderr: (text) => {
          throw new Error(text);
        },
      }
    );
    try {
      await expect.poll(() => events.filter((event) => event.ok).length).toBe(1);
      await retarget(other);
      await expect
        .poll(() => events.find((event) => !event.ok))
        .toMatchObject({
          fatal: false,
          diagnostics: [{ code: 'PUI_GPUI_SDK_COMPATIBILITY' }],
        });
      const oldFile = path.join(oldSdk, 'src/gpui-native-host.rs');
      const oldBytes = await readFile(oldFile);
      await writeFile(oldFile, Buffer.concat([oldBytes, Buffer.from('\n// retired SDK edit\n')]));
      await writeFile(oldFile, oldBytes);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(events.filter((event) => event.ok)).toHaveLength(1);
      await retarget(path.join(root, 'owner'));
      await expect.poll(() => events.filter((event) => event.ok).length).toBe(2);
    } finally {
      cancellation.abort();
      expect(await finished).toBe(0);
    }
  });

  it('watches an external SDK source, reports incompatible bytes and recovers without editing authored source', async () => {
    const root = await fixture();
    const sdk = await bundled(root);
    const project = path.join(root, 'project');
    await mkdir(project);
    await writeFile(path.join(project, 'entry.proto.ts'), source);
    await writeFile(
      path.join(project, 'compiler.json'),
      JSON.stringify({
        entry: 'entry.proto.ts',
        root: '.',
        output: 'versions',
        profile: 'gpui-source-v1',
        nativeSdkPath: '../owner/.proto-ui/gpui-native',
        gpuiDependency: 'workspace',
        json: true,
      })
    );
    const cancellation = new AbortController();
    const events: WatchEvent[] = [];
    const finished = runCompilerCli(['watch', '--config', 'compiler.json'], {
      cwd: project,
      signal: cancellation.signal,
      stdout: (text) => {
        events.push(JSON.parse(text));
      },
      stderr: (text) => {
        throw new Error(text);
      },
    });
    try {
      await expect.poll(() => events.filter((event) => event.ok).length).toBe(1);
      const first = events.find((event) => event.ok)!;
      expect(await readFile(path.join(first.result.directory, 'Cargo.toml'), 'utf8')).toContain(
        'gpui = { workspace = true }'
      );
      const filename = path.join(sdk, 'src/gpui-native-host.rs');
      const bytes = await readFile(filename);
      await writeFile(filename, Buffer.concat([bytes, Buffer.from('\n// source mutation\n')]));
      await expect
        .poll(() => events.find((event) => !event.ok))
        .toMatchObject({
          fatal: false,
          diagnostics: [{ code: 'PUI_GPUI_SDK_COMPATIBILITY' }],
          lastSuccessful: { directory: first.result.directory },
        });
      await writeFile(filename, bytes);
      await expect.poll(() => events.filter((event) => event.ok).length).toBe(2);
      const second = events.filter((event) => event.ok)[1];
      expect(second.result.directory).not.toBe(first.result.directory);
    } finally {
      cancellation.abort();
      expect(await finished).toBe(0);
    }
  });

  it('restarts CLI watch when config changes only the GPUI dependency mode', async () => {
    const root = await fixture();
    const config = path.join(root, 'compiler.json');
    const options = {
      entry: 'entry.proto.ts',
      output: 'versions',
      profile: 'gpui-source-v1',
      json: true,
    };
    await writeFile(config, JSON.stringify(options));
    const cancellation = new AbortController();
    const events: WatchEvent[] = [];
    const finished = runCompilerCli(['watch', '--config', 'compiler.json'], {
      cwd: root,
      signal: cancellation.signal,
      stdout: (text) => {
        events.push(JSON.parse(text));
      },
      stderr: (text) => {
        throw new Error(text);
      },
    });
    try {
      await expect.poll(() => events.filter((event) => event.ok).length).toBe(1);
      const first = events.find((event) => event.ok)!;
      expect(await readFile(path.join(first.result.directory, 'Cargo.toml'), 'utf8')).toContain(
        'git ='
      );
      await writeFile(config, JSON.stringify({ ...options, gpuiDependency: 'workspace' }));
      await expect.poll(() => events.filter((event) => event.ok).length).toBe(2);
      const second = events.filter((event) => event.ok)[1];
      expect(await readFile(path.join(second.result.directory, 'Cargo.toml'), 'utf8')).toContain(
        'gpui = { workspace = true }'
      );
      expect(
        await readFile(
          path.join(second.result.directory, '.proto-ui/gpui-native/Cargo.toml'),
          'utf8'
        )
      ).toContain('gpui = { workspace = true }');
    } finally {
      cancellation.abort();
      expect(await finished).toBe(0);
    }
  });
});
