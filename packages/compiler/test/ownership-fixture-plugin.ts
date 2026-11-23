import { createHash } from 'node:crypto';
import path from 'node:path';
import { transformWithEsbuild, type Plugin } from 'vite';
import { compilePrototype } from '../src/compile';
import { historicalSelectItemSource } from '../../prototypes/base/test/select-legacy-slot-source';
import { propsPolicySource } from './props-policy-source';

const PREFIX = 'virtual:sprint1-';
const modules = new Map<string, { file: string; code: string; owner: string }>();
const files = new Map<string, Map<string, string>>();
const hash = (code: string) => createHash('sha256').update(code).digest('hex');

/** Same authored source and historical mutation as the focused DOM tests. */
export function ownershipFixturePlugin(): Plugin {
  return {
    name: 'sprint1-ownership-fixtures',
    resolveId(id, importer) {
      if (id.startsWith(PREFIX)) return '\0' + id;
      if (!importer || !id.startsWith('.')) return null;
      const parent = modules.get(importer);
      if (!parent) return null;
      const file = path.posix.normalize(path.posix.join(path.posix.dirname(parent.file), id));
      const owned = files.get(parent.owner)!;
      for (const candidate of [file, file + '.ts', file + '.tsx']) {
        if (owned.has(candidate)) return owned.get(candidate)!;
      }
      throw new Error(`Missing ownership fixture import ${id} from ${parent.file}`);
    },
    async load(id) {
      let entry = modules.get(id);
      if (!entry) {
        if (!id.startsWith('\0' + PREFIX)) return null;
        const variant = id.slice(('\0' + PREFIX).length);
        if (variant === 'select-legacy') {
          const code = historicalSelectItemSource();
          return transformWithEsbuild(
            code +
              `\nexport const __puiFixtureSource = ${JSON.stringify({ sourceSha256: hash(code), mutation: 'selected storage only' })};`,
            'legacy-select-item.ts',
            { loader: 'ts', sourcemap: true }
          );
        }
        const match = /^(authored|compiled)-props-(watch|no-watch)$/.exec(variant);
        if (!match) throw new Error(`Unknown ownership fixture ${variant}`);
        const source = propsPolicySource(match[2] === 'watch');
        if (match[1] === 'authored')
          return transformWithEsbuild(source, 'props-policy.proto.ts', {
            loader: 'ts',
            sourcemap: true,
          });
        const result = compilePrototype(source, { profile: 'react-dom-source-v1' });
        if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
        const output = result.value.output;
        const metadata = {
          profile: output.profile,
          provenance: output.provenance,
          authoredSha256: hash(source),
          generatedSha256: hash(output.code),
          supportingFiles: output.supportingFiles?.map((file) => ({
            path: file.path,
            sha256: hash(file.contents),
          })),
        };
        entry = {
          file: 'Component.tsx',
          owner: id,
          code:
            output.code + `\nexport const __puiFixtureCompilation = ${JSON.stringify(metadata)};`,
        };
        modules.set(id, entry);
        const owned = new Map<string, string>();
        files.set(id, owned);
        for (const file of output.supportingFiles ?? []) {
          const key = id + '/' + file.path;
          modules.set(key, { file: file.path, owner: id, code: file.contents });
          owned.set(file.path, key);
        }
      }
      if (entry.file.endsWith('.css')) return entry.code;
      return transformWithEsbuild(entry.code, entry.file, {
        loader: entry.file.endsWith('.tsx') ? 'tsx' : 'ts',
        sourcemap: true,
      });
    },
  };
}
