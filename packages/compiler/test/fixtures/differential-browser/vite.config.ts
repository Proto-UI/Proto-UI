import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sourceConfig from '../../../../../vitest.config';
import {
  transformWithEsbuild,
  type Plugin,
} from '../../../../../apps/workspace/node_modules/vite/dist/node/index.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const repository = path.resolve(root, '../../../../..');

/**
 * Compile the unchanged source into a virtual TSX module. The null-prefixed
 * module identity keeps dependency scanning from treating it as an on-disk file.
 */
const sources: Record<string, string> = {
  'virtual:emitted-button': path.join(
    repository,
    'packages/prototypes/base/src/button/button.proto.ts'
  ),
  'virtual:pointer-props-duplicate-click': path.join(
    repository,
    'packages/prototypes/base/src/button/button.proto.ts'
  ),
  'virtual:retained-owner': path.join(root, 'retained-owner.proto.ts'),
  'virtual:retained-owner-reset-state': path.join(root, 'retained-owner.proto.ts'),
  'virtual:retained-owner-recreate-owner': path.join(root, 'retained-owner.proto.ts'),
  'virtual:retained-owner-reattach-state-loss': path.join(root, 'retained-owner.proto.ts'),
  'virtual:update-intent': path.join(root, 'update-intent.proto.ts'),
  'virtual:update-intent-source': path.join(root, 'update-intent.proto.ts'),
  'virtual:update-intent-without-update': path.join(root, 'update-intent.proto.ts'),
};
const supportingModules = new Map<string, { specifier: string; file: string; contents: string }>();
const supportingFiles = new Map<string, Map<string, string>>();
const emitted: Plugin = {
  name: 'compiler-differential-emitted',
  resolveId(id, importer) {
    if (importer && id.startsWith('.')) {
      const support = supportingModules.get(importer);
      const specifier = support?.specifier ??
        (importer.startsWith('\0') && importer.endsWith('.tsx') ? importer.slice(1, -4) : null);
      if (specifier && supportingFiles.has(specifier)) {
        const file = path.posix.normalize(path.posix.join(path.posix.dirname(support?.file ?? 'GeneratedButton.tsx'), id));
        const files = supportingFiles.get(specifier)!;
        for (const candidate of [file, `${file}.ts`, `${file}.tsx`]) {
          const resolved = files.get(candidate);
          if (resolved) return resolved;
        }
        throw new Error(`Missing generated supporting import ${id} from ${importer}`);
      }
    }
    return Object.hasOwn(sources, id) ? `\0${id}.tsx` : null;
  },
  async load(id) {
    const support = supportingModules.get(id);
    if (support) {
      if (support.file.endsWith('.css')) return support.contents;
      return transformWithEsbuild(support.contents, support.file, {
        loader: support.file.endsWith('.tsx') ? 'tsx' : 'ts', sourcemap: true,
      });
    }
    if (!id.startsWith('\0') || !id.endsWith('.tsx')) return null;
    const specifier = id.slice(1, -4);
    if (!Object.hasOwn(sources, specifier)) return null;
    const { compileFile } = await import('../../../../../packages/compiler/src/index');
    const result = await compileFile(sources[specifier], {
      root: repository,
      componentName: 'GeneratedButton',
      profile: specifier === 'virtual:update-intent-source' ? 'react-dom-source-v1' : 'react-runtime-v1',
    });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const files = new Map<string, string>();
    for (const artifact of result.value.output.supportingFiles ?? []) {
      const file = path.posix.normalize(artifact.path);
      const resolved = `\0compiler-support:${encodeURIComponent(specifier)}/${file}`;
      supportingModules.set(resolved, { specifier, file, contents: artifact.contents });
      files.set(file, resolved);
    }
    supportingFiles.set(specifier, files);
    let code = result.value.output.code;
    if (specifier === 'virtual:update-intent-without-update') {
      code = code.replace('run.update();', '/* injected missing explicit update */');
    }
    if (specifier === 'virtual:pointer-props-duplicate-click') {
      code = code.replace(
        'run.expose.emit("click");',
        'run.expose.emit("click"); run.expose.emit("click");'
      );
    }
    if (specifier === 'virtual:retained-owner-reset-state') {
      code = code.replace(
        'run.expose.emit("viewEnded");',
        'count.set(0); run.expose.emit("viewEnded");'
      );
    } else if (specifier === 'virtual:retained-owner-recreate-owner') {
      code = code.replace(
        'return __puiAdapt(prototype, options);',
        'const Inner = __puiAdapt(prototype, options); return (props: any) => __puiReact.createElement(Inner, { ...props, key: String(props.present) });'
      );
    } else if (specifier === 'virtual:retained-owner-reattach-state-loss') {
      code = code.replace(
        'def.expose.state("count", count);',
        'def.expose.state("count", count); let __epochMounts = 0; def.lifecycle.onMounted(() => { __epochMounts += 1; if (__epochMounts === 2) count.set(0); });'
      );
    }
    if (
      specifier !== 'virtual:emitted-button' &&
      specifier !== 'virtual:retained-owner' &&
      specifier !== 'virtual:update-intent' &&
      specifier !== 'virtual:update-intent-source' &&
      code === result.value.output.code
    )
      throw new Error(`Mutation was not injected: ${specifier}`);
    const compilation = {
      profile: result.value.output.profile,
      provenance: result.value.output.provenance,
      dependencies: result.value.output.dependencies,
      generatedSha256: createHash('sha256').update(code).digest('hex'),
      mutant: code !== result.value.output.code,
      supportingFiles: (result.value.output.supportingFiles ?? []).map((file) => ({
        path: file.path, kind: file.kind,
        sha256: createHash('sha256').update(file.contents).digest('hex'),
      })),
    };
    return transformWithEsbuild(
      `${code}\nexport const __puiBrowserFixtureCompilation = ${JSON.stringify(compilation)};\n`,
      'GeneratedButton.tsx', { loader: 'tsx', sourcemap: true }
    );
  },
};

export default {
  root,
  plugins: [...(sourceConfig.plugins ?? []), emitted],
  resolve: {
    alias: {
      react: path.join(repository, 'packages/adapters/react/node_modules/react'),
      'react-dom': path.join(repository, 'packages/adapters/react/node_modules/react-dom'),
    },
  },
  optimizeDeps: { include: ['react', 'react-dom/client', 'react-dom'] },
  server: { host: '127.0.0.1', fs: { allow: [repository] } },
};
