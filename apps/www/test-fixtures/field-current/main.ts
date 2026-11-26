import * as baseField from '@proto.ui/prototypes-base/field';
import * as shadcnField from '@proto.ui/prototypes-shadcn/field';
import * as brutalistField from '@proto.ui/prototypes-brutalist/field';
import * as bootstrapField from '@proto.ui/prototypes-bootstrap-2-3-2/field';
import * as liquidField from '@proto.ui/prototypes-liquid-glass/field';
import baseButton from '@proto.ui/prototypes-base/button';
import shadcnButton from '@proto.ui/prototypes-shadcn/button';
import brutalistButton from '@proto.ui/prototypes-brutalist/button';
import bootstrapButton from '@proto.ui/prototypes-bootstrap-2-3-2/button';
import liquidButton from '@proto.ui/prototypes-liquid-glass/button';
import { registerPrototype } from '../../src/components/PrototypePreviewer/registry';
import { renderDemo } from '../../src/components/PrototypePreviewer/demo-renderer';
import { isRuntimeId } from '../../src/components/PrototypePreviewer/runtimes/ids';
import { createFieldCompanion } from './consumer';
import 'virtual:field-companion.css';

const families = {
  base: [baseField, baseButton],
  shadcn: [shadcnField, shadcnButton],
  brutalist: [brutalistField, brutalistButton],
  'bootstrap-2-3-2': [bootstrapField, bootstrapButton],
  'liquid-glass': [liquidField, liquidButton],
} as const;
const params = new URLSearchParams(location.search);
const family = params.get('family') ?? 'base';
const runtime = params.get('runtime') ?? 'wc';
if (!(family in families) || !isRuntimeId(runtime))
  throw new Error('Unknown Field companion subject');
const [fields, button] = families[family as keyof typeof families];
for (const part of [
  fields.fieldRoot,
  fields.fieldLabel,
  fields.fieldControl,
  fields.fieldDescription,
  fields.fieldError,
  fields.fieldValidity,
  button,
]) {
  registerPrototype(part.name, part);
}
document.documentElement.dataset.family = family;
// The standalone consumer follows the OS theme, just as the documentation
// ThemeProvider does when no explicit preference is selected.
const systemTheme = matchMedia('(prefers-color-scheme: light)');
const applySystemTheme = () => {
  const theme = systemTheme.matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
};
applySystemTheme();
systemTheme.addEventListener('change', applySystemTheme);
const host = document.querySelector<HTMLElement>('.host')!;
const view = await renderDemo({ runtime, host, demo: createFieldCompanion(family) });
window.addEventListener(
  'pagehide',
  () => {
    systemTheme.removeEventListener('change', applySystemTheme);
    void view.destroy();
  },
  { once: true }
);
document.body.dataset.ready = 'true';
