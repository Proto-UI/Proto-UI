import { defineAsHook, definePrototype, type DefHandle, type RendererHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { NUMBER_FIELD_FAMILY } from './shared';
function setup(def: DefHandle<{}>) {
  def.anatomy.claim(NUMBER_FIELD_FAMILY, { role: 'label' });
  asAccessible().part(NUMBER_FIELD_FAMILY, { key: 'label' });
  return (r: RendererHandle<any>) => r.slot();
}
export const asNumberFieldLabel = defineAsHook({ name: 'as-number-field-label', setup });
export default definePrototype({ name: 'base-number-field-label', setup });
