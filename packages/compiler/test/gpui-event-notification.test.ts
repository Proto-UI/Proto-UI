// @vitest-environment node
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { compilePrototype } from '../src/compile';

it('retains one event notification independently from ordinary repaint dirtiness', () => {
  const source = `import {definePrototype} from '@proto.ui/core';
    type Props={value:number};
    export default definePrototype<Props>({name:'ordinary-proposals',setup(def){
      def.props.define({value:{type:'number',default:0}});
      def.expose.event('proposed',{payload:'json'});
      def.props.watch(['value'],(run,next)=>run.expose.emit('proposed',{value:next.value}));
      return r=>r.slot();
    }});`;
  const output = compilePrototype(source, { profile: 'gpui-source-v1' });
  expect(output.ok, JSON.stringify(output.ok ? {} : output.diagnostics)).toBe(true);
  if (!output.ok) return;
  const code = output.value.output.code;
  const drive = code.slice(code.indexOf('pub fn drive('), code.indexOf('impl Drop for'));
  expect(drive).toContain('let result = catch_authored');
  expect(drive).toContain('if !notify_native_events(&self.owner, cx) && dirty { cx.notify(); }');
  expect(drive.indexOf('notify_native_events')).toBeGreaterThan(
    drive.lastIndexOf('dirty = std::mem::take')
  );
  expect(drive).not.toContain('request_update(');
  const owner = output.value.output.supportingFiles?.find((file) =>
    file.path.endsWith('/gpui-native-owner.rs')
  )?.contents;
  expect(owner).toBeDefined();
  expect(owner).toContain(
    'o.emitted.push((key,payload));o.pending_native_events=true;o.dirty=true;'
  );
  expect(owner).toContain('std::mem::take(&mut owner.borrow_mut().pending_native_events)');
  expect(owner).toContain(
    'fn render_time_props_emit_reaches_a_retained_consumer_without_authored_repaint('
  );
  expect(owner).toContain('fn undrained_event_backlog_does_not_repeat_notifications_or_repaint(');
  expect(owner).toContain('fn terminal_owner_events_still_notify_a_live_retained_entity(');
});

it('schedules an already-published event after failing props and both public method entry points', () => {
  const source = `import {definePrototype,type RunHandle} from '@proto.ui/core';
    type Props={value:number};
    export default definePrototype<Props>({name:'ordinary-throwing-proposals',setup(def){
      def.props.define({value:{type:'number',default:0}});
      def.expose.event('proposed',{payload:'json'});
      let current:RunHandle<Props>|null=null;
      def.lifecycle.onCreated(run=>{current=run;});
      def.props.watch(['value'],(run,next)=>{run.expose.emit('proposed',{value:next.value});throw false;});
      def.expose.method('send',()=>{const run=current;if(!run)return;run.expose.emit('proposed',{value:21});throw 0;});
      return r=>r.slot();
    }});`;
  const output = compilePrototype(source, { profile: 'gpui-source-v1' });
  expect(output.ok, JSON.stringify(output.ok ? {} : output.diagnostics)).toBe(true);
  if (!output.ok) return;
  const code = output.value.output.code;
  for (const [start, end] of [
    ['pub fn method_', 'pub fn owner('],
    ['pub fn call(', 'pub fn host_target('],
    ['pub fn set_props(', 'pub fn set_slot('],
  ]) {
    const block = code.slice(code.indexOf(start), code.indexOf(end, code.indexOf(start)));
    expect(block, start).toContain('let outcome = catch_authored');
    expect(block, start).toContain(
      'if outcome.is_err() { drive_pending_native_events(&self.owner, window, cx); }'
    );
  }
  const owner = output.value.output.supportingFiles?.find((file) =>
    file.path.endsWith('/gpui-native-owner.rs')
  )?.contents;
  expect(owner).toContain('fn render_time_watcher_emit_then_throw_keeps_false_and_delivers_once(');
  expect(owner).toContain('fn public_method_emit_then_throw_keeps_zero_and_delivers_once(');
});

it('keeps already-published lifecycle events observable after a failed native commit', () => {
  const fixture = new URL('./fixtures/gpui-ordinary-values/validation.proto.ts', import.meta.url);
  const output = compilePrototype(readFileSync(fixture, 'utf8'), {
    fileName: 'fixtures/gpui-ordinary-values/validation.proto.ts',
    profile: 'gpui-source-v1',
  });
  expect(output.ok, JSON.stringify(output.ok ? {} : output.diagnostics)).toBe(true);
  if (!output.ok) return;
  const owner = output.value.output.supportingFiles?.find((file) =>
    file.path.endsWith('/gpui-native-owner.rs')
  )?.contents;
  expect(owner).toBeDefined();
  const start = owner!.indexOf('let owner=committed.clone();');
  expect(start).toBeGreaterThan(0);
  const commit = owner!.slice(
    start,
    owner!.indexOf('if image_supported(owner)', start)
  );
  expect(commit).toContain('if native_host_callback(&owner,"commit",||{');
  expect(commit).toContain('}).is_none(){drive_pending_native_events(&owner,window,cx); }');
  expect(commit).not.toContain('request_update(');
  expect(commit).not.toContain('Owner::project(');
});
