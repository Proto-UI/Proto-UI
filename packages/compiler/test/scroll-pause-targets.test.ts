// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitGpuiSource } from '../src/gpui-source';
import { emitFlutterSource } from '../src/flutter-source';
import { emitQtSource } from '../src/qt-source';
import { qtControlsSource } from '../src/qt-native-controls';

const source = `import {definePrototype} from '@proto.ui/core';
import {asScrollSurface} from '@proto.ui/hooks';
export default definePrototype({name:'pause-follow-consumer',setup(def){
  const scroll=asScrollSurface();
  scroll.configure({axes:'vertical',endFollow:{mode:'while-at-end',axis:'vertical'}});
  def.expose.method('pause',()=>scroll.pauseFollowing());
  return r=>r.el('section',r.slot());
}});`;

describe('geometry-free end-follow pause target lowering', () => {
  // Direct dormant emitters remain dormant: this is lowering evidence, not a
  // native SDK build, platform run, or public profile admission.
  it.each([
    ['GPUI', emitGpuiSource, 'scroll_pause_following'],
    ['Flutter', emitFlutterSource, 'pauseFollowing'],
    ['Qt', emitQtSource, 'pauseFollowing'],
  ] as const)('lowers the shared capability for %s', (_name, emit, call) => {
    const parsed = parsePrototype(source);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const emitted = emit(parsed.value);
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    expect(emitted.value.code).toContain(call);
    expect(emitted.value.supportingFiles?.some((file) => file.contents.includes(call))).toBe(true);
  });

  it('keeps the Qt control model paused during layout and resumes only on reader arrival or request', () => {
    // Execute emitted JS with explicit host facts. No native Qt layout claim.
    const create = new Function(
      `${qtControlsSource.replace('export function ', 'function ')}; return createControls;`
    )();
    const requests: unknown[] = [];
    const root = {
      syncScroll() {},
      scrollRequest(request: unknown) {
        requests.push(request);
      },
    };
    let ready = true,
      mounted: typeof root | null = root;
    const controls = create({
      declarations: [],
      alive() {},
      setup() {},
      runtime() {},
      changed() {},
      refreshFacts() {},
      ready: () => ready,
      active: () => true,
      root: () => mounted,
      invoke: (callback: (...args: unknown[]) => unknown, args: unknown[]) => callback(...args),
    });
    const scroll = controls.hooks.asScrollSurface();
    scroll.configure({ axes: 'vertical', endFollow: { mode: 'while-at-end', axis: 'vertical' } });
    controls.mount();
    const facts = (atEnd: boolean, scrolling = false) => ({
      axes: 'vertical',
      projection: 'system',
      scrolling,
      horizontal: {
        position: 0,
        visibleRatio: 1,
        canScrollBefore: false,
        canScrollAfter: false,
        atEnd: true,
      },
      vertical: {
        position: atEnd ? 1 : 0.5,
        visibleRatio: 0.5,
        canScrollBefore: true,
        canScrollAfter: !atEnd,
        atEnd,
      },
    });
    const publish = (
      atEnd: boolean,
      scrolling = false,
      offset = atEnd ? 400 : 200,
      horizontalOffset = 0,
      extent = 500
    ) =>
      controls.scrollFacts(facts(atEnd, scrolling), {
        horizontal: { offset: horizontalOffset, viewport: 100, extent: 500 },
        vertical: { offset, viewport: 100, extent },
      });
    publish(true);
    expect(scroll.pauseFollowing()).toEqual({ kind: 'dispatched' });
    publish(true);
    // A start notification or movement of the other axis is not an arrival.
    publish(true, true);
    expect(scroll.getSnapshot().endFollow.state).toBe('paused');
    publish(true, true, 400, 100);
    expect(scroll.getSnapshot().endFollow.state).toBe('paused');
    // Content shrink can change both normalized position and physical offset;
    // it still cannot establish a reader arrival at an explicitly paused end.
    publish(true, true, 300, 100, 400);
    expect(scroll.getSnapshot().endFollow.state).toBe('paused');
    publish(false);
    expect(scroll.getSnapshot().endFollow.state).toBe('paused');
    expect(requests).toHaveLength(0);
    publish(true, true);
    expect(scroll.getSnapshot().endFollow.state).toBe('following');
    scroll.pauseFollowing();
    scroll.request({ kind: 'to-end', axis: 'vertical' });
    publish(true);
    expect(scroll.getSnapshot().endFollow.state).toBe('following');
    expect(requests).toHaveLength(1);
    ready = false;
    expect(scroll.pauseFollowing()).toEqual({ kind: 'rejected', reason: 'unavailable' });
    mounted = null;
    expect(scroll.pauseFollowing()).toEqual({ kind: 'rejected', reason: 'not-mounted' });
    controls.dispose();
  });
});
