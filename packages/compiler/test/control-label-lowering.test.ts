import { describe, expect, it } from 'vitest';
import { compilePrototype, compileFile } from '../src/compile';
import { compileProject } from '../src/project';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { emitReactSource } from '../src/react-source';
import { emitVueSource } from '../src/vue-source';
import { emitVue2Source } from '../src/vue2-source';
import { emitWebComponentSource } from '../src/web-component-source';
import { emitQtSource } from '../src/qt-source';
import { emitFlutterSource } from '../src/flutter-source';
import { emitGpuiSource } from '../src/gpui-source';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { projectCompilationArtifacts } from '../src/project-output';
import { resolvedPropFacts } from '../src/resolved-props';
import { mountNativeOwner } from './native-owner-consumer';
import type { ExpressionIR, FunctionIR, PrototypeIR } from '../src/ir';

const profiles = [
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
] as const;
const source = `import {definePrototype, type RunHandle} from '@proto.ui/core';
import {asControlLabel} from '@proto.ui/hooks';
export default definePrototype({name:'unrelated-target',setup(def){
  def.expose.event('commit',{payload:'void'});
  const apply = (run: RunHandle<{}>, current: () => boolean = () => true) => {
    if (current()) run.expose.emit('commit');
  };
  asControlLabel().target((run, request) => {
    const current = () => request.isCurrent();
    apply(run, current);
  });
  def.lifecycle.onMounted((run) => apply(run));
  return renderer => renderer.r.slot();
}});`;
function compilation(
  input = source,
  profile: (typeof profiles)[number] = profiles[0],
  fileName = 'arbitrary.proto.ts'
) {
  const result = compilePrototype(input, { fileName, profile });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}
function findFunctions(ir: PrototypeIR): FunctionIR[] {
  const functions: FunctionIR[] = [];
  const seen = new Set<object>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if ('parameters' in value && 'body' in value) functions.push(value as FunctionIR);
    for (const child of Object.values(value)) visit(child);
  };
  visit(ir);
  return functions;
}

describe.each(profiles)('generic ControlLabel lowering %s', (profile) => {
  it('admits unrelated names, checked helper callbacks and per-call defaults without a Proto runtime', () => {
    const result = compilation(source, profile, 'renamed/other.proto.ts');
    expect(
      result.output.supportingFiles?.some(
        (file) => file.path === '.proto-ui/interaction/control-label-v1.ts'
      )
    ).toBe(true);
    expect(result.output.code).toContain('instanceAssociations');
    expect(result.output.code).not.toMatch(/from ['"]@proto\.ui\//);
    expect(result.output.code).toContain('current =');
  });

  it('omits the association helper from an unreached program', () => {
    const result = compilation(
      `import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'plain',setup(){return renderer => renderer.el('span','plain');}});`,
      profile
    );
    expect(
      result.output.supportingFiles?.some(
        (file) => file.path === '.proto-ui/interaction/control-label-v1.ts'
      )
    ).not.toBe(true);
    expect(result.output.code).not.toContain("from './.proto-ui/interaction/control-label-v1'");
  });

  it('preserves the explicit anatomy pairing declaration', () => {
    const result = compilation(
      `import {definePrototype, createAnatomyFamily} from '@proto.ui/core';
      import {asControlLabel} from '@proto.ui/hooks';
      const family = createAnatomyFamily('renamed-family',{roles:{root:{cardinality:{min:1,max:1}},caption:{cardinality:{min:1,max:1}},control:{cardinality:{min:1,max:1}}},relations:[{kind:'contains',parent:'root',child:'caption'},{kind:'contains',parent:'root',child:'control'}]});
      export default definePrototype({name:'another-caption',setup(def){def.anatomy.claim(family,{role:'caption'}); asControlLabel().label({family,labelRole:'caption',targetRole:'control'}); return r=>r.slot();}});`,
      profile
    );
    expect(result.ir.staticDeclarations[0].kind).toBe('anatomy-family');
    expect(result.output.code).toContain('labelRole');
  });

  it('coalesces shared support for mixed demand without changing a standalone output', () => {
    const paired = compilation(source, profile, 'paired.proto.ts');
    const plain = compilation(
      `import {definePrototype} from '@proto.ui/core'; import {asFocusable} from '@proto.ui/hooks';
      export default definePrototype({name:'ordinary',setup(){asFocusable();return r=>r.el('span','plain');}});`,
      profile,
      'plain.proto.ts'
    );
    const before = JSON.stringify(plain.output);
    const extension =
      profile === 'vue2-source-v1' ? '.js' : profile === 'react-dom-source-v1' ? '.tsx' : '.ts';
    const generation = {
      revision: 1,
      identity: 'checked-project',
      dependencies: [],
      entries: [
        { entry: 'paired.proto.ts', compilation: paired, cacheHit: false },
        { entry: 'plain.proto.ts', compilation: plain, cacheHit: false },
      ],
    };
    const result = projectCompilationArtifacts(generation, {
      sourcePaths: {
        'paired.proto.ts': `Paired${extension}`,
        'plain.proto.ts': `Plain${extension}`,
      },
    });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok)
      expect(
        result.value.filter((file) => file.path.endsWith('/control-label-v1.ts'))
      ).toHaveLength(1);
    expect(JSON.stringify(plain.output)).toBe(before);
    const modified = structuredClone(generation);
    const sharedPaths = new Set(paired.output.supportingFiles?.map((file) => file.path));
    const helper = modified.entries[1].compilation.output.supportingFiles!.find((file) =>
      sharedPaths.has(file.path)
    );
    expect(helper, 'mixed plans must share a host support artifact').toBeDefined();
    if (!helper) throw new Error('Missing shared native support');
    helper.contents += '\n// modified outside compiler';
    expect(
      projectCompilationArtifacts(modified, {
        sourcePaths: {
          'paired.proto.ts': `Paired${extension}`,
          'plain.proto.ts': `Plain${extension}`,
        },
      })
    ).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI3002', message: expect.stringMatching(/conflicting supporting artifacts/) },
      ],
    });
  });
});

describe('checked callable and conditional IR boundaries', () => {
  it.each([
    source.replace('() => boolean = () => true', '() => boolean = () => "invalid"'),
    source.replace('const current = () => request.isCurrent()', 'const current = () => "invalid"'),
    source.replace('current: () => boolean', 'current: (value: string) => boolean'),
  ])('rejects mismatched helper/default signatures', (input) => {
    expect(parsePrototype(input).ok).toBe(false);
  });

  it('rejects a forged callback signature even when its expression is valid checked data', () => {
    const ir = structuredClone(compilation().ir);
    const parameter = findFunctions(ir)
      .flatMap((fn) => fn.parameters)
      .find((parameter) => parameter.default)!;
    const initial = parameter.default as Extract<ExpressionIR, { kind: 'function' }>;
    initial.function.returnType = 'string';
    initial.function.body = [
      {
        kind: 'return',
        value: { kind: 'literal', value: 'invalid', type: 'string', span: initial.span },
        span: initial.span,
      },
    ];
    expect(validateIR(ir).ok).toBe(false);
  });

  it('retains both data alternatives of a conditional without erasing effects', () => {
    const result = compilation(
      source.replace(
        'if (current()) run.expose.emit',
        'if (current() ? true : false) run.expose.emit'
      )
    );
    expect(result.output.code).toMatch(/\? true : false/);
    const ir = structuredClone(result.ir);
    const fn = findFunctions(ir).find((fn) =>
      fn.body.some(
        (statement) => statement.kind === 'if' && statement.condition.kind === 'conditional'
      )
    )!;
    const statement = fn.body.find((statement) => statement.kind === 'if')!;
    if (statement.kind === 'if') statement.condition.type = 'string';
    expect(validateIR(ir).ok).toBe(false);
  });

  it.each([
    'gpui-source-v1',
    'qt-source-v1',
    'flutter-source-v1',
    'react-dom-ssr-v1',
    'vue-ssr-v1',
    'vue2-ssr-v1',
    'web-component-ssr-v1',
  ])('preserves an explicit unsupported profile boundary for %s', (profile) => {
    const result = compilePrototype(source, { profile });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(
        result.diagnostics.every((diagnostic) => diagnostic.category === 'unsupported-input')
      ).toBe(true);
  });
});

describe('new helper language cannot widen phase or capture authority', () => {
  const defaults = `import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'default-phase',setup(def){
      def.props.define({enabled:{type:'boolean',default:false}});
      const later = (value: void = def.props.setDefaults({enabled:true})) => {};
      later();
      def.lifecycle.onMounted(() => {});
    }});`;

  it('checks parameter default operations in the caller phase at source and IR entry', () => {
    const invalid = defaults.replace(
      'later();\n      def.lifecycle.onMounted(() => {});',
      'def.lifecycle.onMounted(() => later());'
    );
    expect(parsePrototype(invalid)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1007' }],
    });
    const parsed = parsePrototype(defaults);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const ir = structuredClone(parsed.value);
    const invocation = ir.setup.body.find(
      (statement) => statement.kind === 'effect' && statement.expression.kind === 'helper-call'
    )!;
    const mounted = findFunctions(ir).find((fn) => fn.context === 'mounted')!;
    mounted.body = [invocation];
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('tracks capture identities used only by a parameter default', () => {
    const parsed = parsePrototype(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'default-captures',setup(def){
        def.event.on('pointer.move',()=>{const seed=1;const read=(value:number=seed)=>{};read();});
        def.event.on('pointer.enter',()=>{const seed=2;const read=(value:number=seed)=>{};read();});
      }});`);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const ir = structuredClone(parsed.value);
    const holders: Extract<ExpressionIR, { kind: 'function' }>[] = [];
    const walk = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      if ('kind' in value && value.kind === 'function') {
        const holder = value as Extract<ExpressionIR, { kind: 'function' }>;
        if (holder.function.parameters.some((parameter) => parameter.default)) holders.push(holder);
      }
      Object.values(value).forEach(walk);
    };
    walk(ir);
    expect(holders).toHaveLength(2);
    const capturedSeeds = holders.map((holder) => {
      const seed = holder.function.parameters[0].default!;
      expect(seed).toMatchObject({ kind: 'reference' });
      if (seed.kind !== 'reference') throw new Error('Expected captured default binding');
      return seed;
    });
    expect(capturedSeeds[0].bindingId).not.toBe(capturedSeeds[1].bindingId);
    for (let index = 0; index < holders.length; index++)
      expect(holders[index].function.captures).toContainEqual(
        expect.objectContaining({ bindingId: capturedSeeds[index].bindingId })
      );
    holders[1].function = holders[0].function;
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002', message: 'Reference binding identity mismatch.' }],
    });
  });

  it.each([
    'const apply = (current?:()=>boolean) => current(); apply();',
    'const apply = (run?:RunHandle<{}>) => run.update(); apply();',
    'const seed=1; const apply = (seed:number=seed) => seed; apply();',
    'const later=1; const apply = (first:number=later,later:number=2) => first; apply();',
  ])('rejects unsupported optional/default parameter scope: %s', (body) => {
    expect(
      parsePrototype(
        `import {definePrototype,type RunHandle} from '@proto.ui/core';export default definePrototype({name:'parameter-boundary',setup(){${body}}});`
      ).ok
    ).toBe(false);
  });

  it('calls a default closure only after the later parameter has initialized', async () => {
    const owner = await mountNativeOwner(
      `import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'default-closure-binding',setup(def){
        const later=1;
        const apply=(first:()=>number=()=>later,later:number=2)=>first();
        def.expose.value('defaulted',apply());
        def.expose.value('supplied',apply(undefined,3));
      }});`,
      'react-dom-source-v1'
    );
    try {
      expect(owner.handle.getExposes()).toMatchObject({ defaulted: 2, supplied: 3 });
    } finally {
      await owner.dispose();
    }
  });

  it.each<{ declaration: string; imports: string; files: Record<string, string> }>([
    { declaration: 'type Check=(value:boolean=true)=>boolean;', imports: '', files: {} },
    { declaration: 'type Check={read(value:boolean=true):boolean};', imports: '', files: {} },
    {
      declaration: '',
      imports: "import type {Check} from './signature';",
      files: { 'signature.ts': 'export type Check=(value:boolean=true)=>boolean;' },
    },
  ])(
    'rejects executable initializers in resolved source type signatures: $declaration $imports',
    ({ declaration, imports, files }) => {
      expect(
        parsePrototype(
          `import {definePrototype} from '@proto.ui/core';${imports}${declaration}
      export default definePrototype({name:'inert-signature',setup(){const use=(value:Check)=>{};}});`,
          { files }
        )
      ).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: 'PUI1020',
            message: 'Callable type signatures cannot contain parameter initializers.',
          },
        ],
      });
    }
  );

  it('rejects rest metadata even when an ordinary-array call would otherwise match', () => {
    expect(
      parsePrototype(`import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'rest-signature',setup(){const apply=(current:(...values:boolean[])=>boolean)=>current([true]);}});`)
    ).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'PUI1020',
          message: 'Rest parameters in callable type signatures are unsupported.',
        },
      ],
    });
  });

  it('rejects executable initializers inside imported callback signature metadata', () => {
    const ir = structuredClone(compilation().ir);
    const parameter = findFunctions(ir)
      .flatMap((fn) => fn.parameters)
      .find(
        (parameter) => typeof parameter.type !== 'string' && parameter.type.kind === 'callable'
      )!;
    if (typeof parameter.type === 'string' || parameter.type.kind !== 'callable')
      throw new Error('Expected an ordinary callable signature');
    parameter.type.parameters = [
      {
        name: 'inert',
        type: 'boolean',
        optional: true,
        default: { kind: 'literal', value: true, type: 'boolean', span: ir.setup.span },
      },
    ];
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002', message: 'Unknown IR field.' }],
    });
  });
});

describe('direct emitters preserve unsupported feature boundaries', () => {
  it.each([emitReactSource, emitVueSource, emitVue2Source, emitWebComponentSource])(
    '%s rejects ControlLabel at the SSR emitter entry',
    (emit) => {
      const result = emit(compilation().ir, { ssr: true });
      expect(result).toMatchObject({ ok: false });
      if (!result.ok)
        expect(
          result.diagnostics.some(
            (diagnostic) => diagnostic.code === 'PUI4003' && /ControlLabel/.test(diagnostic.message)
          )
        ).toBe(true);
    }
  );
  it.each([emitQtSource, emitFlutterSource, emitGpuiSource])(
    '%s rejects ControlLabel at the native emitter entry',
    (emit) => {
      const result = emit(compilation().ir);
      expect(result).toMatchObject({ ok: false });
      if (!result.ok)
        expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'PUI4003')).toBe(true);
    }
  );
  it.each([
    'const read=(flag:boolean=true)=>flag; def.expose.value("observed",read());',
    'const read=(call:()=>boolean)=>call();def.expose.value("observed",read(()=>true));',
    'const value=true?1:2;def.expose.value("observed",value);',
  ])('GPUI admits reached ordinary language with a public result: %s', (body) => {
    const result = compilePrototype(
      `import {definePrototype} from '@proto.ui/core';export default definePrototype({name:'native-boundary',setup(def){${body}}});`,
      { profile: 'gpui-source-v1' }
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(validateIR(JSON.parse(JSON.stringify(result.value.ir))).ok).toBe(true);
    expect(result.value.ir.exposes).toContainEqual(
      expect.objectContaining({ name: 'observed', kind: 'value' })
    );
    expect(result.value.output.code).toContain('observed');
  });
  it('does not hide unsupported pointer facts inside a conditional or default expression', () => {
    for (const body of [
      'const value = true ? event.pointerType : event.pointerType;run.expose.emit("observed",value);',
      "const read = (value:boolean=event.pointerType==='mouse') => value; run.expose.emit('observed',read());",
    ]) {
      const parsed = parsePrototype(
        `import {definePrototype} from '@proto.ui/core';export default definePrototype({name:'conditional-pointer',setup(def){def.expose.event('observed',{payload:'json'});def.event.on('pointer.move',(run,event)=>{${body}});}});`
      );
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      for (const emit of [emitReactSource, emitVueSource, emitVue2Source, emitWebComponentSource]) {
        const result = emit(parsed.value, { ssr: true });
        expect(result.ok).toBe(false);
        if (!result.ok)
          expect(
            result.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === 'PUI4003' && /pointer facts/i.test(diagnostic.message)
            )
          ).toBe(true);
      }
    }
  });
});

describe('type edges preserve complete runtime source failures', () => {
  it.each(['nested-runtime', 'mixed-missing'] as const)(
    'does not erase %s dependency failures in file or project loading',
    async (kind) => {
      const root = await mkdtemp(path.join(tmpdir(), 'control-label-source-edge-'));
      try {
        const imports =
          kind === 'nested-runtime'
            ? "import type {Data} from './shared'; import {useShared} from './shared';"
            : "import type {Data} from './missing'; import {useShared} from './missing';";
        await writeFile(
          path.join(root, 'entry.proto.ts'),
          `import {definePrototype} from '@proto.ui/core';${imports}export default definePrototype({name:'source-edge',setup(){}});`
        );
        if (kind === 'nested-runtime')
          await writeFile(
            path.join(root, 'shared.ts'),
            "import {dependency} from './missing'; export type Data=boolean; export const useShared=()=>dependency;"
          );
        for (const result of [
          await compileFile('entry.proto.ts', { root, profile: 'react-dom-source-v1' }),
          await compileProject({
            root,
            entries: ['entry.proto.ts'],
            profile: 'react-dom-source-v1',
          }),
        ]) {
          expect(result.ok).toBe(false);
          if (!result.ok)
            expect(
              result.diagnostics.some((diagnostic) =>
                /Missing local source/.test(diagnostic.message)
              )
            ).toBe(true);
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  );
});

it.each([emitQtSource, emitFlutterSource])(
  '%s explicitly rejects new defaults and callable parameters instead of dropping them',
  (emit) => {
    for (const body of [
      'const read=(flag:boolean=true)=>flag; def.expose.value("observed",read());',
      'const read=(call:()=>boolean)=>call();def.expose.value("observed",read(()=>true));',
    ]) {
      const parsed = parsePrototype(
        `import {definePrototype} from '@proto.ui/core';export default definePrototype({name:'direct-native-parameter',setup(def){${body}}});`
      );
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      const result = emit(parsed.value);
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(
          result.diagnostics.some(
            (diagnostic) => diagnostic.code === 'PUI4003' && /parameter/.test(diagnostic.message)
          )
        ).toBe(true);
    }
  }
);

it.each(profiles)('%s reaches host support used only by a checked per-call default', (profile) => {
  const result = compilation(
    `import {definePrototype,tw} from '@proto.ui/core';
    export default definePrototype({name:'default-only-host-feature',setup(def){
      def.lifecycle.onMounted(run=>{const patch=(value:void=run.feedback.style.patch(tw('opacity-50')))=>{};patch();});
      return r=>r.el('span','default host support');
    }});`,
    profile
  );
  expect(
    result.output.supportingFiles?.some((file) => file.path === '.proto-ui/style/native-v1.ts')
  ).toBe(true);
  expect(result.output.code).toMatch(/createNativeStyle/);
});

describe('resolved prop presence stays separate from non-null defaults', () => {
  it.each([
    "def.props.define({flag:{type:'boolean',default:null}});def.props.define({flag:{type:'boolean',default:true}});",
    "const choose=def.state.bool('choose',false);if(choose.get()){def.props.define({flag:{type:'boolean',default:null}});}def.props.define({flag:{type:'boolean',default:true}});",
    "def.props.define({flag:{type:'boolean',default:true}});const choose=def.state.bool('choose',false);if(choose.get()){def.props.define({flag:{type:'boolean',default:null}});}",
  ])('keeps a guaranteed declared slot present after refinements', (setup) => {
    const parsed = parsePrototype(
      `import {definePrototype} from '@proto.ui/core';export default definePrototype({name:'presence-proof',setup(def){${setup}}});`
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const facts = resolvedPropFacts(parsed.value);
    expect(facts.required.has('flag')).toBe(true);
    expect(facts.nonNull.has('flag')).toBe(false);
  });
  it('keeps a declaration after a possible setup return optional', () => {
    const parsed = parsePrototype(
      `import {definePrototype} from '@proto.ui/core';export default definePrototype({name:'early-return-proof',setup(def){const skip=def.state.bool('skip',false);if(skip.get())return;def.props.define({flag:{type:'boolean',default:true}});}});`
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(resolvedPropFacts(parsed.value).required.has('flag')).toBe(false);
  });
});

describe('explicit internal client-only hydration boundary', () => {
  it('emits the real ControlLabel helper and owner association getter only after explicit opt-in', () => {
    const result = emitWebComponentSource(compilation().ir, {
      ssr: true,
      controlLabelHydration: 'client-only',
    });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) {
      expect(
        result.value.supportingFiles?.some(
          (file) => file.path === '.proto-ui/interaction/control-label-v1.ts'
        )
      ).toBe(true);
      expect(result.value.code).toContain('getAssociations ?? (() => undefined)');
      expect(result.value.code).toContain('port.server && getAssociations !== undefined');
    }
  });
  it('does not admit anatomy-derived pairs in the client-only hydration experiment', () => {
    const parsed =
      parsePrototype(`import {definePrototype,createAnatomyFamily} from '@proto.ui/core';import {asControlLabel} from '@proto.ui/hooks';
      const family=createAnatomyFamily('another-family',{roles:{root:{cardinality:{min:1,max:1}},caption:{cardinality:{min:1,max:1}},control:{cardinality:{min:1,max:1}}},relations:[{kind:'contains',parent:'root',child:'caption'},{kind:'contains',parent:'root',child:'control'}]});
      export default definePrototype({name:'generic-ssr-caption',setup(){asControlLabel().label({family,labelRole:'caption',targetRole:'control'});return r=>r.slot();}});`);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(
      emitWebComponentSource(parsed.value, { ssr: true, controlLabelHydration: 'client-only' })
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI4003', message: expect.stringMatching(/anatomy pairing/) }],
    });
  });
  it('does not treat the internal hydration option as an ordinary browser mode', () => {
    expect(
      emitWebComponentSource(compilation().ir, { controlLabelHydration: 'client-only' })
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI3301' }] });
  });
});
