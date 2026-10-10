import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { FIELD_FAMILY, rejectFieldDuplicates } from './shared';
import type { FieldDescriptionProps, FieldDescriptionExposes } from './types';
function setup(def: DefHandle<FieldDescriptionProps, FieldDescriptionExposes>) {
  def.anatomy.claim(FIELD_FAMILY, { role: 'description' });
  asAccessible().part(FIELD_FAMILY, { key: 'description' });
  def.lifecycle.onCreated((run) => rejectFieldDuplicates(run, 'description'));
  return (r: import('@proto.ui/core').RendererHandle<any>) => r.slot();
}
export const asFieldDescription = defineAsHook<FieldDescriptionProps, FieldDescriptionExposes>({
  name: 'as-field-description',
  setup,
});
export default definePrototype({ name: 'base-field-description', setup });
