import * as baseCheckbox from '@proto.ui/prototypes-base/checkbox';
import * as baseRadio from '@proto.ui/prototypes-base/radio-group';
import * as baseSwitch from '@proto.ui/prototypes-base/switch';
import * as baseLabel from '@proto.ui/prototypes-base/label';
import baseChoicesDemo from '../../../apps/www/src/content/docs/demo-base-field-choices.demo';
import * as shadcnCheckbox from '@proto.ui/prototypes-shadcn/checkbox';
import * as shadcnRadio from '@proto.ui/prototypes-shadcn/radio-group';
import * as shadcnSwitch from '@proto.ui/prototypes-shadcn/switch';
import * as shadcnLabel from '@proto.ui/prototypes-shadcn/label';
import shadcnChoicesDemo from '../../../apps/www/src/content/docs/demo-shadcn-field-choices.demo';
import * as brutalistCheckbox from '@proto.ui/prototypes-brutalist/checkbox';
import * as brutalistRadio from '@proto.ui/prototypes-brutalist/radio-group';
import * as brutalistSwitch from '@proto.ui/prototypes-brutalist/switch';
import * as brutalistLabel from '@proto.ui/prototypes-brutalist/label';
import brutalistChoicesDemo from '../../../apps/www/src/content/docs/demo-brutalist-field-choices.demo';
/** Actual public DemoSpecs and four framework Adapters; observations never inject component values or geometry. */
import * as baseForm from '@proto.ui/prototypes-base/form';
import * as shadcnForm from '@proto.ui/prototypes-shadcn/form';
import * as brutalistForm from '@proto.ui/prototypes-brutalist/form';
import * as baseField from '@proto.ui/prototypes-base/field';
import * as shadcnField from '@proto.ui/prototypes-shadcn/field';
import * as brutalistField from '@proto.ui/prototypes-brutalist/field';
import * as baseFieldset from '@proto.ui/prototypes-base/fieldset';
import * as shadcnFieldset from '@proto.ui/prototypes-shadcn/fieldset';
import * as brutalistFieldset from '@proto.ui/prototypes-brutalist/fieldset';
import * as baseCheckboxGroup from '@proto.ui/prototypes-base/checkbox-group';
import * as shadcnCheckboxGroup from '@proto.ui/prototypes-shadcn/checkbox-group';
import * as brutalistCheckboxGroup from '@proto.ui/prototypes-brutalist/checkbox-group';
import * as baseButton from '@proto.ui/prototypes-base/button';
import * as shadcnButton from '@proto.ui/prototypes-shadcn/button';
import * as brutalistButton from '@proto.ui/prototypes-brutalist/button';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import type { Prototype } from '@proto.ui/core';

import * as baseSelect from '@proto.ui/prototypes-base/select';
import * as shadcnSelect from '@proto.ui/prototypes-shadcn/select';
import * as brutalistSelect from '@proto.ui/prototypes-brutalist/select';
import baseFormDemo from '../../../apps/www/src/content/docs/demo-base-form-validation.demo';
import shadcnFormDemo from '../../../apps/www/src/content/docs/demo-shadcn-form-validation.demo';
import brutalistFormDemo from '../../../apps/www/src/content/docs/demo-brutalist-form-validation.demo';
import baseSelectDemo from '../../../apps/www/src/content/docs/demo-base-select-input.demo';
import shadcnSelectDemo from '../../../apps/www/src/content/docs/demo-shadcn-select-input.demo';
import brutalistSelectDemo from '../../../apps/www/src/content/docs/demo-brutalist-select-input.demo';
import { renderDemo } from '../../../apps/www/src/components/PrototypePreviewer/demo-renderer';
import { registerPrototype } from '../../../apps/www/src/components/PrototypePreviewer/registry';
import type {
  DemoRuntimeApi,
  DemoSpec,
  DemoRenderResult,
} from '../../../apps/www/src/components/PrototypePreviewer/demo-types';
import type { RuntimeId } from '../../../apps/www/src/components/PrototypePreviewer/runtimes/ids';
for (const library of [
  baseSelect,
  shadcnSelect,
  brutalistSelect,
  baseForm,
  shadcnForm,
  brutalistForm,
  baseField,
  shadcnField,
  brutalistField,
  baseFieldset,
  shadcnFieldset,
  brutalistFieldset,
  baseCheckboxGroup,
  shadcnCheckboxGroup,
  brutalistCheckboxGroup,
  baseButton,
  shadcnButton,
  brutalistButton,
  baseCheckbox,
  baseRadio,
  baseSwitch,
  baseLabel,
  shadcnCheckbox,
  shadcnRadio,
  shadcnSwitch,
  shadcnLabel,
  brutalistCheckbox,
  brutalistRadio,
  brutalistSwitch,
  brutalistLabel,
  { styleScope },
])
  for (const value of Object.values(library))
    if (value && typeof value === 'object' && 'name' in value && 'setup' in value) {
      const prototype = value as Prototype<any, any>;
      registerPrototype(prototype.name, prototype);
    }

const demos: Record<string, Record<string, DemoSpec>> = {
  base: { form: baseFormDemo, select: baseSelectDemo, choices: baseChoicesDemo },
  shadcn: { form: shadcnFormDemo, select: shadcnSelectDemo, choices: shadcnChoicesDemo },
  brutalist: {
    form: brutalistFormDemo,
    select: brutalistSelectDemo,
    choices: brutalistChoicesDemo,
  },
};
let view: DemoRenderResult | undefined;
let api: DemoRuntimeApi | undefined;
let refs: Record<string, HTMLElement> = {};
let host: HTMLElement | undefined;
const inputs: Array<Record<string, unknown>> = [];
const retained = new Map<string, { node: HTMLElement; exposes: any }>();
/** Read-only retention observes actual old owner retirement after a public recipe replacement. */
export function retain(ref: string, key: string) {
  retained.set(key, { node: refs[ref], exposes: api?.getExposes(ref) });
}
export function retired(key: string) {
  const owner = retained.get(key);
  if (!owner) throw new Error(`Unknown retained owner ${key}`);
  let readValue: unknown;
  let readError: string | undefined;
  try {
    readValue = owner.exposes.checked.get();
  } catch (error) {
    readError = String(error);
  }
  return { connected: owner.node.isConnected, readValue, readError };
}
for (const type of [
  'keydown',
  'click',
  'input',
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'gotpointercapture',
  'lostpointercapture',
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
  'wheel',
])
  document.addEventListener(
    type,
    (event) => {
      const target = event.target as HTMLElement;
      if (!host?.contains(target) && !Object.values(refs).some((node) => node.contains(target)))
        return;
      const pointer = event as PointerEvent;
      inputs.push({
        type,
        trusted: event.isTrusted,
        target: target.closest?.('[data-demo-ref]')?.getAttribute('data-demo-ref'),
        pointerType: pointer.pointerType,
        buttons: pointer.buttons,
        pointerId: pointer.pointerId,
        key: (event as KeyboardEvent).key,
      });
    },
    true
  );
export async function settle() {
  for (let frame = 0; frame < 3; frame++)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
export async function mount(runtime: RuntimeId, family: string, kind: string) {
  await dispose();
  host = document.querySelector<HTMLElement>('#fixture')!;
  inputs.length = 0;
  const demo = demos[family][kind];
  view = await renderDemo({
    runtime,
    host,
    demo: {
      ...demo,
      setup(context) {
        api = context.api;
        refs = context.refs;
        return demo.setup?.(context);
      },
    },
  });
  await settle();
}
export function read(ref: string, path: string, ...args: unknown[]) {
  const parts = path.split('.');
  let owner: any = api?.getExposes(ref);
  for (const key of parts.slice(0, -1)) owner = owner?.[key];
  const value = owner?.[parts.at(-1)!];
  return typeof value === 'function' ? value.apply(owner, args) : value;
}
export function call(ref: string, path: string, ...args: unknown[]) {
  return api?.call(ref, path, ...args);
}
export function setProps(ref: string, props: Record<string, unknown>) {
  api?.setProps(ref, props);
}
export function receipts() {
  return inputs.slice();
}
export async function dispose() {
  const content = refs.selectContent;
  await view?.destroy();
  view = undefined;
  api = undefined;
  refs = {};
  retained.clear();
  await settle();
  return {
    hostChildren: host?.childElementCount ?? 0,
    retiredContentConnected: content?.isConnected ?? false,
  };
}
