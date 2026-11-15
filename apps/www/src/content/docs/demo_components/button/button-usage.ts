import type { CodeExampleFile, CodeExamplesByHost } from '@/components/code-example-types';
import { getCode } from '../../../../utils/conversionUtils';
import { codeMap } from './buttonCode';

const demoStyles = `/* Application-owned example layout and visually hidden labels. */
.flex { display: flex; }
.flex-wrap { flex-wrap: wrap; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.gap-3 { gap: 0.75rem; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }`;

/** Public-facade application files; the preview's private WC tags are not an install API. */
export function getButtonExampleFiles(id: string): CodeExamplesByHost {
  const imports = "import './styles/proto-ui-style.css';\nimport './button-demo.css';";
  const stylesheet: CodeExampleFile = {
    name: 'src/button-demo.css',
    lang: 'css',
    code: demoStyles,
  };
  const vueCode = (runtime: 'vue' | 'vue2') =>
    getCode(runtime, id, codeMap).replace(/<script([^>]*)>/, `<script$1>\n${imports}`);
  return {
    wc: [
      {
        name: 'src/main.ts',
        lang: 'typescript',
        code: `${imports}\nimport '../proto-ui/components/wc';`,
      },
      {
        name: 'index.html',
        lang: 'html',
        code: `${getCode('wc', id, codeMap)}\n<script type="module" src="/src/main.ts"></script>`,
      },
      stylesheet,
    ],
    react: [
      { name: 'src/button.tsx', lang: 'tsx', code: `${imports}\n${getCode('react', id, codeMap)}` },
      stylesheet,
    ],
    vue: [{ name: 'src/Button.vue', lang: 'vue', code: vueCode('vue') }, stylesheet],
    vue2: [{ name: 'src/Button.vue', lang: 'vue', code: vueCode('vue2') }, stylesheet],
  };
}
