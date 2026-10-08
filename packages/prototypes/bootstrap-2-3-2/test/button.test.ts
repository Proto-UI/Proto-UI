import { describe, expect, it } from 'vitest';
import { executeWithHost, type RuntimeHost } from '@proto.ui/runtime';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import path from 'node:path';
import button from '../src/button';
import { THEME, renderThemeCss } from '../src/theme';

function mount(rawProps: Record<string, unknown> = {}) {
  const root = new EventTarget();
  const global = new EventTarget();
  const host: RuntimeHost<any> = {
    prototypeName: button.name,
    getRawProps: () => rawProps,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => root],
        [EVENT_GLOBAL_TARGET_CAP, () => global],
      ]);
      wiring.attach('as-trigger', [
        [AS_TRIGGER_INSTANCE_CAP, root],
        [AS_TRIGGER_PARENT_CAP, () => null],
        [AS_TRIGGER_GET_PROTO_CAP, () => null],
      ]);
    },
  };
  const { controller, invokeUnmounted } = executeWithHost(button, host);
  return { controller, root, global, invokeUnmounted };
}

describe('bootstrap-2-3-2 Button draft projection', () => {
  it('inherits Base once and restores defaults after prop removal', async () => {
    const { controller, invokeUnmounted } = mount({ variant: 'primary' });
    expect(button.name).toBe('bootstrap-2-3-2-button');
    expect((button as any).__asHooks).toContainEqual(
      expect.objectContaining({ name: 'as-button', mode: 'once' })
    );
    expect(controller.getRuleStyleTokens()).toContain('bg-[linear-gradient(#08c,#04c)]');
    controller.applyRawProps({});
    expect(controller.getRuleStyleTokens()).toContain('bg-[linear-gradient(#fff,#e6e6e6)]');
    await invokeUnmounted();
  });
  it('derives press, focus and disabled feedback from Base state', async () => {
    const { controller, root, global, invokeUnmounted } = mount();
    root.dispatchEvent(new CustomEvent('pointer.enter'));
    root.dispatchEvent(new CustomEvent('pointer.down'));
    expect(controller.getRuleStyleTokens().some((token) => token.startsWith('shadow-'))).toBe(true);
    root.dispatchEvent(new CustomEvent('pointer.up'));
    root.dispatchEvent(new CustomEvent('pointer.leave'));
    global.dispatchEvent(new CustomEvent('key.down'));
    root.dispatchEvent(new CustomEvent('host:focus'));
    expect(controller.getRuleStyleTokens()).toContain('ring-2');
    controller.applyRawProps({ disabled: true });
    expect(controller.getRuleStyleTokens()).toContain('opacity-65');
    expect(controller.getRuleStyleTokens()).toContain('pointer-events-none');
    controller.applyRawProps({});
    expect(controller.getRuleStyleTokens()).not.toContain('opacity-65');
    await invokeUnmounted();
  });
  it('closes every source token through the real physical style translator', async () => {
    const tokens = (await collectProtoStyleTokens(
      path.resolve('packages/prototypes/bootstrap-2-3-2/src')
    )) as string[];
    expect(tokens.length).toBeGreaterThan(15);
    for (const state of ['hovered', 'pressed', 'disabled']) {
      expect(tokens).toContain(`data-[${state}]:bg-[#04c]`);
      expect(tokens).toContain(`data-[${state}]:bg-[#e6e6e6]`);
    }
    const css = renderProtoStyleTokenCss(tokens);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('box-sizing: border-box');
    expect(renderThemeCss()).toContain('--pui-foreground:');
    expect(Object.keys(THEME.light).sort()).toEqual(Object.keys(THEME.dark).sort());
  });
});
