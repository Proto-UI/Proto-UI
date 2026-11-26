import { fileURLToPath } from 'node:url';

const input = fileURLToPath(new URL('./button-boundary.html', import.meta.url));
const prototypeModulePattern =
  /\/node_modules\/@proto\.ui\/(prototypes-[a-z0-9-]+)\/dist\/(.+?)(?:\?.*)?$/;
const ALLOWED_BUTTON_PROTOTYPE_PACKAGES = new Set(['prototypes-base', 'prototypes-shadcn']);
const SHADCN_BUTTON_SHARED_SUPPORT = new Set([
  'style-scope/context.js',
  'style-scope/ids.js',
  'style-scope/selection.js',
]);

export function isButtonFamilyModule({ packageName, path }) {
  if (!ALLOWED_BUTTON_PROTOTYPE_PACKAGES.has(packageName)) return false;
  if (path.startsWith('button/')) return true;
  return packageName === 'prototypes-shadcn' && SHADCN_BUTTON_SHARED_SUPPORT.has(path);
}

export default {
  build: {
    outDir: 'dist-button-boundary',
    rollupOptions: { input },
  },
  plugins: [
    {
      name: 'proto-ui-button-family-boundary',
      generateBundle(_options, bundle) {
        const prototypeModules = new Map();

        for (const output of Object.values(bundle)) {
          if (output.type !== 'chunk') continue;
          for (const id of Object.keys(output.modules)) {
            const normalized = id.replaceAll('\\', '/');
            const match = normalized.match(prototypeModulePattern);
            if (!match) continue;
            prototypeModules.set(normalized, { packageName: match[1], path: match[2] });
          }
        }

        const entries = [...prototypeModules.entries()];
        const unexpected = entries.filter(([, module]) => !isButtonFamilyModule(module));
        if (unexpected.length > 0) {
          throw new Error(
            `Button family boundary included unrelated prototype modules:\n${unexpected
              .map(([id]) => `- ${id}`)
              .join('\n')}`
          );
        }

        for (const packageName of ['prototypes-base', 'prototypes-shadcn']) {
          if (!entries.some(([, module]) => module.packageName === packageName)) {
            throw new Error(`Button family boundary did not consume @proto.ui/${packageName}`);
          }
        }

        console.log(
          `Button family boundary: ${entries.length} prototype modules, Base/Shadcn Button and shared style selection only`
        );
      },
    },
  ],
};
