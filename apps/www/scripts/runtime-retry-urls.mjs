import path from 'node:path';

const VIRTUAL_ID = 'virtual:proto-ui/runtime-retry-urls';
const PROBE_ID = 'virtual:proto-ui/runtime-retry-imports';
const RESOLVED_PROBE_ID = `\0${PROBE_ID}`;
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const RENDERER = 'src/components/PrototypePreviewer/demo-renderer.ts';
export const runtimeRetryModules = Object.freeze({
  reactRuntime: './runtimes/react-runtime.ts',
  vueRuntime: './runtimes/vue-runtime.ts',
  vue2Runtime: './runtimes/vue2-runtime.ts',
  reactAdapter: '@proto.ui/adapter-react',
  vueAdapter: '@proto.ui/adapter-vue',
  vue2Adapter: '@proto.ui/adapter-vue2',
  react: 'react',
  reactDom: 'react-dom',
  reactDomClient: 'react-dom/client',
  vue: 'vue',
  vue2: 'vue2-runtime',
});

/** Build-owned URL bindings. These are URLs of executable chunks, not raw TS assets. */
export function runtimeRetryUrlsPlugin(appRoot) {
  let config;
  let server;
  return {
    name: 'proto-ui-runtime-retry-urls',
    configResolved(value) {
      config = value;
    },
    configureServer(value) {
      server = value;
    },
    async resolveId(id, importer) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      if (id === PROBE_ID) return RESOLVED_PROBE_ID;
      if (importer === RESOLVED_PROBE_ID && Object.values(runtimeRetryModules).includes(id))
        return this.resolve(id, path.resolve(appRoot ?? config.root, RENDERER));
      return null;
    },
    async load(id, options) {
      const importer = path.resolve(appRoot ?? config.root, RENDERER);
      if (id === RESOLVED_PROBE_ID) {
        return Object.entries(runtimeRetryModules)
          .map(([key, source]) => {
            const specifier = source.startsWith('.')
              ? path.resolve(path.dirname(importer), source)
              : source;
            return `export const ${key} = () => import(${JSON.stringify(specifier)});`;
          })
          .join('\n');
      }
      if (id !== RESOLVED_ID) return null;
      // No reader framework is acquired during the Astro server render.
      if (options?.ssr) return 'export default {};';
      if (config.command === 'serve') {
        // Let Vite perform dependency optimization and import analysis first.
        // A raw resolved React path can still be CommonJS and is not an ESM URL.
        const transformed = await server.transformRequest(PROBE_ID);
        if (!transformed) this.error('Missing runtime recovery import analysis');
        const ast = this.parse(transformed.code);
        const urls = {};
        for (const statement of ast.body) {
          if (statement.type !== 'ExportNamedDeclaration') continue;
          for (const declaration of statement.declaration?.declarations ?? []) {
            const key = declaration.id.name;
            if (!Object.hasOwn(runtimeRetryModules, key)) continue;
            const imports = [];
            const visit = (node) => {
              if (!node || typeof node !== 'object') return;
              if (node.type === 'ImportExpression') imports.push(node.source.value);
              for (const value of Object.values(node)) {
                if (Array.isArray(value)) value.forEach(visit);
                else if (value && typeof value === 'object') visit(value);
              }
            };
            visit(declaration.init);
            if (
              imports.length !== 1 ||
              typeof imports[0] !== 'string' ||
              !imports[0].startsWith('/') ||
              imports[0].startsWith('//')
            )
              this.error(`Unbound runtime recovery import ${key}`);
            urls[key] = imports[0];
          }
        }
        if (Object.keys(urls).length !== Object.keys(runtimeRetryModules).length)
          this.error('Incomplete runtime recovery import analysis');
        return `export default Object.freeze(${JSON.stringify(urls)});`;
      }
      const entries = await Promise.all(
        Object.entries(runtimeRetryModules).map(async ([key, source]) => {
          const resolved = await this.resolve(source, importer);
          if (!resolved || resolved.external)
            this.error(`Cannot bind runtime recovery URL for ${source}`);
          const reference = this.emitFile({
            type: 'chunk',
            id: resolved.id,
            preserveSignature: 'strict',
            // Preserve the existing dynamic-only entry boundary and its exports.
            implicitlyLoadedAfterOneOf: [importer],
          });
          return `${JSON.stringify(key)}: import.meta.ROLLUP_FILE_URL_${reference}`;
        })
      );
      return `export default Object.freeze({${entries.join(',\n')}});`;
    },
  };
}
