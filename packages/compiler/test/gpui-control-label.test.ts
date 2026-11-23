import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileFile, compilePrototype } from '../src/compile';
import { emitGpuiSource } from '../src/gpui-source';
import { parsePrototype } from '../src/parser';

const root = path.resolve(import.meta.dirname, '../../..');
const actual = [
  ['button', 'button/button.proto.ts'],
  ['toggle', 'toggle/toggle.proto.ts'],
  ['label', 'label/root.proto.ts'],
] as const;
const prefix = `import {definePrototype} from '@proto.ui/core';
import {asControlLabel} from '@proto.ui/hooks';`;

describe('compiled GPUI explicit ControlLabel association', () => {
  it.each(actual)(
    'compiles the complete unchanged Base %s through its source graph',
    async (name, file) => {
      const entry = path.join(root, 'packages/prototypes/base/src', file);
      const before = await readFile(entry, 'utf8');
      const result = await compileFile(entry, { root, profile: 'gpui-source-v1' });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(await readFile(entry, 'utf8')).toBe(before);
      expect(result.value.output.code).toContain('pub fn create_with_associations(');
      expect(result.value.output.code).toContain('pub fn set_instance_associations(');
      expect(result.value.output.code).toContain('control_label_declare(');
      expect(result.value.output.code).toContain(
        name === 'label' ? 'control_label_sync(' : 'control_label_request_current('
      );
      const sdk = result.value.output.supportingFiles?.find((file) =>
        file.path.endsWith('/gpui-native-owner.rs')
      );
      expect(sdk).toBeDefined();
      expect(sdk?.contents).toContain('pub struct ControlLabelRef(Rc<ControlLabelGroup>);');
      expect(sdk?.contents).toContain(
        'pub struct InstanceAssociations { pub control_label: Option<ControlLabelRef> }'
      );
    }
  );

  it('emits independent component crates against one explicit shared SDK', async () => {
    for (const [, file] of actual) {
      const result = await compileFile(path.join(root, 'packages/prototypes/base/src', file), {
        root,
        profile: 'gpui-source-v1',
        nativeSdkPath: '../owner/.proto-ui/gpui-native',
      });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      const artifacts = result.value.output.supportingFiles ?? [];
      const manifest = artifacts.find((file) => file.path === 'Cargo.toml')?.contents;
      expect(manifest).toContain('../owner/.proto-ui/gpui-native');
      expect(artifacts.some((file) => file.path.includes('/gpui-native/'))).toBe(false);
    }
  });

  it.each(['default', 'SetupLabel', 'Target'])(
    'preserves the generic facade and setup/callback sync admission for %s',
    async (exportName) => {
      const entry = path.join(
        root,
        'packages/compiler/test/fixtures/gpui-ordinary-values/control-label-generic.proto.ts'
      );
      const result = await compileFile(entry, { root, profile: 'gpui-source-v1', exportName });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(result.value.output.code).toContain('control_label_sync(');
      if (exportName === 'Target') {
        expect(result.value.output.code).toContain('control_label_request_current(');
        expect(result.value.output.code).toContain('strict_equal(');
      }
    }
  );

  it('lowers renamed generic participation without dispatching on prototype identity', () => {
    const result = compilePrototype(
      `${prefix}
      export default definePrototype({name:'unrelated-switchboard',setup(def){
        def.expose.event('commit');
        asControlLabel().target((run,request)=>{if(request.isCurrent()&&request.source==='accessibility')run.expose.emit('commit');});
        return r=>r.slot();
      }});`,
      { profile: 'gpui-source-v1' }
    );
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.output.code).toContain('control_label_request_current(');
    expect(result.value.output.code).toContain('.member("source", false)');
  });

  it.each(['label', 'target'])(
    'treats an explicitly undefined %s descriptor as omitted through public, direct and cold IR paths',
    (kind) => {
      const input = (explicit: boolean) =>
        `${prefix}export default definePrototype({name:'caption',setup(){asControlLabel().${kind}(${kind === 'target' ? '()=>{}' + (explicit ? ',' : '') : ''}${explicit ? 'undefined' : ''});
return r=>r.slot();}});`;
      const omitted = compilePrototype(input(false), { profile: 'gpui-source-v1' });
      if (!omitted.ok) throw new Error(JSON.stringify(omitted.diagnostics));
      const parsed = parsePrototype(input(true));
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      const publicResult = compilePrototype(input(true), { profile: 'gpui-source-v1' });
      if (!publicResult.ok) throw new Error(JSON.stringify(publicResult.diagnostics));
      expect(publicResult.value.output.code).toBe(omitted.value.output.code);
      for (const result of [
        emitGpuiSource(parsed.value),
        emitGpuiSource(JSON.parse(JSON.stringify(parsed.value))),
      ]) {
        if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
        expect(result.value.code).toBe(omitted.value.output.code);
      }
    }
  );

  it.each(['label', 'target'])(
    'rejects unsupported native Anatomy %s at public and direct emitter entry points',
    (kind) => {
      const source = `import {definePrototype,createAnatomyFamily} from '@proto.ui/core';
      import {asControlLabel} from '@proto.ui/hooks';
      const family=createAnatomyFamily('native-pair',{roles:{root:{cardinality:{min:1,max:1}},caption:{cardinality:{min:1,max:1}},control:{cardinality:{min:1,max:1}}},relations:[{kind:'contains',parent:'root',child:'caption'},{kind:'contains',parent:'root',child:'control'}]});
      export default definePrototype({name:'caption',setup(){asControlLabel().${kind}(${kind === 'target' ? '()=>{},' : ''}{family,labelRole:'caption',targetRole:'control'});return r=>r.slot();}});`;
      const parsed = parsePrototype(source);
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      for (const result of [
        emitGpuiSource(parsed.value),
        emitGpuiSource(JSON.parse(JSON.stringify(parsed.value))),
        compilePrototype(source, { profile: 'gpui-source-v1' }),
      ]) {
        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('unsupported Anatomy unexpectedly emitted');
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
          'PUI_GPUI_CONTROL_LABEL_ANATOMY'
        );
      }
    }
  );

  it.each(['qt-source-v1', 'flutter-source-v1'])(
    'retains the independent %s unsupported boundary',
    (profile) => {
      const result = compilePrototype(
        `${prefix}export default definePrototype({name:'caption',setup(){asControlLabel().label();return r=>r.slot();}});`,
        { profile }
      );
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unimplemented association emitted');
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['PUI4001']);
    }
  );
});
