// @vitest-environment node
import { expect, it } from 'vitest';
import { parsePrototype } from '../../../compiler/src/parser';
import { checkTargetOperations, resolveTargetProfile } from '../../../compiler/src/targets';

it('does not claim compiler/native lowering for the experimental source input hook', () => {
  const parsed = parsePrototype(
    `import {definePrototype} from '@proto.ui/core';
import {asContextMenuInput} from '@proto.ui/hooks';
export default definePrototype({name:'context-input-admission',setup(){asContextMenuInput();}});`,
    { fileName: 'entry.proto.ts' }
  );
  for (const profile of [
    'react-dom-source-v1',
    'vue-source-v1',
    'vue2-source-v1',
    'web-component-source-v1',
    'gpui-source-v1',
  ]) {
    const target = resolveTargetProfile(profile);
    expect(target.ok, profile).toBe(true);
    const admitted = parsed.ok && target.ok && checkTargetOperations(parsed.value, target.value).ok;
    expect(admitted, profile).toBe(false);
  }
});
