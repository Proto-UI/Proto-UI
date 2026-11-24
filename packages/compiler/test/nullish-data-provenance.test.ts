// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validateIR } from '../src/ir-validation';
import { parsePrototype } from '../src/parser';
import { pointerFactsSource } from './pointer-facts-fixture';

function program(body: string, setup = '') {
  return `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'nullish-data-provenance',setup(def){
  def.expose.event('sample',{payload:'json'});
  ${setup}
  def.event.on('pointer.move',(run,event)=>{${body}});
  return r=>r.el('button','probe');
}});`;
}

function accepted(source: string) {
  const parsed = parsePrototype(source);
  expect(parsed.ok, JSON.stringify(parsed.ok ? {} : parsed.diagnostics)).toBe(true);
  if (!parsed.ok) return;
  const cold = validateIR(JSON.parse(JSON.stringify(parsed.value)));
  expect(cold.ok, JSON.stringify(cold.ok ? {} : cold.diagnostics)).toBe(true);
}

function rejected(source: string) {
  expect(parsePrototype(source)).toMatchObject({
    ok: false,
    diagnostics: [{ code: 'PUI1006' }],
  });
}

function fallbackMutation(value: string) {
  return program(`
    const retained:{value:string;hidden:string|undefined}={value:'safe',hidden:'safe'};
    const view:Readonly<{value:string}>=retained;
    const fallback=()=>{retained.hidden=undefined;return 'fallback';};
    const selected=(${value}) ?? fallback();
    run.expose.emit('sample',{selected,view});
  `);
}

describe('nullish coalescing retains only the selected value provenance', () => {
  it.each(['root', 'global'] as const)(
    'admits the unchanged complete %s PointerFacts consumer in source and cold IR',
    (scope) => accepted(pointerFactsSource(scope))
  );

  it.each(['pointerType', 'pointerButtons'])(
    'admits the defined fallback for optional event.%s',
    (field) => accepted(program(`run.expose.emit('sample',{value:event.${field} ?? 'absent'});`))
  );

  it('removes both null and undefined from a mixed helper input', () => {
    accepted(
      program(`
        const select=(value:string|null|undefined)=>value ?? 'fallback';
        const value=event.shiftKey ? null : event.pointerType;
        run.expose.emit('sample',{value:select(value)});
      `)
    );
  });

  it('keeps the same defined boundary inside records and arrays', () => {
    accepted(
      program(`run.expose.emit('sample',{
        nested:{kind:event.pointerType ?? 'absent'},
        values:[event.pointerButtons ?? 'absent']
      });`)
    );
  });

  it.each(['false', '0', "''", 'true', 'event.shiftKey === true'])(
    'retains non-nullish %s without invoking the fallback',
    (value) => accepted(fallbackMutation(value))
  );

  it.each(['null', 'undefined'])(
    'evaluates the actual fallback when the left side is %s',
    (value) => rejected(fallbackMutation(value))
  );

  it('retains a possible fallback when an optional host value may be nullish', () => {
    rejected(fallbackMutation('event.pointerType'));
  });

  it.each([
    ['optional without fallback', '{value:event.pointerType}'],
    ['undefined fallback', '{value:event.pointerType ?? undefined}'],
    ['nested undefined', '{value:{nested:undefined}}'],
    ['unknown value', "{value:((value:unknown)=>value ?? 'fallback')(event)}"],
    ['control capability', '{value:event.control}'],
    ['callback', '{value:()=>true}'],
  ])('rejects %s at the outward boundary', (_, payload) => {
    rejected(program(`run.expose.emit('sample',${payload});`));
  });

  it.each(['undefined', '()=>true', 'event.control'])(
    'preserves the left record identity hiding %s behind a narrower view',
    (hidden) => {
      rejected(
        program(`
          const original={value:'safe',hidden:${hidden}};
          const view:Readonly<{value:string}>|null=event.shiftKey ? original : null;
          run.expose.emit('sample',view ?? {value:'fallback'});
        `)
      );
    }
  );

  it.each(['undefined', '()=>true', 'event.control'])(
    'preserves the fallback record identity hiding %s behind a narrower view',
    (hidden) => {
      rejected(
        program(`
          const original={value:'safe',hidden:${hidden}};
          const view:Readonly<{value:string}>=original;
          const first=event.shiftKey ? {value:'first'} : null;
          run.expose.emit('sample',first ?? view);
        `)
      );
    }
  );

  it('does not erase hidden fields in the selected array elements', () => {
    rejected(
      program(`
        const original=[{value:'safe',hidden:()=>true}];
        const view:ReadonlyArray<Readonly<{value:string}>>|null=event.shiftKey ? original : null;
        run.expose.emit('sample',view ?? [{value:'fallback'}]);
      `)
    );
  });
});
