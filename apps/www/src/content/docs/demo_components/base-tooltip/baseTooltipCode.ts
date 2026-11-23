import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';
import { baseTooltipFiles } from '../tooltip-usage';

function file(host: keyof typeof baseTooltipFiles, name: string): string {
  const entry = baseTooltipFiles[host].find((item) => item.name === name);
  if (!entry) throw new Error(`Missing Base Tooltip Usage file: ${host}/${name}`);
  return entry.code;
}

// Keep the historical DemoSpec path and ID. Code and Usage share the same public
// application source; the WC code panel expands main.ts into an inline module.
const wc = file('wc', 'index.html').replace(
  '<script type="module" src="/src/main.ts"></script>',
  `<script type="module">\n${file('wc', 'src/main.ts').replaceAll("'./", "'./src/")}\n</script>`
);

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: { 'demo-base-tooltip': wc },
  react: { 'demo-base-tooltip': file('react', 'src/App.tsx') },
  vue: { 'demo-base-tooltip': file('vue', 'src/App.vue') },
  vue2: { 'demo-base-tooltip': file('vue2', 'src/App.vue') },
};
