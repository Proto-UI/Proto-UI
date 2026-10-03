#!/usr/bin/env node
/**
 * CLI：扫描 demo_components 子目录下的 *.demo.ts，生成 prototype-config.ts 与 <folder>Code.ts
 */
import { readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generatePrototypeMapping } from './generate-prototype.js';
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

function renderRuntimeBlock(
  demos: Array<{ demoId: string; wc: string; react: string; vue: string }>,
  runtime: 'wc' | 'react' | 'vue',
  indent = '    '
): string {
  if (demos.length === 0) return '';
  return demos
    .map(({ demoId, [runtime]: code }) => {
      const escaped = escapeForTemplateLiteral(code);
      return `${indent}'${demoId}': formatCode(\`\n${escaped}\n${indent}\`),`;
    })
    .join('\n');
}

function buildCodeFileContent(
  demos: Array<{ demoId: string; wc: string; react: string; vue: string }>
): string {
  const wcContent = renderRuntimeBlock(demos, 'wc');
  const reactContent = renderRuntimeBlock(demos, 'react');
  const vueContent = renderRuntimeBlock(demos, 'vue');
  return `import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
${wcContent}
  },
  react: {
${reactContent}
  },
  vue: {
${vueContent}
  },
};
`;
}

async function main() {
  // 1. 根据 .demo.ts 自动生成 prototype-mapping.config.ts（需在加载 generate-code 之前完成）
  await generatePrototypeMapping();

  // 2. 动态导入 generate-code，确保使用最新生成的配置
  const [{ generateReactCode, generateVueCode, generateWebComponentCode }, { prototypeMappings }] =
    await Promise.all([import('./generate-code.ts'), import('./prototype-config.ts')]);

  const rootEntries = await readdir(DEMO_COMPONENTS_ROOT, { withFileTypes: true });
  const folders = rootEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(DEMO_COMPONENTS_ROOT, entry.name))
    .sort((a, b) => a.localeCompare(b));

  for (const folderPath of folders) {
    const folderName = basename(folderPath);
    const demoFiles = await listFolderDemos(folderPath);
    if (demoFiles.length === 0) {
      continue;
    }

    const generated: Array<{ demoId: string; wc: string; react: string; vue: string }> = [];
    for (const demoFile of demoFiles) {
      const demo = await loadDemoByPath(demoFile);
      if (!demo) continue;

      const demoId = basename(demoFile, '.demo.ts');
      const componentName = `${toPascal(demoId)}Demo`;
      const wc = generateWebComponentCode(demo).trimEnd();
      const react = ensureRuntimeImports(
        demo,
        'react',
        await generateReactCode(demo, componentName),
        prototypeMappings
      );
      const vue = ensureRuntimeImports(demo, 'vue', await generateVueCode(demo), prototypeMappings);
      generated.push({ demoId, wc, react, vue });
      console.log(`[generate-code] 已生成 ${folderName}/${demoId}`);
    }

    if (generated.length === 0) continue;

    const outFile = join(folderPath, `${toCamel(folderName)}Code.ts`);
    await writeFile(outFile, buildCodeFileContent(generated), 'utf8');
    console.log(`[generate-code] 已写入 ${outFile}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
