// Editable generated source. Profile: react-runtime-v1.
// Retains the Proto-UI Runtime and React Adapter host bridge; NOT zero-runtime output.
// Source graph SHA-256: db52170259eb9c191cd788801983ed4668a76890a072f16311c1cb882a9cb07f
import * as __puiReact from 'react';
import * as __puiCore from '@proto.ui/core';
import * as __puiHooks from '@proto.ui/hooks';
import { createReactAdapter as __puiCreateAdapter } from '@proto.ui/adapter-react';
import type { ReactAdapterOptions as __puiOptions } from '@proto.ui/adapter-react';

export type GeneratedProps = {
  "disabled"?: boolean;
};
export type GeneratedExposes = {
  "disabled": __puiCore.ExposeState<boolean>;
  "hovered": __puiCore.ExposeState<boolean>;
  "focused": __puiCore.ExposeState<boolean>;
  "focusVisible": __puiCore.ExposeState<boolean>;
  "focusSelf": __puiCore.ExposeMethod<(options?: __puiCore.FocusRequestOptions) => void>;
  "pressed": __puiCore.ExposeState<boolean>;
  "click": __puiCore.ExposeEvent<void>;
};


export const prototype = __puiCore.definePrototype<GeneratedProps, GeneratedExposes>({
  name: "base-button",
  setup: (def: __puiCore.DefHandle<GeneratedProps, GeneratedExposes>) => {
    // Source 9:9
    const accessible = __puiHooks.asAccessible();
    // Source 11:3
    __puiHooks.asTrigger();
    // Source 14:3
    def.props.define({ "disabled": { "type": "boolean", "empty": "fallback" } });
    // Source 17:3
    def.props.setDefaults({ "disabled": false });
    // Source 22:9
    const disabled = def.state.bool("disabled", false);
    // Source 23:3
    def.expose.state("disabled", disabled);
    // Source 24:3
    accessible.state("disabled", disabled);
    // Source 27:9
    const hovered = def.state.bool("hovered", false);
    // Source 28:3
    def.expose.state("hovered", hovered);
    // Source 31:9
    const focusable = __puiHooks.asFocusable();
    // Source 32:3
    focusable.configure({ "disabled": false });
    // Source 34:9
    const focused = (focusable).focused;
    // Source 35:9
    const focusVisible = (focusable).focusVisible;
    // Source 38:3
    def.expose.state("focused", focused);
    // Source 39:3
    def.expose.state("focusVisible", focusVisible);
    // Source 42:3
    def.expose.method("focusSelf", (options?: __puiCore.FocusRequestOptions) => {
      // Source 43:5
      if (disabled.get()) {
        // Source 43:25
        return;
      }
      // Source 44:5
      focusable.focusSelf(options);
    });
    // Source 48:9
    const pressed = def.state.bool("pressed", false);
    // Source 49:3
    def.expose.state("pressed", pressed);
    // Source 51:9
    const clearTransientInteraction = (reason: string) => {
      // Source 52:5
      hovered.set(false, reason);
      // Source 53:5
      pressed.set(false, reason);
    };
    // Source 57:3
    def.lifecycle.onUnmounted(() => {
      // Source 58:5
      clearTransientInteraction("reason: button view unmounted => reset transient interaction");
    });
    // Source 62:9
    const syncDisabled = (nextDisabled: boolean) => {
      // Source 63:5
      disabled.set(nextDisabled, "reason: sync disabled");
      // Source 64:5
      focusable.setDisabled(nextDisabled);
      // Source 65:5
      if (nextDisabled) {
        // Source 66:7
        clearTransientInteraction("reason: button disabled => reset transient interaction");
      }
    };
    // Source 69:3
    def.lifecycle.onCreated((run: __puiCore.RunHandle<GeneratedProps>) => {
      // Source 70:5
      syncDisabled((run.props.get()).disabled);
    });
    // Source 72:3
    def.props.watch(["disabled"], (_run: __puiCore.RunHandle<GeneratedProps>, next: __puiCore.PropsSnapshot<GeneratedProps>) => {
      // Source 73:5
      syncDisabled((next).disabled);
    });
    // Source 77:3
    def.expose.event("click", { "payload": "void" });
    // Source 79:3
    accessible.action("activate", { "event": "click" });
    // Source 82:3
    accessible.role("button");
    // Source 85:3
    accessible.nameFromContent();
    // Source 90:3
    def.event.onGlobal("key.down", (_run: __puiCore.RunHandle<GeneratedProps>, ev: Parameters<__puiCore.ProtoEventCallback<GeneratedProps>>[1]) => {
      // Source 91:11
      const detail = ev;
      // Source 92:5
      if (disabled.get()) {
        // Source 92:25
        return;
      }
      // Source 93:5
      if ((!focused.get())) {
        // Source 93:25
        return;
      }
      // Source 94:5
      if (((detail)?.key !== " ")) {
        // Source 94:30
        return;
      }
      // Source 95:5
      (ev).control.requestDefaultActionPrevention({ "reason": "button.space-activation", "source": "base-button" });
    });
    // Source 102:3
    def.event.on("pointer.enter", () => {
      // Source 103:5
      if (disabled.get()) {
        // Source 103:25
        return;
      }
      // Source 104:5
      hovered.set(true, "reason: button pointer.enter => hovered");
    });
    // Source 106:3
    def.event.on("pointer.leave", () => {
      // Source 107:5
      hovered.set(false, "reason: button pointer.leave => hovered");
      // Source 108:5
      pressed.set(false, "reason: button pointer.leave => pressed");
    });
    // Source 110:3
    def.event.on("pointer.cancel", () => {
      // Source 111:5
      hovered.set(false, "reason: button pointer.cancel => hovered");
      // Source 112:5
      pressed.set(false, "reason: button pointer.cancel => pressed");
    });
    // Source 116:3
    def.event.on("pointer.down", () => {
      // Source 117:5
      if (disabled.get()) {
        // Source 117:25
        return;
      }
      // Source 118:5
      pressed.set(true, "reason: button pointer.down => pressed");
    });
    // Source 120:3
    def.event.on("pointer.up", () => {
      // Source 121:5
      pressed.set(false, "reason: button pointer.up => pressed");
    });
    // Source 125:3
    def.event.on("press.commit", (run: __puiCore.RunHandle<GeneratedProps>) => {
      // Source 126:5
      pressed.set(false, "reason: button press.commit => pressed");
      // Source 127:5
      run.expose.emit("click");
      run.expose.emit("click");
    });
  },
});

const __puiAdapt = __puiCreateAdapter(__puiReact);
export function createComponent(options?: __puiOptions<GeneratedProps>) {
  return __puiAdapt(prototype, options);
}
export const CompiledComponent = createComponent();
export default CompiledComponent;
