#!/usr/bin/env node
/**
 * CLI：优先读取显式 authored-code.ts；其余目录沿用静态 DemoSpec 生成路径。
 */
import type { Stats } from 'node:fs';
import { readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generatePrototypeMapping } from './generate-prototype.js';
import type * as LegacyEmitters from './generate-code.js';
import {
  AdapterIds,
  type RuntimeId,
} from '../../src/components/PrototypePreviewer/runtimes/ids.js';
import {
  collectPrototypeIds,
  type DemoSpec,
} from '../../src/components/PrototypePreviewer/demo-types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_COMPONENTS_ROOT = resolve(__dirname, '../../src/content/docs/demo_components');
const RUNTIME_COMPONENT_IMPORT_PATHS = {
  react: '../proto-ui/components/react',
  vue: '../proto-ui/components/vue',
} as const;

type ComponentMapping = {
  component: string;
};

type GeneratedDemo = {
  demoId: string;
  wc: string;
  react: string;
  vue: string;
  vue2?: string;
};

type LegacyGenerator = {
  emitters: typeof LegacyEmitters;
  prototypeMappings: Record<string, ComponentMapping>;
};

async function listFolderDemos(folderPath: string): Promise<string[]> {
  const entries = await readdir(folderPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.demo.ts'))
    .map((entry) => join(folderPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

async function loadDemoByPath(filePath: string): Promise<DemoSpec | null> {
  try {
    const mod = await import(pathToFileURL(filePath).href + '?t=' + Date.now());
    const demo = mod?.default;
    if (demo?.type === 'demo' && demo?.root) return demo as DemoSpec;
  } catch (error) {
    console.warn(`[generate-code] 加载失败: ${filePath}`, error);
  }
  return null;
}

function toPascal(s: string): string {
  return s
    .replace(/[-_]+([a-zA-Z0-9])/g, (_, c) => c.toUpperCase())
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

function toCamel(s: string): string {
  const pascal = toPascal(s);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function escapeForTemplateLiteral(code: string): string {
  return code.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');
}

function getDemoComponents(
  demo: DemoSpec,
  prototypeMappings: Record<string, ComponentMapping>
): string[] {
  const ids = new Set<string>();
  collectPrototypeIds(demo.root, ids);
  return [...ids]
    .map((id) => prototypeMappings[id]?.component)
    .filter((component): component is string => Boolean(component))
    .sort((a, b) => a.localeCompare(b));
}

function renderNamedImport(components: string[], importPath: string): string {
  if (components.length === 1) {
    return `import { ${components[0]} } from '${importPath}';`;
  }

  return `import {\n${components.map((component) => `  ${component},`).join('\n')}\n} from '${importPath}';`;
}

function injectReactImports(code: string, importBlock: string): string {
  const exportIndex = code.indexOf('export function ');
  const body = exportIndex >= 0 ? code.slice(exportIndex).trimStart() : code.trimStart();
  return `${importBlock}\n\n${body}`.trimEnd();
}

function injectVueImports(code: string, importBlock: string): string {
  const templateIndex = code.indexOf('<template>');
  const template =
    templateIndex >= 0
      ? code.slice(templateIndex).trimStart()
      : code.replace(/^<script setup lang="ts">[\s\S]*?<\/script>\s*/u, '').trimStart();

  return [`<script setup lang="ts">`, importBlock, `</script>`, ``, template].join('\n').trimEnd();
}

function ensureRuntimeImports(
  demo: DemoSpec,
  runtime: 'react' | 'vue',
  code: string,
  prototypeMappings: Record<string, ComponentMapping>
): string {
  const components = getDemoComponents(demo, prototypeMappings);
  if (components.length === 0) {
    return code.trimEnd();
  }

  const importBlock = renderNamedImport(components, RUNTIME_COMPONENT_IMPORT_PATHS[runtime]);
  return runtime === 'react'
    ? injectReactImports(code, importBlock)
    : injectVueImports(code, importBlock);
}

function renderRuntimeBlock(demos: GeneratedDemo[], runtime: RuntimeId, indent = '    '): string {
  if (demos.length === 0) return '';
  return demos
    .map(({ demoId, [runtime]: code }) => {
      if (typeof code !== 'string') {
        throw new Error(`[generate-code] Missing ${runtime} code for ${demoId}.`);
      }
      const escaped = escapeForTemplateLiteral(code);
      return `${indent}'${demoId}': formatCode(\`\n${escaped}\n${indent}\`),`;
    })
    .join('\n');
}

function buildCodeFileContent(demos: GeneratedDemo[], source: string): string {
  const hasVue2 = demos.some((demo) => demo.vue2 !== undefined);
  if (hasVue2 && demos.some((demo) => demo.vue2 === undefined)) {
    throw new Error('[generate-code] Vue2 code must be supplied for every demo in the folder.');
  }
  const runtimes: readonly RuntimeId[] = hasVue2 ? AdapterIds : ['wc', 'react', 'vue'];
  const blocks = runtimes
    .map((runtime) => `  ${runtime}: {\n${renderRuntimeBlock(demos, runtime)}\n  },`)
    .join('\n');
  const mapType = hasVue2
    ? 'Record<RuntimeId, Record<string, string>>'
    : 'Partial<Record<RuntimeId, Record<string, string>>>';
  return `// Generated by scripts/example_code_generation/cli.ts from ${source}.
// Do not edit this file; edit its source and run the same CLI.
import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: ${mapType} = {
${blocks}
};
`;
}

function requireCodeMapObject(value: unknown, source: string): object {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[generate-code] ${source} must be a code map object.`);
  }
  return value;
}

async function loadAuthoredDemos(
  folderPath: string,
  demoFiles: string[]
): Promise<{ demos: GeneratedDemo[]; source: string } | null> {
  const sourcePath = join(folderPath, 'authored-code.ts');
  let sourceStat: Stats;
  try {
    sourceStat = await stat(sourcePath);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
  if (!sourceStat.isFile()) {
    throw new Error(`[generate-code] Authored source is not a file: ${sourcePath}`);
  }
  // This is explicit author input, not automatic lowering of DemoSpec.setup.
  // Invalid or unavailable authored input must fail rather than fall back.
  const mod = await import(pathToFileURL(sourcePath).href + '?t=' + Date.now());
  const codeMap = requireCodeMapObject(mod.codeMap, sourcePath);
  const hosts = Object.keys(codeMap).sort();
  if (JSON.stringify(hosts) !== JSON.stringify([...AdapterIds].sort())) {
    throw new Error(`[generate-code] ${sourcePath} must provide exactly ${AdapterIds.join(', ')}.`);
  }
  const demoIds = demoFiles.map((file) => basename(file, '.demo.ts')).sort();
  const hostMaps = new Map<RuntimeId, object>();
  for (const runtime of AdapterIds) {
    const entries = requireCodeMapObject(Reflect.get(codeMap, runtime), `${sourcePath} ${runtime}`);
    if (JSON.stringify(Object.keys(entries).sort()) !== JSON.stringify(demoIds)) {
      throw new Error(
        `[generate-code] ${sourcePath} ${runtime} must cover every folder demo ID exactly.`
      );
    }
    hostMaps.set(runtime, entries);
  }
  const demos = demoIds.map((demoId) => {
    const readCode = (runtime: RuntimeId): string => {
      const hostMap = hostMaps.get(runtime);
      if (hostMap === undefined) {
        throw new Error(`[generate-code] ${sourcePath} is missing the ${runtime} code map.`);
      }
      const code: unknown = Reflect.get(hostMap, demoId);
      if (typeof code !== 'string' || code.trim() === '') {
        throw new Error(
          `[generate-code] ${sourcePath} ${runtime}/${demoId} must be a nonempty string.`
        );
      }
      return code;
    };
    return {
      demoId,
      wc: readCode('wc'),
      react: readCode('react'),
      vue: readCode('vue'),
      vue2: readCode('vue2'),
    };
  });
  return {
    demos,
    source: relative(resolve(__dirname, '../..'), sourcePath).split('\\').join('/'),
  };
}

async function loadLegacyGenerator(): Promise<LegacyGenerator> {
  await generatePrototypeMapping();
  // Runtime-selected legacy plugin: its registry was just generated above.
  // Static loading would cache the old registry and initialize unrelated legacy
  // dependencies during an authored-only run.
  const [emitters, { prototypeMappings }] = await Promise.all([
    import('./generate-code.ts'),
    import('./prototype-config.ts'),
  ]);
  return { emitters, prototypeMappings };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 0 && (args.length !== 2 || args[0] !== '--folder' || !args[1])) {
    throw new Error('Usage: generate-code [--folder <existing demo folder>]');
  }
  const requestedFolder = args[1];
  const rootEntries = await readdir(DEMO_COMPONENTS_ROOT, { withFileTypes: true });
  const folders = rootEntries
    .filter((entry) => entry.isDirectory() && (!requestedFolder || entry.name === requestedFolder))
    .map((entry) => join(DEMO_COMPONENTS_ROOT, entry.name))
    .sort((a, b) => a.localeCompare(b));
  if (requestedFolder && folders.length !== 1) {
    throw new Error(`[generate-code] Unknown demo folder: ${requestedFolder}`);
  }
  let legacy: LegacyGenerator | undefined;

  for (const folderPath of folders) {
    const folderName = basename(folderPath);
    const demoFiles = await listFolderDemos(folderPath);
    if (demoFiles.length === 0) {
      if (requestedFolder) throw new Error(`[generate-code] No demos in ${requestedFolder}.`);
      continue;
    }

    const authored = await loadAuthoredDemos(folderPath, demoFiles);
    const outFile = join(folderPath, `${toCamel(folderName)}Code.ts`);
    if (authored) {
      await writeFile(outFile, buildCodeFileContent(authored.demos, authored.source), 'utf8');
      console.log(`[generate-code] 已写入 ${outFile}（explicit authored source, four hosts）`);
      continue;
    }

    // Preserve the legacy static-tree route for folders without authored input.
    // It does not translate setup/ref callbacks or provide a Vue2 projection.
    legacy ??= await loadLegacyGenerator();
    const { emitters, prototypeMappings } = legacy;
    const generated: GeneratedDemo[] = [];
    for (const demoFile of demoFiles) {
      const demo = await loadDemoByPath(demoFile);
      if (!demo) continue;

      const demoId = basename(demoFile, '.demo.ts');
      const componentName = `${toPascal(demoId)}Demo`;
      const wc = emitters.generateWebComponentCode(demo).trimEnd();
      const react = ensureRuntimeImports(
        demo,
        'react',
        await emitters.generateReactCode(demo, componentName),
        prototypeMappings
      );
      const vue = ensureRuntimeImports(
        demo,
        'vue',
        await emitters.generateVueCode(demo),
        prototypeMappings
      );
      generated.push({ demoId, wc, react, vue });
      console.log(`[generate-code] 已生成 ${folderName}/${demoId}`);
    }

    if (generated.length === 0) continue;

    await writeFile(
      outFile,
      buildCodeFileContent(generated, 'legacy DemoSpec static trees (wc/react/vue only)'),
      'utf8'
    );
    console.log(`[generate-code] 已写入 ${outFile}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
