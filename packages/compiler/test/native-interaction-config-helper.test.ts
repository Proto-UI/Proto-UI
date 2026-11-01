import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { checkTargetOperations, resolveTargetProfile } from '../src/targets';
import { validateNativeInteraction } from '../src/native-interaction';

const profiles = [
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
  'gpui-source-v1',
] as const;
function checkedPrototype(body: string) {
  const source = `import {definePrototype} from '@proto.ui/core';import {asFocusable} from '@proto.ui/hooks';export default definePrototype({name:'ordinary-config-helper',setup(def){const focus=asFocusable();${body}return r=>r.el('div');}});`;
  const parsed = parsePrototype(source, { fileName: 'ordinary-config-helper.proto.ts' });
  expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const checked = validateIR(parsed.value);
  expect(checked.ok, JSON.stringify(checked)).toBe(true);
  if (!checked.ok) throw new Error(JSON.stringify(checked.diagnostics));
  return checked.value;
}
function admission(body: string, id: string) {
  const ir = checkedPrototype(body);
  const profile = resolveTargetProfile(id);
  expect(profile.ok, JSON.stringify(profile)).toBe(true);
  if (!profile.ok) throw new Error(JSON.stringify(profile.diagnostics));
  const before = JSON.stringify(ir);
  const result = checkTargetOperations(ir, profile.value);
  expect(JSON.stringify(ir)).toBe(before);
  return result;
}
function expectRejected(body: string, id: string, message: string) {
  const result = admission(body, id);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Invalid config admitted');
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code: 'PUI_NATIVE_INTERACTION_UNSUPPORTED', message })
  );
}

describe.each(profiles)('shared native interaction admission: %s', (profile) => {
  it('admits an ordinary config returned by an aliased helper', () => {
    expect(
      admission(
        'const options={disabled:false,meta:{label:"kept"}};const get=()=>options;const alias=get;focus.configure(alias());',
        profile
      ).ok
    ).toBe(true);
  });
  it('uses the captured configuration rather than the caller formal with the same name', () => {
    expect(
      admission(
        'const options={disabled:false};const get=()=>options;const caller=(options:boolean)=>get();focus.configure(caller(true));',
        profile
      ).ok
    ).toBe(true);
  });
  it('admits all-valid alternatives of a helper with multiple returns', () => {
    expect(
      admission(
        'const flag=def.state.bool("flag",true);const get=()=>{if(flag.get())return {disabled:false};return {disabled:true};};focus.configure(get());',
        profile
      ).ok
    ).toBe(true);
  });
  it('still rejects an unsupported field after helper transport', () => {
    expectRejected(
      'const get=()=>({disabled:false,extra:true});focus.configure(get());',
      profile,
      'Native interaction v1 does not support option extra.'
    );
  });
  it('still rejects a wrongly typed declared option after helper transport', () => {
    expectRejected(
      'const get=()=>({disabled:"wrong"});focus.configure(get());',
      profile,
      'Native focus disabled must be boolean.'
    );
  });
  it('rejects an invalid alternate return instead of selecting the valid branch', () => {
    expectRejected(
      'const flag=def.state.bool("flag",true);const get=():{disabled:boolean;extra?:boolean}=>{if(flag.get())return {disabled:false};return {disabled:false,extra:true};};focus.configure(get());',
      profile,
      'Native interaction v1 does not support option extra.'
    );
  });
  it('does not begin inspecting an unreached invalid helper', () => {
    expect(
      admission(
        'const unused=()=>{focus.configure({extra:true});};focus.configure({disabled:false});',
        profile
      ).ok
    ).toBe(true);
  });
  it('does not turn a wrong scope identity into a capability through a helper', () => {
    expectRejected(
      'const get=()=>({scopeKey:"not-a-scope-identity"});focus.configure(get());',
      profile,
      'Focus scopeKey requires a declared scope identity.'
    );
  });
  it('does not turn a wrong group identity into a capability through a helper', () => {
    expectRejected(
      'const get=()=>({groupKey:"not-a-group-identity"});focus.configure(get());',
      profile,
      'Focus groupKey requires a declared roving identity.'
    );
  });
});

describe('checked IR and interaction-shape provenance boundaries', () => {
  it('rejects an unknown helper despite a forged module-config result tag', () => {
    const ir = checkedPrototype('const config={disabled:false};focus.configure(config);');
    const config = ir.setup.body.find(
      (statement) => statement.kind === 'const' && statement.name === 'config'
    );
    if (config?.kind !== 'const') throw new Error('Expected config');
    config.value = {
      kind: 'helper-call',
      name: 'unknown',
      arguments: [],
      type: 'module-config',
      span: config.span,
    };
    expect(validateIR(ir).ok).toBe(false);
    expect(validateNativeInteraction(ir)).toContainEqual(
      expect.objectContaining({
        code: 'PUI_NATIVE_INTERACTION_UNSUPPORTED',
        message: 'Native interaction options require a statically known record shape.',
      })
    );
  });
  it('rejects a primitive disguised as module-config in a helper result', () => {
    const ir = checkedPrototype(
      'const config={disabled:false};const get=()=>config;focus.configure(get());'
    );
    const config = ir.setup.body.find(
      (statement) => statement.kind === 'const' && statement.name === 'config'
    );
    if (config?.kind !== 'const') throw new Error('Expected config');
    config.value = { kind: 'literal', value: true, type: 'module-config', span: config.span };
    expect(validateIR(ir).ok).toBe(false);
    expect(validateNativeInteraction(ir)).toContainEqual(
      expect.objectContaining({
        code: 'PUI_NATIVE_INTERACTION_UNSUPPORTED',
        message: 'Native interaction options require a statically known record shape.',
      })
    );
  });
  it('rejects duplicate record keys before first-member shape lookup can disagree with runtime semantics', () => {
    const ir = checkedPrototype('const config={disabled:false};focus.configure(config);');
    const config = ir.setup.body.find(
      (statement) => statement.kind === 'const' && statement.name === 'config'
    );
    if (config?.kind !== 'const' || config.value.kind !== 'record')
      throw new Error('Expected record');
    config.value.entries.push({
      key: 'disabled',
      value: { kind: 'literal', value: true, type: 'boolean', span: config.span },
    });
    const result = validateIR(ir);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Duplicate record accepted');
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ message: 'Duplicate IR record key.' })
    );
  });
  it('rejects an if-only return fallthrough rather than retaining only the record branch', () => {
    const ir = checkedPrototype(
      'const flag=def.state.bool("flag",true);const get=()=>{if(flag.get())return {disabled:false};return {disabled:true};};focus.configure(get());'
    );
    const get = ir.setup.body.find(
      (statement) => statement.kind === 'const' && statement.name === 'get'
    );
    if (get?.kind !== 'const' || get.value.kind !== 'function') throw new Error('Expected helper');
    get.value.function.body.pop();
    expect(validateIR(ir).ok).toBe(false);
    expect(validateNativeInteraction(ir)).toContainEqual(
      expect.objectContaining({
        code: 'PUI_NATIVE_INTERACTION_UNSUPPORTED',
        message: 'Native interaction options require a statically known record shape.',
      })
    );
  });
  it('rejects a second unknown member return despite the first known record', () => {
    const ir = checkedPrototype(
      'const flag=def.state.bool("flag",true);const get=()=>{if(flag.get())return {disabled:false};return {disabled:true};};focus.configure(get());'
    );
    const get = ir.setup.body.find(
      (statement) => statement.kind === 'const' && statement.name === 'get'
    );
    if (get?.kind !== 'const' || get.value.kind !== 'function') throw new Error('Expected helper');
    const last = get.value.function.body.at(-1);
    if (last?.kind !== 'return') throw new Error('Expected return');
    last.value = {
      kind: 'member',
      object: { kind: 'reference', name: 'unknown', type: 'module-config', span: last.span },
      property: 'config',
      optional: false,
      type: 'module-config',
      span: last.span,
    };
    expect(validateIR(ir).ok).toBe(false);
    expect(validateNativeInteraction(ir)).toContainEqual(
      expect.objectContaining({
        code: 'PUI_NATIVE_INTERACTION_UNSUPPORTED',
        message: 'Native interaction options require a statically known record shape.',
      })
    );
  });
  it('rejects unresolved recursive return provenance finitely', () => {
    const ir = checkedPrototype('const get=()=>({disabled:false});focus.configure(get());');
    const get = ir.setup.body.find(
      (statement) => statement.kind === 'const' && statement.name === 'get'
    );
    if (get?.kind !== 'const' || get.value.kind !== 'function') throw new Error('Expected helper');
    get.value.function.body = [
      {
        kind: 'return',
        value: {
          kind: 'helper-call',
          name: 'get',
          arguments: [],
          type: 'module-config',
          span: get.span,
        },
        span: get.span,
      },
    ];
    expect(validateIR(ir).ok).toBe(false);
    expect(validateNativeInteraction(ir)).toContainEqual(
      expect.objectContaining({
        code: 'PUI_NATIVE_INTERACTION_UNSUPPORTED',
        message: 'Native interaction options require a statically known record shape.',
      })
    );
  });
});
