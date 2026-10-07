import { createPreviewMaterialSink } from './preview-material-provider';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import type { Prototype } from '@proto.ui/core';
import { getPreviewWcName } from './wc-name';

const registeredPreviewWc = new Map<string, string>();

export function ensurePreviewWcRegistered(prototypeId: string, proto: Prototype<any, any>): string {
  const cached = registeredPreviewWc.get(prototypeId);
  if (cached) return cached;

  const wcName = getPreviewWcName(prototypeId);
  if (!customElements.get(wcName)) {
    const Ctor = AdaptToWebComponent(proto, {
      register: false,
      createVisualSink: createPreviewMaterialSink,
      registerAs: wcName,
    });
    customElements.define(wcName, Ctor);
  }

  registeredPreviewWc.set(prototypeId, wcName);
  return wcName;
}
